// Desktop automation (PowerShell helpers, pywin32/pywinauto, native cursor) is Windows-only.
// Everything else in RuXt works on every platform, so unsupported systems get a clear
// message instead of a crash deep inside a PowerShell call.

export function desktopAutomationSupported(platform = process.platform) {
  return platform === 'win32';
}

export const DESKTOP_UNSUPPORTED_MESSAGE =
  'Desktop automation currently works on Windows only. Chat, agents, the boardroom and the marketplace work on every platform.';

export function requireDesktopAutomation(req, res, next) {
  if (desktopAutomationSupported()) return next();
  res.status(501).json({ success: false, error: DESKTOP_UNSUPPORTED_MESSAGE });
}
