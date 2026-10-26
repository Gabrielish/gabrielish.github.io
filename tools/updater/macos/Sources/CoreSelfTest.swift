import Foundation
import Darwin

enum CoreSelfTest {
    static func canonicalPath(_ url: URL) -> String {
        guard let resolved = realpath(url.path, nil) else { return url.path }
        defer { free(resolved) }
        return String(cString: resolved)
    }
    static func require(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        if try !condition() { throw UpdaterFailure.message(message) }
    }
    static func run() throws {
        let decimal = try JSONDecoder().decode(ProjectProgress.self, from: Data(#"{"translation_percent":79.61}"#.utf8))
        try require(decimal.translation_percent == 79.61, "Decimal progress rounded")
        try require(UpdaterCore.formatPercent(79.61) == "79.61", "Decimal progress format")
        try require(UpdaterCore.formatPercent(80) == "80", "Integer progress format")
        let work = try UpdaterCore.temporaryWork()
        defer { UpdaterCore.removeWork(work) }
        var release = Release(id:"fixture",version:"v1",title:"Test",download_url:UpdaterCore.knownURL,file_name:"Baldurs_Gate_3_RO_20.10.2026_7933.rar",file_bytes:123,published_at:"2026-10-20T00:00:00Z",platform:"all")
        _ = try UpdaterCore.validate(release)
        for bad in [UpdaterCore.knownURL.replacingOccurrences(of:"https:",with:"http:"),UpdaterCore.knownURL.replacingOccurrences(of:"Gabrielish/bg3ro",with:"other/repository"),UpdaterCore.knownURL+"?secret=x"] {
            release.download_url = bad
            do { _ = try UpdaterCore.validate(release); throw UpdaterFailure.message("Untrusted URL accepted") }
            catch UpdaterFailure.message(let text) { if text == "Untrusted URL accepted" { throw UpdaterFailure.message(text) } }
        }
        release.download_url = UpdaterCore.knownURL; release.platform = "windows"
        do { _ = try UpdaterCore.validate(release); throw UpdaterFailure.message("Windows release accepted") }
        catch UpdaterFailure.message(let text) { if text == "Windows release accepted" { throw UpdaterFailure.message(text) } }
        let app = work.appendingPathComponent("Baldur's Gate 3.app",isDirectory:true)
        let game = GameLocation(app:app)
        try FileManager.default.createDirectory(at:app.appendingPathComponent("Contents/MacOS"),withIntermediateDirectories:true)
        try FileManager.default.createDirectory(at:game.localization,withIntermediateDirectories:true)
        try Data("fixture plist".utf8).write(to:app.appendingPathComponent("Contents/Info.plist"))
        try Data("original fixture".utf8).write(to:game.target)
        let expectedPath = canonicalPath(app)
        try require(try canonicalPath(UpdaterCore.resolveGame(app).app) == expectedPath,"App selection failed")
        try require(try canonicalPath(UpdaterCore.resolveGame(work).app) == expectedPath,"Parent selection failed")
        try require(try canonicalPath(UpdaterCore.resolveGame(game.localization).app) == expectedPath,"Localization selection failed")
        let prepared = work.appendingPathComponent("prepared.pak")
        try Data("LSPKtranslation fixture".utf8).write(to:prepared)
        let hash = try UpdaterCore.hash(prepared)
        let backup = try UpdaterCore.install(game,prepared:prepared,expectedHash:hash,gameRunning:{false})
        try require(try UpdaterCore.hash(game.target) == hash,"Installed hash mismatch")
        try require(try String(contentsOf:backup,encoding:.utf8) == "original fixture","Backup mismatch")
        var settings = Settings()
        settings.installs[app.path] = Receipt(version:"v1",hash:hash,url:UpdaterCore.knownURL)
        try require(try UpdaterCore.local(game,settings:settings).version == "v1","Receipt recognition failed")
        try Data("modified outside updater".utf8).write(to:game.target)
        try require(try UpdaterCore.local(game,settings:settings).version == nil,"Stale receipt accepted")
        do { _ = try UpdaterCore.install(game,prepared:prepared,expectedHash:hash,gameRunning:{true}); throw UpdaterFailure.message("Running-game guard failed") }
        catch UpdaterFailure.message(let text) { if text == "Running-game guard failed" { throw UpdaterFailure.message(text) } }
        try Data("changed prepared file".utf8).write(to:prepared)
        do { _ = try UpdaterCore.install(game,prepared:prepared,expectedHash:hash,gameRunning:{false}); throw UpdaterFailure.message("Tampered file accepted") }
        catch UpdaterFailure.message(let text) { if text == "Tampered file accepted" { throw UpdaterFailure.message(text) } }
        try require(try String(contentsOf:game.target,encoding:.utf8) == "modified outside updater","Failed update changed target")
        let archive = work.appendingPathComponent("translation.tar")
        let archiveFolder = work.appendingPathComponent("archive",isDirectory:true)
        try FileManager.default.createDirectory(at:archiveFolder,withIntermediateDirectories:false)
        try Data("LSPKarchive fixture".utf8).write(to:archiveFolder.appendingPathComponent("English.pak"))
        let process = Process(); process.executableURL = URL(fileURLWithPath:"/usr/bin/tar")
        process.arguments = ["-cf",archive.path,"-C",archiveFolder.path,"English.pak"]
        try process.run(); process.waitUntilExit(); try require(process.terminationStatus == 0,"Cannot create test archive")
        let extracted = work.appendingPathComponent("extracted.pak")
        try require(try UpdaterCore.extract(archive,to:extracted) == UpdaterCore.hash(archiveFolder.appendingPathComponent("English.pak")),"Archive extraction mismatch")
    }
}
