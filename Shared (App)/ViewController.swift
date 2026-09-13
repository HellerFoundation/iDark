//
//  ViewController.swift
//  Shared (App)
//
//  Created by Dan on 9/9/26.
//

import WebKit
import SafariServices

#if os(iOS)
import UIKit
typealias PlatformViewController = UIViewController
#elseif os(macOS)
import Cocoa
typealias PlatformViewController = NSViewController
#endif

let extensionBundleIdentifier = "com.HellerFoundation.iDark.Extension"

class ViewController: PlatformViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self

#if os(iOS)
        self.webView.scrollView.isScrollEnabled = false
        self.webView.backgroundColor = .black
        self.webView.scrollView.backgroundColor = .black
        self.webView.underPageBackgroundColor = .black
#endif

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

#if os(iOS)
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        refreshExtensionState()
    }

    private func refreshExtensionState() {
        guard #available(iOS 26.2, *) else {
            // Extension state detection isn't available on this OS;
            // the screen stays on the neutral instructions until the
            // user enables the extension via the button below.
            return
        }

        SFSafariExtensionManager.getStateOfExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                return
            }

            DispatchQueue.main.async {
                self.webView.evaluateJavaScript("show('ios', \(state.isEnabled))")
            }
        }
    }
#endif

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
#if os(iOS)
        webView.evaluateJavaScript("show('ios')")
        refreshExtensionState()
#elseif os(macOS)
        webView.evaluateJavaScript("show('mac')")

        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else {
                // Insert code to inform the user that something went wrong.
                return
            }

            DispatchQueue.main.async {
                if #available(macOS 13, *) {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), true)")
                } else {
                    webView.evaluateJavaScript("show('mac', \(state.isEnabled), false)")
                }
            }
        }
#endif
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? String else {
            return
        }

#if os(macOS)
        if body == "open-preferences" {
            SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
                guard error == nil else {
                    // Insert code to inform the user that something went wrong.
                    return
                }

                DispatchQueue.main.async {
                    NSApp.terminate(self)
                }
            }
        }
#elseif os(iOS)
        if body == "open-settings" {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        }
#endif
    }

}
