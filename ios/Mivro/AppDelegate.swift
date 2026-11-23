import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  // Kept with the UIScene life cycle: React Native still sends `window` to the
  // app delegate without checking it responds (RCTLogBoxView.mm:87, on dealloc),
  // so removing it crashes Debug builds when the LogBox inspector closes.
  // SceneDelegate assigns it.
  var window: UIWindow?
  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  // Set by the first startReactNative call, which creates the React Native
  // host. Tracked here because RCTRootViewFactory.reactHost is typed with a
  // forward-declared class (RCTHost) that Swift does not import.
  var hasStartedReactNative = false

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    // [MODIFIED] iOS 27 SDK: the window and the React Native start moved to
    // SceneDelegate, since apps built with this SDK fail to launch without the
    // UIScene life cycle.
    return true
  }

  // [ADDED] iOS 27 SDK — UIScene life cycle: every scene uses the configuration
  // declared in Info.plist (UIApplicationSceneManifest).
  func application(
    _ application: UIApplication,
    configurationForConnecting connectingSceneSession: UISceneSession,
    options: UIScene.ConnectionOptions
  ) -> UISceneConfiguration {
    UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
  }
}

// [ADDED] iOS 27 SDK — UIScene life cycle. Kept in this file so that the Xcode
// project needs no new file reference.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard
      let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    // Read before appDelegate.window is replaced: on a reconnected scene, the
    // previous window still holds the running React Native root view.
    let previousWindow = appDelegate.window
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    // UIKit may disconnect a background scene and reconnect it later while the
    // process, and thus the React Native host, is still alive. The host then
    // ignores new launch options (RCTRootViewFactory.mm, createReactHostIfNeeded
    // returns early), so it must be checked before starting.
    let hostAlreadyRunning = appDelegate.hasStartedReactNative
    let deepLink = connectionOptions.urlContexts.first?.url

    // Reconnected scene: move the existing root view controller to the new
    // window instead of mounting a second Mivro surface. A second surface would
    // mount a new NavigationContainer, whose Linking.getInitialURL() returns the
    // link of the very first launch (the host keeps its launch options for its
    // whole life), and would reopen that old session. The mounted
    // NavigationContainer keeps its 'url' listener, so the new link is then
    // delivered like a warm one.
    if hostAlreadyRunning, let previousWindow,
       let rootViewController = previousWindow.rootViewController {
      previousWindow.rootViewController = nil
      window.rootViewController = rootViewController
      window.makeKeyAndVisible()
      if let url = deepLink {
        RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
      }
      return
    }

    // With scenes, a cold-start deep link (mivro://session/{id}) arrives in the
    // connection options instead of the app launch options. Passing it as the
    // .url launch option keeps Linking.getInitialURL() working, since
    // RCTLinkingManager reads it from there.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = deepLink, !hostAlreadyRunning {
      launchOptions[.url] = url
    }

    factory.startReactNative(
      withModuleName: "Mivro", // [MODIFIED] MidPoint → Mivro
      in: window,
      launchOptions: launchOptions
    )
    appDelegate.hasStartedReactNative = true

    // Fallback, not expected: the host runs but no previous root view controller
    // was found, so a new surface was mounted. Deliver the link as the Linking
    // 'url' event; it is only received if a JS listener is registered when it
    // fires.
    if let url = deepLink, hostAlreadyRunning {
      RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
    }
  }

  // A deep link opened while the app runs reaches the scene, not the app
  // delegate: forward it to React Native's Linking 'url' event.
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
