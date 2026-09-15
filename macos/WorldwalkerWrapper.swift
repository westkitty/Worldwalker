import Cocoa
import WebKit

private let projectRoot = "/Users/andrew/Worldwalker"
private let appURL = URL(string: "http://127.0.0.1:5179")!
private let healthURL = URL(string: "http://127.0.0.1:5179/api/health")!

final class WorldwalkerAppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var statusLabel: NSTextField!
    private var runeLabel: NSTextField!
    private var serverProcess: Process?
    private var logHandle: FileHandle?
    private var attempts = 0
    private var didSpawnServer = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        buildWindow()
        checkOrStartServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        if didSpawnServer, let process = serverProcess, process.isRunning {
            process.terminate()
        }
        try? logHandle?.close()
    }

    private func buildMenu() {
        let mainMenu = NSMenu()

        // Worldwalker App Menu
        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu(title: "Worldwalker")
        appMenuItem.submenu = appMenu

        let aboutItem = NSMenuItem(title: "About Worldwalker", action: #selector(showAbout), keyEquivalent: "")
        let hideItem = NSMenuItem(title: "Hide Worldwalker", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthersItem = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "H")
        let showAllItem = NSMenuItem(title: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        let quitItem = NSMenuItem(title: "Quit Worldwalker", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        appMenu.addItem(aboutItem)
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(hideItem)
        appMenu.addItem(hideOthersItem)
        appMenu.addItem(showAllItem)
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(quitItem)
        mainMenu.addItem(appMenuItem)

        // File Menu
        let fileMenuItem = NSMenuItem()
        let fileMenu = NSMenu(title: "File")
        fileMenuItem.submenu = fileMenu
        let closeItem = NSMenuItem(title: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        fileMenu.addItem(closeItem)
        mainMenu.addItem(fileMenuItem)

        // Edit Menu (Standard Cocoa text shortcuts)
        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu
        editMenu.addItem(NSMenuItem(title: "Undo", action: #selector(UndoManager.undo), keyEquivalent: "z"))
        editMenu.addItem(NSMenuItem(title: "Redo", action: #selector(UndoManager.redo), keyEquivalent: "Z"))
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(NSMenuItem(title: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x"))
        editMenu.addItem(NSMenuItem(title: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c"))
        editMenu.addItem(NSMenuItem(title: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v"))
        editMenu.addItem(NSMenuItem(title: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"))
        mainMenu.addItem(editMenuItem)

        // View Menu
        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu
        let reloadItem = NSMenuItem(title: "Reload Worldwalker", action: #selector(reloadApp), keyEquivalent: "r")
        let fullScreenItem = NSMenuItem(title: "Toggle Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fullScreenItem.keyEquivalentModifierMask = [.command, .control]
        viewMenu.addItem(reloadItem)
        viewMenu.addItem(NSMenuItem.separator())
        viewMenu.addItem(fullScreenItem)
        mainMenu.addItem(viewMenuItem)

        // Window Menu
        let windowMenuItem = NSMenuItem()
        let windowMenu = NSMenu(title: "Window")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(NSMenuItem(title: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m"))
        windowMenu.addItem(NSMenuItem(title: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: ""))
        mainMenu.addItem(windowMenuItem)

        NSApp.mainMenu = mainMenu
    }

    private func buildWindow() {
        let frame = NSRect(x: 0, y: 0, width: 1200, height: 750)
        window = NSWindow(
            contentRect: frame,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Worldwalker"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.center()
        window.minSize = NSSize(width: 960, height: 600)
        window.backgroundColor = NSColor(red: 7/255.0, green: 9/255.0, blue: 13/255.0, alpha: 1.0)
        window.appearance = NSAppearance(named: .darkAqua)

        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        webView = WKWebView(frame: frame, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground") // Let window dark color show
        webView.alphaValue = 0

        // Loading Container
        let container = NSView(frame: frame)
        container.autoresizingMask = [.width, .height]
        container.wantsLayer = true
        container.layer?.backgroundColor = CGColor(red: 7/255.0, green: 9/255.0, blue: 13/255.0, alpha: 1.0)

        runeLabel = NSTextField(labelWithString: "✦")
        runeLabel.alignment = .center
        runeLabel.font = NSFont.systemFont(ofSize: 52, weight: .bold)
        runeLabel.textColor = NSColor(red: 72/255.0, green: 183/255.0, blue: 232/255.0, alpha: 1.0)
        runeLabel.frame = NSRect(x: (frame.width - 200)/2, y: frame.height/2 + 20, width: 200, height: 70)
        runeLabel.autoresizingMask = [.minXMargin, .maxXMargin, .minYMargin, .maxYMargin]

        statusLabel = NSTextField(labelWithString: "WAKING WORLDWALKER...")
        statusLabel.alignment = .center
        statusLabel.font = NSFont(name: "Georgia-Bold", size: 16) ?? NSFont.systemFont(ofSize: 16, weight: .semibold)
        statusLabel.textColor = NSColor(red: 246/255.0, green: 198/255.0, blue: 91/255.0, alpha: 1.0)
        statusLabel.frame = NSRect(x: (frame.width - 400)/2, y: frame.height/2 - 40, width: 400, height: 32)
        statusLabel.autoresizingMask = [.minXMargin, .maxXMargin, .minYMargin, .maxYMargin]

        container.addSubview(webView)
        container.addSubview(runeLabel)
        container.addSubview(statusLabel)

        window.contentView = container
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private lazy var localSession: URLSession = {
        let config = URLSessionConfiguration.default
        config.connectionProxyDictionary = [:] // Bypass system proxy for loopback health checks
        return URLSession(configuration: config)
    }()

    private func checkOrStartServer() {
        var request = URLRequest(url: healthURL)
        request.timeoutInterval = 0.8

        localSession.dataTask(with: request) { [weak self] _, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                DispatchQueue.main.async {
                    self?.loadApp()
                }
            } else {
                DispatchQueue.main.async {
                    self?.startServerAndPoll()
                }
            }
        }.resume()
    }

    private func startServerAndPoll() {
        let nodePath = findNodeExecutable()
        let serverScript = "\(projectRoot)/server.mjs"
        let logPath = "/tmp/worldwalker-server.log"

        FileManager.default.createFile(atPath: logPath, contents: nil)
        logHandle = try? FileHandle(forWritingTo: URL(fileURLWithPath: logPath))
        _ = try? logHandle?.seekToEnd()

        var env = ProcessInfo.processInfo.environment
        env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:\(env["PATH"] ?? "")"
        env["PORT"] = "5179"
        env["HOST"] = "127.0.0.1"

        let process = Process()
        process.executableURL = URL(fileURLWithPath: nodePath)
        process.arguments = [serverScript]
        process.currentDirectoryURL = URL(fileURLWithPath: projectRoot)
        process.environment = env
        process.standardOutput = logHandle ?? FileHandle.nullDevice
        process.standardError = logHandle ?? FileHandle.nullDevice

        do {
            try process.run()
            self.serverProcess = process
            self.didSpawnServer = true
            waitForServer()
        } catch {
            statusLabel.stringValue = "Failed to launch server: \(error.localizedDescription)"
            statusLabel.textColor = .systemRed
        }
    }

    private func findNodeExecutable() -> String {
        let candidates = [
            "/opt/homebrew/bin/node",
            "/usr/local/bin/node",
            "/usr/bin/node"
        ]
        for path in candidates {
            if FileManager.default.isExecutableFile(atPath: path) {
                return path
            }
        }
        return "/opt/homebrew/bin/node"
    }

    private func waitForServer() {
        attempts += 1
        var request = URLRequest(url: healthURL)
        request.timeoutInterval = 0.5

        localSession.dataTask(with: request) { [weak self] _, response, _ in
            guard let self = self else { return }
            if let http = response as? HTTPURLResponse, http.statusCode == 200 {
                DispatchQueue.main.async {
                    self.loadApp()
                }
            } else {
                if self.attempts >= 60 {
                    DispatchQueue.main.async {
                        self.statusLabel.stringValue = "Server startup timed out. Check /tmp/worldwalker-server.log"
                        self.statusLabel.textColor = .systemRed
                    }
                    return
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) {
                    self.waitForServer()
                }
            }
        }.resume()
    }

    private func loadApp() {
        runeLabel.removeFromSuperview()
        statusLabel.removeFromSuperview()

        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.25
            self.webView.animator().alphaValue = 1.0
        }

        webView.load(URLRequest(url: appURL))
        window.makeFirstResponder(webView)
    }

    @objc private func reloadApp() {
        webView.reload()
    }

    @objc private func showAbout() {
        let alert = NSAlert()
        alert.messageText = "Worldwalker"
        alert.informativeText = "A realm made from living projects.\nVersion 0.29.0\nRunning locally on macOS."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

    // Open external links in default browser
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            NSWorkspace.shared.open(url)
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.host == "127.0.0.1" || url.host == "localhost" {
            decisionHandler(.allow)
        } else {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        }
    }
}

let app = NSApplication.shared
let delegate = WorldwalkerAppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
