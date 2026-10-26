import SwiftUI
import AppKit
import CoreText
import UniformTypeIdentifiers
import Darwin

enum Assets {
    static var fontName = "EBGaramond-SemiBold"
    static func registerFont() {
        guard let url = Bundle.main.url(forResource: "EBGaramond-SemiBold", withExtension: "ttf") else { return }
        CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        if let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor], let first = descriptors.first {
            fontName = CTFontCopyPostScriptName(CTFontCreateWithFontDescriptor(first, 20, nil)) as String
        }
    }
    static func image(_ name: String) -> Image {
        let url = Bundle.main.url(forResource: name, withExtension: "png")
        return Image(nsImage: url.flatMap { NSImage(contentsOf: $0) } ?? NSImage(size: NSSize(width: 1, height: 1)))
    }
    static func display(_ size: CGFloat) -> Font { .custom(fontName, size: size.rounded()) }
    static let background = Color(red: 11/255, green: 12/255, blue: 15/255)
    static let panel = Color(red: 17/255, green: 18/255, blue: 21/255)
    static let gold = Color(red: 215/255, green: 188/255, blue: 138/255)
    static let text = Color(red: 244/255, green: 236/255, blue: 217/255)
    static let muted = Color(red: 169/255, green: 170/255, blue: 169/255)
    static let line = Color(red: 56/255, green: 51/255, blue: 44/255)
}

@MainActor final class UpdaterModel: ObservableObject {
    @Published var game: GameLocation?
    @Published var latest: Release?
    @Published var installed: Receipt?
    @Published var busy = false
    @Published var status = "Se caută versiunea disponibilă…"
    @Published var progress: Double = 0
    @Published var showProgress = false
    @Published var translationPercent: Double?
    private var downloading = false
    private var settings = UpdaterCore.loadSettings()
    var current: Bool { latest != nil && installed?.url == latest?.download_url }
    var availableVersion: String { latest?.version ?? (busy ? "Se verifică…" : "Indisponibilă") }
    var localVersion: String { game == nil ? "Alege folderul jocului" : installed?.version ?? "Necunoscută" }

    init() {
        if let path = settings.gamePath { game = try? UpdaterCore.resolveGame(URL(fileURLWithPath: path)) }
        if game == nil { game = UpdaterCore.detectGame() }
    }

    func check() async {
        guard !busy else { return }
        busy = true; showProgress = false; progress = 0; latest = nil
        status = "Verific versiunea publicată…"
        translationPercent = nil
        let projectTask = Task { try? await UpdaterCore.translationProgress() }
        defer { busy = false }
        do {
            if let selected = game {
                let saved = settings
                installed = try await Task.detached { try UpdaterCore.local(selected, settings: saved) }.value
            }
            latest = try await UpdaterCore.latest()
            if game == nil { status = "Am găsit ultima versiune. Alege folderul jocului pentru actualizare." }
            else if current { status = "Ești la zi. Ai instalată ultima versiune a traducerii." }
            else if installed?.version == nil { status = "Versiunea existentă nu poate fi identificată. La actualizare păstrez un backup." }
            else { status = "Este disponibilă o actualizare a traducerii." }
        } catch { status = "Nu pot verifica versiunea. \(error.localizedDescription)" }
        translationPercent = await projectTask.value
    }

    func chooseGame() {
        guard !busy else { return }
        let panel = NSOpenPanel()
        panel.message = "Alege Baldur's Gate 3.app sau folderul jocului."
        panel.canChooseFiles = true; panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false; panel.canCreateDirectories = false
        panel.allowedContentTypes = [.applicationBundle, .folder]
        if let game = game { panel.directoryURL = game.app.deletingLastPathComponent() }
        panel.begin { [weak self] response in
            guard response == .OK, let url = panel.url else { return }
            Task { @MainActor in
                guard let self = self else { return }
                do {
                    self.game = try UpdaterCore.resolveGame(url)
                    self.settings.gamePath = self.game?.app.path
                    try UpdaterCore.saveSettings(self.settings)
                    await self.check()
                } catch { self.status = error.localizedDescription }
            }
        }
    }

    func gameRunning() -> Bool {
        guard let game = game else { return false }
        return NSWorkspace.shared.runningApplications.contains { application in
            application.bundleURL?.resolvingSymlinksInPath().standardizedFileURL == game.app.standardizedFileURL
        }
    }

    func update() async {
        guard !busy, let release = latest, let selected = game else { return }
        if current { await check(); return }
        guard !gameRunning() else { status = "Închide Baldur's Gate 3 înainte de actualizare."; return }
        busy = true; showProgress = true; progress = 0
        var work: URL?
        defer { downloading = false; busy = false; if let work = work { UpdaterCore.removeWork(work) } }
        do {
            let directory = try UpdaterCore.temporaryWork(); work = directory
            let archive = directory.appendingPathComponent("translation.archive")
            let pak = directory.appendingPathComponent("English.pak")
            status = "Descarc traducerea de pe GitHub…"; downloading = true
            let agent = ArchiveDownload(output: archive, expected: release.file_bytes) { [weak self] fraction in
                Task { @MainActor in if let self = self, self.downloading { self.progress = fraction * 0.88 } }
            }
            try await agent.run(url: UpdaterCore.validate(release))
            downloading = false; progress = 0.88
            status = "Verific și pregătesc English.pak…"
            let hash = try await Task.detached { try UpdaterCore.extract(archive, to: pak) }.value
            progress = 0.92
            let receipt = Receipt(version: release.version, hash: hash, url: release.download_url)
            settings.gamePath = selected.app.path; settings.installs[selected.app.path] = receipt
            // Recognition always verifies the file hash, including if installation fails after metadata is saved.
            try UpdaterCore.saveSettings(settings)
            status = "Instalez traducerea și păstrez copia de siguranță…"
            _ = try UpdaterCore.install(selected, prepared: pak, expectedHash: hash, gameRunning: { self.gameRunning() })
            installed = receipt; progress = 1
            status = "Actualizare finalizată. Poți porni jocul."
        } catch { status = "Actualizarea nu a reușit. \(error.localizedDescription)" }
    }

    var releaseDetails: String {
        guard let release = latest else { return busy ? "Verific versiunea publicată…" : "Detalii indisponibile" }
        let iso = ISO8601DateFormatter(); iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fallback = ISO8601DateFormatter()
        let formatter = DateFormatter(); formatter.dateFormat = "dd.MM.yyyy"; formatter.timeZone = TimeZoneInfo.bucharest
        let date = (iso.date(from: release.published_at) ?? fallback.date(from: release.published_at)).map { formatter.string(from: $0) + " · " } ?? ""
        return date + String(format: "%.1f MB", Double(release.file_bytes)/1_048_576)
    }
}

enum TimeZoneInfo { static let bucharest = TimeZone(identifier: "Europe/Bucharest")! }

// Exact SVG paths from gabrielish.github.io/assets/hero-button-outline.svg and button-filled.svg.
struct OrnamentalShape: Shape {
 func path(in r:CGRect)->Path {
  var p=Path(); p.move(to:.init(x:16,y:8))
  for v in [CGPoint(x:191,y:8),.init(x:200,y:2),.init(x:209,y:8),.init(x:384,y:8)] { p.addLine(to:v) }
  p.addQuadCurve(to:.init(x:397,y:20),control:.init(x:388,y:17)); p.addLine(to:.init(x:397,y:64))
  p.addQuadCurve(to:.init(x:384,y:76),control:.init(x:388,y:67))
  for v in [CGPoint(x:209,y:76),.init(x:200,y:82),.init(x:191,y:76),.init(x:16,y:76)] { p.addLine(to:v) }
  p.addQuadCurve(to:.init(x:3,y:64),control:.init(x:12,y:67)); p.addLine(to:.init(x:3,y:20))
  p.addQuadCurve(to:.init(x:16,y:8),control:.init(x:12,y:17));p.closeSubpath()
  return p.applying(.init(scaleX:r.width/400,y:r.height/84))
 }
}
struct WebsiteMarks: Shape {
 var kind:Int
 func path(in r:CGRect)->Path {
  var p=Path()
  let sets:[[CGPoint]] = kind == 0 ? [[.init(x:0,y:42),.init(x:9,y:36),.init(x:29,y:42),.init(x:9,y:48)],[.init(x:400,y:42),.init(x:391,y:36),.init(x:371,y:42),.init(x:391,y:48)]] : kind == 1 ? [[.init(x:195,y:10),.init(x:200,y:6),.init(x:205,y:10),.init(x:200,y:15)],[.init(x:195,y:74),.init(x:200,y:79),.init(x:205,y:74),.init(x:200,y:69)]] : [[.init(x:196,y:8),.init(x:200,y:11),.init(x:204,y:8)],[.init(x:196,y:76),.init(x:200,y:73),.init(x:204,y:76)]]
  for set in sets { p.move(to:set[0]); for v in set.dropFirst(){p.addLine(to:v)}; if kind != 2 {p.closeSubpath()} }
  return p.applying(.init(scaleX:r.width/400,y:r.height/84))
 }
}

struct OrnamentDivider: View {
    var body: some View {
        GeometryReader { geometry in
            Path { path in
                let mid = geometry.size.width/2
                path.move(to: CGPoint(x: 0,y: 5.5)); path.addLine(to: CGPoint(x: mid-5,y: 5.5)); path.addLine(to: CGPoint(x: mid,y: 9.5)); path.addLine(to: CGPoint(x: mid+3,y: 6.5))
                path.move(to: CGPoint(x: mid-3,y: 4.5)); path.addLine(to: CGPoint(x: mid,y: 1.5)); path.addLine(to: CGPoint(x: mid+5,y: 5.5)); path.addLine(to: CGPoint(x: geometry.size.width,y: 5.5))
            }.stroke(LinearGradient(colors: [Color(red:183/255,green:143/255,blue:109/255), Color(red:221/255,green:201/255,blue:167/255), Color(red:183/255,green:143/255,blue:109/255)], startPoint: .leading, endPoint: .trailing), style: StrokeStyle(lineWidth:1,lineCap:.round,lineJoin:.round))
        }
    }
}

struct GoldButton: View {
    let title: String
    var primary = false
    var enabled = true
    let action: () -> Void
    private var hoverState = SwiftUI.State<Bool>(initialValue: false)
    init(title:String,primary:Bool = false,enabled:Bool = true,action:@escaping () -> Void) {
        self.title=title; self.primary=primary; self.enabled=enabled; self.action=action
    }
    private var hover: Bool {
        get { hoverState.wrappedValue }
        nonmutating set { hoverState.wrappedValue = newValue }
    }
    var body: some View {
        Button(action: action) {
            ZStack {
                if primary {
                    OrnamentalShape().fill(LinearGradient(colors:[Color(red:35/255,green:34/255,blue:30/255),Assets.panel],startPoint:.top,endPoint:.bottom))
                    OrnamentalShape().stroke(LinearGradient(colors:[Color(red:243/255,green:229/255,blue:212/255),Color(red:184/255,green:153/255,blue:107/255)],startPoint:.top,endPoint:.bottom),lineWidth:1.2).opacity(hover ? 0 : 1)
                    WebsiteMarks(kind:0).fill(Color(red:215/255,green:196/255,blue:165/255)).opacity(hover ? 0 : 1)
                    WebsiteMarks(kind:2).stroke(Color(red:188/255,green:160/255,blue:122/255),lineWidth:1).opacity(hover ? 0 : 1)
                    OrnamentalShape().fill(LinearGradient(colors:[Color(red:238/255,green:228/255,blue:204/255),Color(red:216/255,green:203/255,blue:174/255)],startPoint:.top,endPoint:.bottom)).opacity(hover ? 1 : 0)
                    WebsiteMarks(kind:1).fill(Color(red:23/255,green:21/255,blue:19/255)).opacity(hover ? 1 : 0)
                    Text(title.uppercased()).font(Assets.display(21)).foregroundColor(hover ? Color(red:23/255,green:21/255,blue:19/255) : Color(red:245/255,green:234/255,blue:216/255))
                } else {
                    RoundedRectangle(cornerRadius:8).fill(LinearGradient(colors:[hover ? Color(red:66/255,green:57/255,blue:39/255):Color(red:35/255,green:34/255,blue:30/255),Assets.panel],startPoint:.top,endPoint:.bottom))
                    RoundedRectangle(cornerRadius:8).stroke(hover ? Assets.gold : Assets.line,lineWidth:1)
                    Text(title).font(.system(size:12.67)).foregroundColor(Assets.text)
                }
            }.contentShape(Rectangle()).opacity(enabled ? 1 : 0.45)
        }.buttonStyle(.plain).disabled(!enabled).onHover {
            hover = $0 && enabled
            if $0 && enabled { NSCursor.pointingHand.set() }
            else { NSCursor.arrow.set() }
        }.animation(.easeInOut(duration:0.4),value:hover)
    }
}

struct DragHandle: NSViewRepresentable {
    final class View: NSView { override func mouseDown(with event: NSEvent) { window?.performDrag(with: event) } }
    func makeNSView(context: Context) -> View { View() }
    func updateNSView(_ view: View, context: Context) {}
}

struct HoverLink: View {
    let title: String
    let destination: URL
    let normal: Color
    let highlighted: Color
    init(title:String,destination:URL,normal:Color,highlighted:Color) {
        self.title=title;self.destination=destination;self.normal=normal;self.highlighted=highlighted
    }
    private var hoverState = SwiftUI.State<Bool>(initialValue: false)
    var body: some View {
        Link(title,destination:destination)
            .foregroundColor(hoverState.wrappedValue ? highlighted : normal)
            .onHover { inside in
                hoverState.wrappedValue = inside
                (inside ? NSCursor.pointingHand : NSCursor.arrow).set()
            }
    }
}

struct ContentView: View {
    @ObservedObject var model: UpdaterModel
    private func at<V: View>(_ view: V, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> some View {
        view.frame(width:w,height:h,alignment:.topLeading).offset(x:x,y:y)
    }
    private func card<V: View>(alignment: Alignment = .topLeading, @ViewBuilder content: () -> V) -> some View {
        content().padding(.horizontal,16).padding(.vertical,12).frame(maxWidth:.infinity,maxHeight:.infinity,alignment:alignment)
            .background(RoundedRectangle(cornerRadius:12).fill(Assets.panel))
            .overlay(RoundedRectangle(cornerRadius:12).stroke(Assets.line,lineWidth:1))
    }
    private func caption(_ text: String) -> some View { Text(text).font(.system(size:11,weight:.medium)).foregroundColor(Assets.muted) }
    private var header: some View {
        ZStack(alignment:.leading) {
            HStack(spacing:12) {
                Assets.image("brand-mark").resizable().interpolation(.high).frame(width:32,height:32)
                (Text("BG3").foregroundColor(Assets.text)+Text(".RO").foregroundColor(Assets.gold)).font(Assets.display(29.33))
            }.frame(width:326,alignment:.trailing)
            Rectangle().fill(Color(red:221/255,green:201/255,blue:167/255)).frame(width:1,height:20).offset(x:340)
            Text("UPDATER").font(Assets.display(29.33)).foregroundColor(Assets.gold).offset(x:354)
        }.frame(width:680,height:40,alignment:.leading).background(DragHandle())
    }
    var body: some View {
        ZStack(alignment:.topLeading) {
            Assets.background
            at(header,0,8,680,40)
            at(OrnamentDivider(),24,51,632,10)
            at(Text("Traducerea în română").font(Assets.display(32)).foregroundColor(Assets.text),24,68,500,40)
            at(Text("Baldur’s Gate 3 · Early Access · Progres traducere: " + (model.translationPercent.map { UpdaterCore.formatPercent($0)+"%" } ?? (model.busy ? "…" : "—"))).font(.system(size:12.67)).foregroundColor(Assets.muted),24,110,500,22)
            at(VStack(alignment:.trailing,spacing:12) {
                HoverLink(title:"Website ↗",destination:URL(string:"https://gabrielish.github.io/")!,normal:Assets.gold,highlighted:Assets.text)
                HoverLink(title:"Nexus Mods ↗",destination:URL(string:"https://www.nexusmods.com/baldursgate3/mods/24379")!,normal:Assets.gold,highlighted:Assets.text)
            }.font(.system(size:12.67)).foregroundColor(Assets.gold).frame(maxWidth:.infinity,alignment:.trailing),542,76,114,54)
            at(card { VStack(alignment:.leading,spacing:0) {
                caption("VERSIUNEA INSTALATĂ")
                Spacer(minLength:0)
                Text(model.localVersion).font(Assets.display(22.67)).foregroundColor(Assets.text).lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength:0)
                Text("Verificată din fișierul English.pak").font(.system(size:10.67)).foregroundColor(Assets.muted)
            } },24,146,310,92)
            at(card { VStack(alignment:.leading,spacing:0) {
                caption("VERSIUNEA DISPONIBILĂ")
                Spacer(minLength:0)
                Text(model.availableVersion).font(Assets.display(22.67)).foregroundColor(Assets.gold).lineLimit(1).minimumScaleFactor(0.7)
                Spacer(minLength:0)
                HStack(spacing:3) {
                    Text(model.releaseDetails)
                    if model.latest != nil { Text("·"); HoverLink(title:"Ce este nou?",destination:URL(string:"https://gabrielish.github.io/#actualizari")!,normal:Assets.muted,highlighted:Assets.gold) }
                }.font(.system(size:10.67)).foregroundColor(Assets.muted).lineLimit(1).minimumScaleFactor(0.75)
            } },346,146,310,92)
            at(HStack(spacing:16) {
                VStack(alignment:.leading,spacing:4) {
                    caption("Folderul jocului")
                    Text(model.game?.app.path ?? "Selectează Baldur's Gate 3.app").font(.system(size:11.33)).foregroundColor(Assets.muted).lineLimit(1).truncationMode(.middle).help(model.game?.app.path ?? "")
                }
                Spacer(minLength:0)
                GoldButton(title:model.game == nil ? "Alege folderul":"Schimbă",enabled:!model.busy,action:model.chooseGame).frame(width:108,height:34)
            }.padding(15).frame(width:632,height:64)
                .background(RoundedRectangle(cornerRadius:12).fill(Assets.panel))
                .overlay(RoundedRectangle(cornerRadius:12).stroke(Assets.line,lineWidth:1)),24,250,632,64)
            at(VStack(spacing:6) {
                HStack { Text("Actualizare").foregroundColor(Assets.muted); Spacer(); if model.showProgress { Text("\(Int(model.progress*100))%").bold().foregroundColor(Assets.text) } }.font(.system(size:12.67))
                GeometryReader { geometry in ZStack(alignment:.leading) {
                    Capsule().fill(Color(red:41/255,green:40/255,blue:38/255))
                    Capsule().fill(LinearGradient(colors:[Color(red:183/255,green:143/255,blue:109/255),Color(red:221/255,green:201/255,blue:167/255)],startPoint:.leading,endPoint:.trailing)).frame(width:geometry.size.width * CGFloat(model.progress))
                } }.frame(height:8)
            },24,324,632,30)
            at(Text(model.status).font(.system(size:12.67)).foregroundColor(Assets.text).lineLimit(2),24,362,632,30)
            at(GoldButton(title:"Verifică din nou",enabled:!model.busy,action:{ Task { await model.check() } }),24,410,154,36)
            at(GoldButton(title:model.busy ? "Se verifică…":model.current ? "Ești la zi":"Actualizează",primary:true,enabled:!model.busy && model.game != nil && model.latest != nil,action:{ Task { await model.update() } }),380,398,276,58)
        }.frame(width:680,height:472).preferredColorScheme(.dark)
            .task { await model.check() }
    }
}

final class UpdaterHostingView: NSHostingView<ContentView> {
    override var safeAreaInsets: NSEdgeInsets { NSEdgeInsetsZero }
}

final class UpdaterWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
    override func sendEvent(_ event: NSEvent) {
        if event.type == .keyDown && event.keyCode == 48 { return }
        super.sendEvent(event)
    }
}

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate {
    private var window: NSWindow?
    private let model = UpdaterModel()
    func applicationDidFinishLaunching(_ notification: Notification) {
        Assets.registerFont()
        if CommandLine.arguments.contains("--self-test") {
            do {
                try CoreSelfTest.run()
                print("PASS: native macOS core fixtures")
                exit(0)
            } catch {
                fputs("FAIL: \(error)\n",stderr)
                exit(1)
            }
        }
        NSApp.setActivationPolicy(.regular)
        let menu = NSMenu(), application = NSMenuItem(), submenu = NSMenu()
        submenu.addItem(withTitle:"Închide BG3.RO Updater",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q")
        application.submenu = submenu; menu.addItem(application); NSApp.mainMenu = menu
        let window = UpdaterWindow(contentRect:NSRect(x:0,y:0,width:680,height:484),styleMask:[.titled,.fullSizeContentView,.miniaturizable,.closable],backing:.buffered,defer:false)
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.appearance = NSAppearance(named: .darkAqua)
        window.isMovableByWindowBackground = true
        window.title = "BG3.RO Updater"; window.isReleasedWhenClosed = false
        window.backgroundColor = NSColor(srgbRed:11/255,green:12/255,blue:15/255,alpha:1)
        window.isOpaque = true; window.hasShadow = true
        let hosting = UpdaterHostingView(rootView:ContentView(model:model))
        if #available(macOS 13.0, *) { hosting.sizingOptions = [] }
        window.contentView = hosting; window.delegate = self
        // Full-size content includes the native title bar; avoid adding its height below the fixed layout.
        var compactFrame = window.frame
        compactFrame.size = NSSize(width:680,height:472)
        window.setFrame(compactFrame,display:false)
        self.window = window; window.center(); window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(window)
        NSApp.activate(ignoringOtherApps:true)
    }
    func windowShouldClose(_ sender: NSWindow) -> Bool { allowClosing() }
    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply { allowClosing() ? .terminateNow : .terminateCancel }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    private func allowClosing() -> Bool {
        guard model.busy else { return true }
        let alert = NSAlert(); alert.messageText = "Operație în curs"; alert.informativeText = "Așteaptă finalizarea verificării sau actualizării înainte să închizi aplicația."; alert.runModal(); return false
    }
}

// AppKit owns the lifecycle: no placeholder SwiftUI Settings scene or extra window.
@main @MainActor enum BG3ROUpdaterApp {
    static func main() {
        let application = NSApplication.shared
        let delegate = AppDelegate()
        application.delegate = delegate
        withExtendedLifetime(delegate) { application.run() }
    }
}
