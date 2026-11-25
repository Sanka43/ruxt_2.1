import AppKit
import QuartzCore

final class PopupView: NSView {
  private let neon = NSColor(srgbRed: 0.44, green: 1, blue: 0.20, alpha: 1)
  private let portrait = ProcessInfo.processInfo.environment["LINA_AVATAR_PATH"].flatMap { NSImage(contentsOfFile: $0) }
  private let blenderIcon = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "org.blenderfoundation.blender").map { NSWorkspace.shared.icon(forFile: $0.path) }

  override init(frame: NSRect) {
    super.init(frame: frame)
    wantsLayer = true
    let rim = CAShapeLayer()
    let rect = bounds.insetBy(dx: 2, dy: 2)
    let radius: CGFloat = 20
    rim.path = CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
    rim.fillColor = nil
    rim.strokeColor = neon.cgColor
    rim.lineWidth = 1.8
    rim.lineCap = .round
    let circumference = 2 * (rect.width + rect.height - 4 * radius) + 2 * .pi * radius
    rim.lineDashPattern = [72, NSNumber(value: Double(circumference - 72))]
    rim.shadowColor = neon.cgColor
    rim.shadowRadius = 3
    rim.shadowOpacity = 0.8
    rim.shadowOffset = .zero
    layer?.addSublayer(rim)
    if !NSWorkspace.shared.accessibilityDisplayShouldReduceMotion {
      let travel = CABasicAnimation(keyPath: "lineDashPhase")
      travel.fromValue = 0
      travel.toValue = -circumference
      travel.duration = 6
      travel.repeatCount = .infinity
      rim.add(travel, forKey: "perimeter")
    }
  }

  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

  override func draw(_ dirtyRect: NSRect) {
    let face = NSBezierPath(roundedRect: bounds.insetBy(dx: 2, dy: 2), xRadius: 20, yRadius: 20)
    NSGradient(colors: [NSColor(white: 0.015, alpha: 0.95), NSColor(white: 0.085, alpha: 0.78)])?.draw(in: face, angle: 90)
    neon.withAlphaComponent(0.36).setStroke()
    face.stroke()
    let avatar = NSRect(x: 20, y: 20, width: 52, height: 52)
    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(ovalIn: avatar).addClip()
    portrait?.draw(in: avatar)
    NSGraphicsContext.restoreGraphicsState()
    NSColor.white.withAlphaComponent(0.24).setStroke()
    NSBezierPath(ovalIn: avatar).stroke()
    ("Lina Park" as NSString).draw(at: NSPoint(x: 88, y: 45), withAttributes: [.font: NSFont.systemFont(ofSize: 20, weight: .semibold), .foregroundColor: NSColor.white])
    ("Working in Blender" as NSString).draw(at: NSPoint(x: 88, y: 24), withAttributes: [.font: NSFont.systemFont(ofSize: 13), .foregroundColor: NSColor(white: 0.82, alpha: 1)])
    blenderIcon?.draw(in: NSRect(x: bounds.width - 58, y: 30, width: 32, height: 32))
  }
}

final class PopupController: NSObject {
  private var window: NSWindow?
  private var poll: Timer?

  func start() {
    let win = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 392, height: 92), styleMask: [.borderless], backing: .buffered, defer: false)
    win.isOpaque = false
    win.backgroundColor = .clear
    win.hasShadow = true
    win.level = .floating
    win.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    win.ignoresMouseEvents = true
    let glass = NSVisualEffectView(frame: win.contentView?.bounds ?? .zero)
    glass.material = .hudWindow
    glass.blendingMode = .behindWindow
    glass.state = .active
    glass.wantsLayer = true
    glass.layer?.cornerRadius = 22
    glass.layer?.masksToBounds = true
    glass.layer?.backgroundColor = NSColor(calibratedWhite: 1, alpha: 0.06).cgColor
    glass.layer?.borderColor = NSColor(calibratedWhite: 1, alpha: 0.20).cgColor
    glass.layer?.borderWidth = 1
    let popup = PopupView(frame: glass.bounds)
    popup.autoresizingMask = [.width, .height]
    glass.addSubview(popup)
    win.contentView = glass
    window = win
    poll = Timer.scheduledTimer(withTimeInterval: 0.15, repeats: true) { [weak self] _ in self?.syncToBlender() }
    syncToBlender()
  }

  private func blenderWindow() -> CGRect? {
    guard let front = NSWorkspace.shared.frontmostApplication?.localizedName,
          front.localizedCaseInsensitiveContains("blender") else { return nil }
    let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
    guard let info = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] else { return nil }
    var best: (area: CGFloat, rect: CGRect)?
    for item in info {
      let owner = String(item[kCGWindowOwnerName as String] as? String ?? "")
      let layer = item[kCGWindowLayer as String] as? Int ?? 0
      guard owner.localizedCaseInsensitiveContains("blender"), layer == 0,
            let bounds = item[kCGWindowBounds as String] as? [String: CGFloat] else { continue }
      let rect = CGRect(x: bounds["X"] ?? 0, y: bounds["Y"] ?? 0, width: bounds["Width"] ?? 0, height: bounds["Height"] ?? 0)
      guard rect.width > 300, rect.height > 220 else { continue }
      let area = rect.width * rect.height
      if best == nil || area > best!.area { best = (area, rect) }
    }
    return best?.rect
  }

  private func syncToBlender() {
    guard let win = window else { return }
    guard let bounds = blenderWindow(), let screen = NSScreen.main else { win.orderOut(nil); return }
    let x = bounds.origin.x + (bounds.width - win.frame.width) / 2
    // Lower-third placement inside Blender: deliberately below the center line.
    let y = screen.frame.height - bounds.origin.y - bounds.height + 26
    let target = NSPoint(x: x, y: y)
    let current = win.frame.origin
    if abs(current.x - target.x) > 1 || abs(current.y - target.y) > 1 {
      win.setFrameOrigin(target)
    }
    if !win.isVisible { win.orderFrontRegardless() }
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let controller = PopupController()
controller.start()
signal(SIGTERM) { _ in exit(0) }
signal(SIGINT) { _ in exit(0) }
RunLoop.main.run()
