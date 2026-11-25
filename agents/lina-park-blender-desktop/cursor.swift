import AppKit

// A click-through ring follows the system pointer only while Blender is active.
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let ring = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 32, height: 32),
                   styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
ring.isOpaque = false
ring.backgroundColor = .clear
ring.ignoresMouseEvents = true
ring.level = .floating
ring.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
ring.contentView?.wantsLayer = true
ring.contentView?.layer?.cornerRadius = 16
ring.contentView?.layer?.borderWidth = 3
ring.contentView?.layer?.borderColor = NSColor.systemOrange.cgColor
let parent = getppid()
var phase: CGFloat = 0
let timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { _ in
    if getppid() != parent { app.terminate(nil); return }
    guard NSWorkspace.shared.frontmostApplication?.bundleIdentifier?.lowercased() == "org.blenderfoundation.blender" else {
        ring.orderOut(nil)
        return
    }
    let point = NSEvent.mouseLocation
    phase += 0.12
    let offset = CGFloat(4.0)
    ring.setFrameOrigin(NSPoint(x: point.x - 16 + cos(phase) * offset, y: point.y - 16 + sin(phase) * offset))
    if !ring.isVisible { ring.orderFrontRegardless() }
}
app.run()
