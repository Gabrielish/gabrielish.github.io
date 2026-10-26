import Foundation
import CryptoKit
import Darwin

enum UpdaterFailure: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { return text }; return nil }
}

struct Release: Codable {
    var id: String
    var version: String
    var title: String
    var download_url: String
    var file_name: String
    var file_bytes: Int64
    var published_at: String
    var platform: String
}

struct Receipt: Codable {
    var version: String?
    var hash: String
    var url: String?
}

struct ProjectProgress: Decodable { let translation_percent: Int? }

struct Settings: Codable {
    var gamePath: String?
    var installs: [String: Receipt] = [:]
}

struct GameLocation {
    let app: URL
    var localization: URL { app.appendingPathComponent("Contents/Data/Localization", isDirectory: true) }
    var target: URL { localization.appendingPathComponent("English.pak") }
}

final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

final class ArchiveDownload: NSObject, URLSessionDownloadDelegate {
    private var continuation: CheckedContinuation<Void, Error>?
    private var session: URLSession?
    private let output: URL
    private let expected: Int64
    private let progress: (Double) -> Void
    private var result: Result<Void, Error>?

    init(output: URL, expected: Int64, progress: @escaping (Double) -> Void) {
        self.output = output; self.expected = expected; self.progress = progress
    }

    func run(url: URL) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.continuation = continuation
            let config = URLSessionConfiguration.ephemeral
            config.timeoutIntervalForRequest = 45
            config.timeoutIntervalForResource = 300
            let session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
            self.session = session
            session.downloadTask(with: url).resume()
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64, totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        if totalBytesWritten > expected {
            result = .failure(UpdaterFailure.message("Arhiva depășește dimensiunea publicată."))
            downloadTask.cancel()
            return
        }
        progress(min(1, Double(totalBytesWritten) / Double(expected)))
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        do {
            guard let response = downloadTask.response as? HTTPURLResponse, response.statusCode == 200 else {
                throw UpdaterFailure.message("Arhiva nu poate fi descărcată de pe GitHub.")
            }
            let size = try location.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
            guard Int64(size) == expected else { throw UpdaterFailure.message("Descărcarea este incompletă sau diferă de dimensiunea publicată.") }
            try FileManager.default.moveItem(at: location, to: output)
            result = .success(Void())
        } catch { result = .failure(error) }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let final = result ?? .failure(error ?? UpdaterFailure.message("Descărcarea nu s-a încheiat corect."))
        let pending = continuation; continuation = nil
        session.finishTasksAndInvalidate(); self.session = nil
        pending?.resume(with: final)
    }
}

enum UpdaterCore {
    static let knownHash = "6e874063de11043f5fa28a6f90ab9d5747c59bda80efa5539ffa421c27d0798c"
    static let knownURL = "https://raw.githubusercontent.com/Gabrielish/bg3ro/7c6044094b37ef8c6dd3f69e6016fa2584b60213/Baldur's%20Gate%203%20Romanian%20Translate/Baldurs_Gate_3_RO_20.10.2026_7933.rar"
    static let feed = URL(string: "https://gatkiwcyjgbgjwfgvplm.supabase.co/rest/v1/bg3ro_releases?select=id,version,title,download_url,file_name,file_bytes,published_at,platform&kind=eq.translation&is_visible=eq.true&is_deleted=eq.false&platform=in.(macos,all)&order=published_at.desc,id.desc&limit=1")!
    // Publishable key, identical to the website's public configuration. No account or admin credentials.
    static let publicKey = "sb_publishable_8wgqYScl0lmXs3-x0feaIw_4z7kr4bd"
    static var settingsURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("BG3RO-Updater/settings.json")
    }

    static func loadSettings() -> Settings {
        guard let data = try? Data(contentsOf: settingsURL), let value = try? JSONDecoder().decode(Settings.self, from: data) else { return Settings() }
        return value
    }
    static func saveSettings(_ settings: Settings) throws {
        try FileManager.default.createDirectory(at: settingsURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONEncoder().encode(settings).write(to: settingsURL, options: .atomic)
    }

    static func validate(_ release: Release) throws -> URL {
        guard !release.version.isEmpty, release.version.count <= 80,
              ["all", "macos"].contains(release.platform),
              release.file_bytes > 0, release.file_bytes <= 100 * 1024 * 1024,
              let url = URL(string: release.download_url), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme == "https", parts.host == "raw.githubusercontent.com", parts.port == nil || parts.port == 443,
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              let path = parts.percentEncodedPath.removingPercentEncoding,
              path.range(of: #"^/Gabrielish/bg3ro/[a-fA-F0-9]{40}/Baldur's Gate 3 Romanian Translate/[^/\\]+\.(rar|zip|7z)$"#, options: .regularExpression) != nil,
              url.lastPathComponent == release.file_name else {
            throw UpdaterFailure.message("Arhiva nu corespunde sursei oficiale pentru macOS.")
        }
        return url
    }

    static func latest() async throws -> Release {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 25
        config.timeoutIntervalForResource = 30
        let session = URLSession(configuration: config, delegate: NoRedirect(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        var request = URLRequest(url: feed)
        request.setValue(publicKey, forHTTPHeaderField: "apikey")
        request.setValue("BG3RO-Updater-macOS/1.0", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await session.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200, data.count <= 100_000 else { throw UpdaterFailure.message("Nu pot verifica versiunea publicată.") }
        guard let release = try JSONDecoder().decode([Release].self, from: data).first else { throw UpdaterFailure.message("Nu există o versiune macOS publicată.") }
        _ = try validate(release)
        return release
    }

    static func translationProgress() async throws -> Int? {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 8; config.timeoutIntervalForResource = 8
        let session = URLSession(configuration: config, delegate: NoRedirect(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        let url = URL(string: "https://gatkiwcyjgbgjwfgvplm.supabase.co/rest/v1/bg3ro_about_sections?select=translation_percent&id=eq.progress&kind=eq.progress&is_visible=eq.true&limit=1")!
        var request = URLRequest(url: url)
        request.setValue(publicKey, forHTTPHeaderField: "apikey")
        let (data, response) = try await session.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200, data.count <= 10_000 else { return nil }
        let rows = try JSONDecoder().decode([ProjectProgress].self, from: data)
        guard rows.count == 1, let value = rows.first?.translation_percent, (0...100).contains(value) else { return nil }
        return value
    }

    static func hash(_ file: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: file)
        defer { try? handle.close() }
        var sha = SHA256()
        while let chunk = try handle.read(upToCount: 1_048_576), !chunk.isEmpty { sha.update(data: chunk) }
        return sha.finalize().map { String(format: "%02x", $0) }.joined()
    }

    static func noLink(_ file: URL) throws {
        if (try? file.resourceValues(forKeys: [.isSymbolicLinkKey]).isSymbolicLink) == true {
            throw UpdaterFailure.message("Fișierul sau folderul selectat este o legătură simbolică. Alege locația reală a jocului.")
        }
    }

    static func resolveGame(_ chosen: URL) throws -> GameLocation {
        let selected = chosen.standardizedFileURL.resolvingSymlinksInPath()
        var candidates: [URL] = []
        if selected.pathExtension.lowercased() == "app" { candidates.append(selected) }
        if selected.lastPathComponent == "Localization" {
            candidates.append(selected.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent())
        }
        if let children = try? FileManager.default.contentsOfDirectory(at: selected, includingPropertiesForKeys: nil) {
            candidates.append(contentsOf: children.filter { $0.pathExtension.lowercased() == "app" && $0.lastPathComponent.lowercased().contains("baldur") })
        }
        for candidate in candidates {
            let game = GameLocation(app: candidate)
            var directory: ObjCBool = false
            guard candidate.pathExtension.lowercased() == "app",
                  FileManager.default.fileExists(atPath: candidate.appendingPathComponent("Contents/MacOS").path, isDirectory: &directory), directory.boolValue,
                  FileManager.default.fileExists(atPath: candidate.appendingPathComponent("Contents/Info.plist").path),
                  FileManager.default.fileExists(atPath: game.target.path) else { continue }
            try noLink(game.target)
            return game
        }
        throw UpdaterFailure.message("Alege Baldur's Gate 3.app, folderul care o conține sau Contents/Data/Localization cu English.pak existent.")
    }

    static func detectGame() -> GameLocation? {
        let steam = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/Steam")
        var roots = [steam]
        if let text = try? String(contentsOf: steam.appendingPathComponent("steamapps/libraryfolders.vdf"), encoding: .utf8),
           let regex = try? NSRegularExpression(pattern: #""path"\s+"([^"]+)""#) {
            let ns = text as NSString
            for match in regex.matches(in: text, range: NSRange(location: 0, length: ns.length)) {
                roots.append(URL(fileURLWithPath: ns.substring(with: match.range(at: 1)).replacingOccurrences(of: "\\\\", with: "\\")))
            }
        }
        for root in roots {
            if let game = try? resolveGame(root.appendingPathComponent("steamapps/common/Baldurs Gate 3")) { return game }
        }
        return nil
    }

    static func local(_ game: GameLocation, settings: Settings) throws -> Receipt {
        let currentHash = try hash(game.target)
        if let receipt = settings.installs[game.app.path], receipt.hash == currentHash { return receipt }
        return Receipt(version: currentHash == knownHash ? "v0.7.9" : nil, hash: currentHash, url: currentHash == knownHash ? knownURL : nil)
    }

    static func temporaryWork() throws -> URL {
        let url = FileManager.default.temporaryDirectory.resolvingSymlinksInPath().appendingPathComponent("BG3RO-Updater-" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: false)
        return url
    }
    static func removeWork(_ work: URL) {
        let temp = FileManager.default.temporaryDirectory.resolvingSymlinksInPath()
        guard work.deletingLastPathComponent().standardizedFileURL == temp.standardizedFileURL,
              work.lastPathComponent.hasPrefix("BG3RO-Updater-") else { return }
        try? FileManager.default.removeItem(at: work)
    }

    private static func tar(_ archive: URL, arguments: [String], output: URL?) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/tar")
        process.arguments = arguments + [archive.path] + (output == nil ? [] : ["--", "English.pak"])
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        try process.run()
        let deadline = DispatchWorkItem { if process.isRunning { process.terminate() } }
        DispatchQueue.global().asyncAfter(deadline: .now() + 90, execute: deadline)
        defer { deadline.cancel(); if process.isRunning { process.terminate() } }
        let target: FileHandle?
        if let file = output {
            guard FileManager.default.createFile(atPath: file.path, contents: nil) else { throw UpdaterFailure.message("Nu pot crea fișierul temporar.") }
            target = try FileHandle(forWritingTo: file)
        } else { target = nil }
        defer { try? target?.close(); try? pipe.fileHandleForReading.close() }
        var data = Data(), total = 0
        while let chunk = try pipe.fileHandleForReading.read(upToCount: 65_536), !chunk.isEmpty {
            total += chunk.count
            guard total <= (output == nil ? 100_000 : 512 * 1024 * 1024) else { throw UpdaterFailure.message("Arhiva depășește limita permisă.") }
            if let target = target { try target.write(contentsOf: chunk) } else { data.append(chunk) }
        }
        process.waitUntilExit()
        guard process.terminationStatus == 0 else { throw UpdaterFailure.message("Arhiva nu poate fi extrasă de această versiune de macOS.") }
        return String(data: data, encoding: .utf8) ?? ""
    }

    static func extract(_ archive: URL, to pak: URL) throws -> String {
        let listing = try tar(archive, arguments: ["-tf"], output: nil)
        let entries = listing.split(whereSeparator: \.isNewline).filter { $0 == "English.pak" }
        guard entries.count == 1 else { throw UpdaterFailure.message("Arhiva trebuie să conțină un singur English.pak la rădăcină.") }
        _ = try tar(archive, arguments: ["-xOf"], output: pak)
        let file = try FileHandle(forReadingFrom: pak)
        defer { try? file.close() }
        guard try file.read(upToCount: 4) == Data("LSPK".utf8), (try pak.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0) >= 16 else { throw UpdaterFailure.message("English.pak nu este un pachet valid Baldur's Gate 3.") }
        return try hash(pak)
    }

    static func install(_ game: GameLocation, prepared: URL, expectedHash: String, gameRunning: () -> Bool) throws -> URL {
        let verified = try resolveGame(game.app)
        guard !gameRunning() else { throw UpdaterFailure.message("Închide Baldur's Gate 3 înainte de actualizare.") }
        guard try hash(prepared) == expectedHash else { throw UpdaterFailure.message("Fișierul pregătit s-a modificat. Reia actualizarea.") }
        let backupFolder = verified.localization.appendingPathComponent("BG3RO-Backups", isDirectory: true)
        try noLink(backupFolder)
        try FileManager.default.createDirectory(at: backupFolder, withIntermediateDirectories: true)
        let suffix = UUID().uuidString
        let backup = backupFolder.appendingPathComponent("English-\(suffix).pak")
        let staged = verified.localization.appendingPathComponent(".bg3ro-\(suffix).tmp")
        defer { try? FileManager.default.removeItem(at: staged) }
        try FileManager.default.copyItem(at: prepared, to: staged)
        guard try hash(staged) == expectedHash else { throw UpdaterFailure.message("Verificarea copiei pregătite a eșuat.") }
        guard !gameRunning() else { throw UpdaterFailure.message("Jocul a fost pornit. Închide-l și reia actualizarea.") }
        try noLink(verified.target)
        try FileManager.default.copyItem(at: verified.target, to: backup)
        // Both paths are on the game's volume. POSIX rename replaces English.pak atomically.
        guard Darwin.rename(staged.path, verified.target.path) == 0 else { throw UpdaterFailure.message("Nu pot înlocui English.pak. Verifică permisiunile folderului jocului.") }
        return backup
    }
}
