param (
    [string]$Action,
    [int]$TargetX = 0,
    [int]$TargetY = 0,
    [int]$StartX = 0,
    [int]$StartY = 0,
    [int]$DurationMs = 400,
    [string]$Button = "left",
    [string]$Text = "",
    [string]$TextBase64 = "",
    [int]$TypeDelayMs = 20,
    [string]$ProcessName = "",
    [string]$TargetArgs = "",
    [string]$OutFile = "",
    [string]$Key = "",
    [string]$Modifier = "",
    [int]$ScrollAmount = -120
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not [string]::IsNullOrEmpty($TextBase64)) {
    try {
        $bytes = [System.Convert]::FromBase64String($TextBase64)
        $Text = [System.Text.Encoding]::UTF8.GetString($bytes)
    } catch {}
}

$csharpCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Collections.Generic;

[ComImport]
[Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObj {}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
    int NotImpl1();
    [PreserveSig]
    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
    [PreserveSig]
    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
}

[Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioMeterInformation {
    [PreserveSig]
    int GetPeakValue(out float pfPeak);
}

public class WinDesktopEngine {
    // Desktop station switching
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    // Process creation with specific desktop
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct STARTUPINFO {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public int dwProcessId;
        public int dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation
    );

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    // Window enumeration and management
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

    // Mouse & Screen
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int nIndex);

    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();

    [DllImport("user32.dll")]
    public static extern IntPtr GetWindowDC(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern IntPtr ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [DllImport("gdi32.dll")]
    public static extern bool BitBlt(IntPtr hObject, int nXDest, int nYDest, int nWidth, int nHeight, IntPtr hObjectSource, int nXSrc, int nYSrc, int dwRop);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    // Keyboard SendInput
    [StructLayout(LayoutKind.Sequential)]
    public struct INPUT {
        public uint type;
        public InputUnion u;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion {
        [FieldOffset(0)]
        public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    public const uint INPUT_KEYBOARD = 1;
    public const uint KEYEVENTF_KEYUP = 0x0002;
    public const uint KEYEVENTF_UNICODE = 0x0004;

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    public const uint MOUSEEVENTF_WHEEL = 0x0800;

    public const int SM_CXSCREEN = 0;
    public const int SM_CYSCREEN = 1;
    public const int SRCCOPY = 0x00CC0020;

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    public static int LaunchProcess(string commandLine) {
        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(si);
        si.lpDesktop = @"WinSta0\Default";
        si.dwFlags = 1; // STARTF_USESHOWWINDOW
        si.wShowWindow = 5; // SW_SHOW

        PROCESS_INFORMATION pi = new PROCESS_INFORMATION();
        bool ok = CreateProcess(null, commandLine, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, null, ref si, out pi);
        if (ok) {
            CloseHandle(pi.hProcess);
            CloseHandle(pi.hThread);
            return pi.dwProcessId;
        }
        return -Marshal.GetLastWin32Error();
    }

    public static bool CaptureScreen(string outFile) {
        bool ok = false;
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) {
                CloseDesktop(hDesk);
                return;
            }

            try {
                int width = GetSystemMetrics(SM_CXSCREEN);
                int height = GetSystemMetrics(SM_CYSCREEN);

                using (Bitmap bmp = new Bitmap(width, height)) {
                    using (Graphics g = Graphics.FromImage(bmp)) {
                        g.CopyFromScreen(0, 0, 0, 0, new Size(width, height), CopyPixelOperation.SourceCopy);
                    }
                    bmp.Save(outFile, ImageFormat.Jpeg);
                    ok = true;
                }
            } catch {
                try {
                    int width = GetSystemMetrics(SM_CXSCREEN);
                    int height = GetSystemMetrics(SM_CYSCREEN);
                    IntPtr desk = GetDesktopWindow();
                    IntPtr hdcSrc = GetWindowDC(desk);
                    using (Bitmap bmp = new Bitmap(width, height)) {
                        using (Graphics g = Graphics.FromImage(bmp)) {
                            IntPtr hdcDest = g.GetHdc();
                            BitBlt(hdcDest, 0, 0, width, height, hdcSrc, 0, 0, SRCCOPY);
                            g.ReleaseHdc(hdcDest);
                        }
                        ReleaseDC(desk, hdcSrc);
                        bmp.Save(outFile, ImageFormat.Jpeg);
                        ok = true;
                    }
                } catch {}
            } finally {
                CloseDesktop(hDesk);
            }
        });
        t.Start();
        t.Join();
        return ok;
    }

    public static bool FocusTarget(string nameOrTitle) {
        bool focused = false;
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }

            string q = (nameOrTitle ?? "").Trim().ToLower();

            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                if (IsWindowVisible(hWnd)) {
                    int len = GetWindowTextLength(hWnd);
                    StringBuilder sbTitle = new StringBuilder(len + 1);
                    if (len > 0) GetWindowText(hWnd, sbTitle, sbTitle.Capacity);
                    string title = sbTitle.ToString().ToLower();

                    StringBuilder sbClass = new StringBuilder(256);
                    GetClassName(hWnd, sbClass, 256);
                    string cls = sbClass.ToString().ToLower();

                    bool match = false;
                    if (q == "notepad" && (cls.Contains("notepad") || title.Contains("notepad") || title.Contains("untitled") || cls.Contains("applicationframehost"))) match = true;
                    else if (q == "chrome" && (cls.Contains("chrome") || title.Contains("chrome"))) match = true;
                    else if (q == "youtube" && (title.Contains("youtube") || title.Contains("results?search_query"))) match = true;
                    else if (q == "calc" || q == "calculator") {
                        if (cls.Contains("calc") || title.Contains("calculator") || title.Contains("calc")) match = true;
                    } else if (title.Contains(q) || cls.Contains(q)) {
                        match = true;
                    }

                    if (match) {
                        keybd_event(0x12, 0, 0, 0); // ALT key down
                        keybd_event(0x12, 0, 2, 0); // ALT key up
                        ShowWindow(hWnd, 9); // SW_RESTORE
                        SetForegroundWindow(hWnd);
                        focused = true;
                        return false; // Found
                    }
                }
                return true;
            }, IntPtr.Zero);

            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        });
        t.Start();
        t.Join();
        return focused;
    }

    public static string GetWindowRectString(string nameOrTitle) {
        string res = "WARN:NOT_FOUND";
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }

            string q = (nameOrTitle ?? "").Trim().ToLower();

            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                if (IsWindowVisible(hWnd)) {
                    int len = GetWindowTextLength(hWnd);
                    StringBuilder sbTitle = new StringBuilder(len + 1);
                    if (len > 0) GetWindowText(hWnd, sbTitle, sbTitle.Capacity);
                    string title = sbTitle.ToString();
                    string tLower = title.ToLower();

                    StringBuilder sbClass = new StringBuilder(256);
                    GetClassName(hWnd, sbClass, 256);
                    string cls = sbClass.ToString().ToLower();

                    bool match = false;
                    if (q == "notepad" && (cls.Contains("notepad") || tLower.Contains("notepad") || tLower.Contains("untitled") || cls.Contains("applicationframehost"))) match = true;
                    else if (q == "chrome" && (cls.Contains("chrome") || tLower.Contains("chrome"))) match = true;
                    else if (tLower.Contains(q) || cls.Contains(q)) match = true;

                    if (match) {
                        RECT r;
                        if (GetWindowRect(hWnd, out r)) {
                            int w = r.Right - r.Left;
                            int h = r.Bottom - r.Top;
                            int cx = r.Left + (w / 2);
                            int cy = r.Top + (h / 2);
                            res = "OK:RECT:" + r.Left + "," + r.Top + "," + w + "," + h + ":CENTER:" + cx + "," + cy + ":TITLE:" + title;
                            return false;
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);

            if (hDesk != IntPtr.Zero) CloseDesktop(hDesk);
        });
        t.Start();
        t.Join();
        return res;
    }

    public static string GetAllVisibleWindows() {
        StringBuilder sb = new StringBuilder();
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) { CloseDesktop(hDesk); return; }

            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                if (IsWindowVisible(hWnd)) {
                    int len = GetWindowTextLength(hWnd);
                    StringBuilder sbTitle = new StringBuilder(len + 1);
                    if (len > 0) GetWindowText(hWnd, sbTitle, sbTitle.Capacity);
                    string title = sbTitle.ToString().Trim();

                    if (!string.IsNullOrEmpty(title) && title != "Program Manager" && title != "Windows Input Experience") {
                        RECT r;
                        if (GetWindowRect(hWnd, out r)) {
                            int w = r.Right - r.Left;
                            int h = r.Bottom - r.Top;
                            if (w > 30 && h > 30) {
                                StringBuilder sbClass = new StringBuilder(256);
                                GetClassName(hWnd, sbClass, 256);
                                sb.AppendLine(hWnd + "|" + sbClass.ToString() + "|" + r.Left + "," + r.Top + "," + w + "," + h + "|" + title);
                            }
                        }
                    }
                }
                return true;
            }, IntPtr.Zero);

            CloseDesktop(hDesk);
        });
        t.Start();
        t.Join();
        return sb.ToString();
    }

    public static string GetActiveWindowInfo() {
        IntPtr hwnd = GetForegroundWindow();
        if (hwnd == IntPtr.Zero) return "WARN:NO_ACTIVE_WINDOW";
        int len = GetWindowTextLength(hwnd);
        StringBuilder sbTitle = new StringBuilder(len + 1);
        if (len > 0) GetWindowText(hwnd, sbTitle, sbTitle.Capacity);
        StringBuilder sbCls = new StringBuilder(256);
        GetClassName(hwnd, sbCls, 256);
        return "OK:ACTIVE_WINDOW:HWND=" + hwnd + "|CLASS=" + sbCls.ToString() + "|TITLE=" + sbTitle.ToString();
    }

    public static bool MoveMouseSmooth(int targetX, int targetY, int durationMs) {
        bool ok = false;
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) {
                CloseDesktop(hDesk);
                return;
            }

            POINT p;
            GetCursorPos(out p);
            int startX = p.X;
            int startY = p.Y;

            int steps = Math.Max(12, Math.Min(40, durationMs / 16));
            int sleepTime = Math.Max(6, durationMs / steps);

            for (int i = 1; i <= steps; i++) {
                float progress = (float)i / (float)steps;
                float ease = progress < 0.5f ? 2f * progress * progress : -1f + (4f - 2f * progress) * progress;
                int curX = (int)Math.Round(startX + (targetX - startX) * ease);
                int curY = (int)Math.Round(startY + (targetY - startY) * ease);
                SetCursorPos(curX, curY);
                Thread.Sleep(sleepTime);
            }
            SetCursorPos(targetX, targetY);
            ok = true;
            CloseDesktop(hDesk);
        });
        t.Start();
        t.Join();
        return ok;
    }

    public static bool Drag(int startX, int startY, int targetX, int targetY, int durationMs) {
        SetCursorPos(startX, startY);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
        Thread.Sleep(50);
        MoveMouseSmooth(targetX, targetY, durationMs);
        Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        return true;
    }

    public static void Click(string button) {
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) {
                CloseDesktop(hDesk);
                return;
            }

            if (button == "right") {
                mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0);
                Thread.Sleep(60);
                mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0);
            } else if (button == "double") {
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                Thread.Sleep(50);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
                Thread.Sleep(80);
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                Thread.Sleep(50);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
            } else {
                mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
                Thread.Sleep(60);
                mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
            }

            CloseDesktop(hDesk);
        });
        t.Start();
        t.Join();
    }

    public static void Scroll(int amount) {
        mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)amount, 0);
    }

    public static void TypeTextUnicode(string text, int delayMs) {
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) {
                CloseDesktop(hDesk);
                return;
            }

            int sz = Marshal.SizeOf(typeof(INPUT));
            foreach (char c in text) {
                if (c == '\r') continue;
                if (c == '\n') {
                    INPUT[] enter = new INPUT[2];
                    enter[0].type = INPUT_KEYBOARD;
                    enter[0].u.ki.wVk = 0x0D;
                    enter[1].type = INPUT_KEYBOARD;
                    enter[1].u.ki.wVk = 0x0D;
                    enter[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
                    SendInput(2, enter, sz);
                    Thread.Sleep(Math.Max(25, delayMs));
                    continue;
                }

                INPUT[] inputs = new INPUT[2];
                inputs[0].type = INPUT_KEYBOARD;
                inputs[0].u.ki.wScan = (ushort)c;
                inputs[0].u.ki.dwFlags = KEYEVENTF_UNICODE;

                inputs[1].type = INPUT_KEYBOARD;
                inputs[1].u.ki.wScan = (ushort)c;
                inputs[1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;

                SendInput(2, inputs, sz);
                if (delayMs > 0) Thread.Sleep(delayMs);
            }

            CloseDesktop(hDesk);
        });
        t.Start();
        t.Join();
    }

    public static bool SetClipboardText(string text) {
        bool ok = false;
        Thread t = new Thread(() => {
            for (int attempt = 0; attempt < 5; attempt++) {
                try {
                    System.Windows.Forms.Clipboard.SetText(text);
                    ok = true;
                    break;
                } catch {
                    Thread.Sleep(50);
                }
            }
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return ok;
    }

    public static string GetClipboardText() {
        string res = "";
        Thread t = new Thread(() => {
            try {
                if (System.Windows.Forms.Clipboard.ContainsText()) {
                    res = System.Windows.Forms.Clipboard.GetText();
                }
            } catch {}
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
        return res;
    }

    public static void SendKeyCombination(string modifier, string key) {
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) { CloseDesktop(hDesk); return; }

            int sz = Marshal.SizeOf(typeof(INPUT));
            ushort modVk = 0;
            string m = (modifier ?? "").Trim().ToLower();
            if (m == "ctrl" || m == "control") modVk = 0x11;
            else if (m == "alt") modVk = 0x12;
            else if (m == "shift") modVk = 0x10;
            else if (m == "win" || m == "windows") modVk = 0x5B;

            ushort keyVk = 0;
            string k = (key ?? "").Trim().ToLower();
            if (k == "s") keyVk = 0x53;
            else if (k == "v") keyVk = 0x56;
            else if (k == "c") keyVk = 0x43;
            else if (k == "a") keyVk = 0x41;
            else if (k == "n") keyVk = 0x4E;
            else if (k == "w") keyVk = 0x57;
            else if (k == "t") keyVk = 0x54;
            else if (k == "z") keyVk = 0x5A;
            else if (k == "f4") keyVk = 0x73;
            else if (k == "enter") keyVk = 0x0D;

            if (modVk != 0 && keyVk != 0) {
                INPUT[] inp = new INPUT[4];
                // Modifier down
                inp[0].type = INPUT_KEYBOARD; inp[0].u.ki.wVk = modVk;
                // Key down
                inp[1].type = INPUT_KEYBOARD; inp[1].u.ki.wVk = keyVk;
                // Key up
                inp[2].type = INPUT_KEYBOARD; inp[2].u.ki.wVk = keyVk; inp[2].u.ki.dwFlags = KEYEVENTF_KEYUP;
                // Modifier up
                inp[3].type = INPUT_KEYBOARD; inp[3].u.ki.wVk = modVk; inp[3].u.ki.dwFlags = KEYEVENTF_KEYUP;
                SendInput(4, inp, sz);
            }

            CloseDesktop(hDesk);
        });
        t.Start();
        t.Join();
    }

    public static void SendHotkey(string key) {
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk == IntPtr.Zero) return;
            if (!SetThreadDesktop(hDesk)) {
                CloseDesktop(hDesk);
                return;
            }

            string k = (key ?? "").Trim().ToLower();
            int sz = Marshal.SizeOf(typeof(INPUT));

            if (k == "enter") {
                INPUT[] inp = new INPUT[2];
                inp[0].type = INPUT_KEYBOARD; inp[0].u.ki.wVk = 0x0D;
                inp[1].type = INPUT_KEYBOARD; inp[1].u.ki.wVk = 0x0D; inp[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
                SendInput(2, inp, sz);
            } else if (k == "space") {
                INPUT[] inp = new INPUT[2];
                inp[0].type = INPUT_KEYBOARD; inp[0].u.ki.wVk = 0x20;
                inp[1].type = INPUT_KEYBOARD; inp[1].u.ki.wVk = 0x20; inp[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
                SendInput(2, inp, sz);
            } else if (k == "tab") {
                INPUT[] inp = new INPUT[2];
                inp[0].type = INPUT_KEYBOARD; inp[0].u.ki.wVk = 0x09;
                inp[1].type = INPUT_KEYBOARD; inp[1].u.ki.wVk = 0x09; inp[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
                SendInput(2, inp, sz);
            } else if (k == "esc" || k == "escape") {
                INPUT[] inp = new INPUT[2];
                inp[0].type = INPUT_KEYBOARD; inp[0].u.ki.wVk = 0x1B;
                inp[1].type = INPUT_KEYBOARD; inp[1].u.ki.wVk = 0x1B; inp[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
                SendInput(2, inp, sz);
            } else if (k == "backspace") {
                INPUT[] inp = new INPUT[2];
                inp[0].type = INPUT_KEYBOARD; inp[0].u.ki.wVk = 0x08;
                inp[1].type = INPUT_KEYBOARD; inp[1].u.ki.wVk = 0x08; inp[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
                SendInput(2, inp, sz);
            } else if (k == "right") {
                INPUT[] inp = new INPUT[2];
                inp[0].type = INPUT_KEYBOARD; inp[0].u.ki.wVk = 0x27;
                inp[1].type = INPUT_KEYBOARD; inp[1].u.ki.wVk = 0x27; inp[1].u.ki.dwFlags = KEYEVENTF_KEYUP;
                SendInput(2, inp, sz);
            } else if (k.Length == 1) {
                char c = k[0];
                INPUT[] inp = new INPUT[2];
                inp[0].type = INPUT_KEYBOARD; inp[0].u.ki.wScan = (ushort)c; inp[0].u.ki.dwFlags = KEYEVENTF_UNICODE;
                inp[1].type = INPUT_KEYBOARD; inp[1].u.ki.wScan = (ushort)c; inp[1].u.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
                SendInput(2, inp, sz);
            }

            CloseDesktop(hDesk);
        });
        t.Start();
        t.Join();
    }

    public static float GetAudioPeak() {
        try {
            var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObj());
            IMMDevice dev = null;
            int hr = enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
            if (hr != 0 || dev == null) return -1f;

            Guid iid = new Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064");
            object meterObj = null;
            hr = dev.Activate(ref iid, 1, IntPtr.Zero, out meterObj);
            if (hr != 0 || meterObj == null) return -2f;

            var meter = (IAudioMeterInformation)meterObj;
            float peak = 0;
            meter.GetPeakValue(out peak);
            return peak;
        } catch {
            return -3f;
        }
    }
}
'@

Add-Type -TypeDefinition $csharpCode -ReferencedAssemblies System.Drawing, System.Windows.Forms -ErrorAction SilentlyContinue

switch ($Action.ToLower()) {
    "screenshot" {
        if ([string]::IsNullOrEmpty($OutFile)) {
            $OutFile = [System.IO.Path]::GetTempFileName() + ".jpg"
        }
        $res = [WinDesktopEngine]::CaptureScreen($OutFile)
        if ($res -and (Test-Path $OutFile)) {
            Write-Output "OK:SCREENSHOT:$OutFile"
        } else {
            Write-Output "ERR:SCREENSHOT_FAILED"
        }
    }

    "get_screen_bounds" {
        $w = [WinDesktopEngine]::GetSystemMetrics([WinDesktopEngine]::SM_CXSCREEN)
        $h = [WinDesktopEngine]::GetSystemMetrics([WinDesktopEngine]::SM_CYSCREEN)
        Write-Output "OK:SCREEN_BOUNDS:$w,$h"
    }

    "get_all_windows" {
        $wins = [WinDesktopEngine]::GetAllVisibleWindows()
        $b64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($wins))
        Write-Output "OK:WINDOWS_BASE64:$b64"
    }

    "get_active_window" {
        $info = [WinDesktopEngine]::GetActiveWindowInfo()
        Write-Output $info
    }

    "get_window_rect" {
        if (-not [string]::IsNullOrEmpty($ProcessName)) {
            $out = [WinDesktopEngine]::GetWindowRectString($ProcessName)
            Write-Output $out
        } else {
            Write-Output "ERR:PROCESS_NAME_REQUIRED"
        }
    }

    "launch" {
        if (-not [string]::IsNullOrEmpty($ProcessName)) {
            $cmdLine = ""
            if ($ProcessName -match "chrome") {
                $chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
                if (-not (Test-Path $chromePath)) {
                    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
                }
                if (-not [string]::IsNullOrEmpty($TargetArgs)) {
                    $cmdLine = "`"$chromePath`" --new-window `"$TargetArgs`""
                } else {
                    $cmdLine = "`"$chromePath`" --new-window"
                }
            } elseif ($ProcessName -match "notepad") {
                $cmdLine = "C:\Windows\System32\notepad.exe"
                if (-not [string]::IsNullOrEmpty($TargetArgs)) {
                    $cmdLine = "$cmdLine `"$TargetArgs`""
                }
            } elseif ($ProcessName -match "calc") {
                $cmdLine = "calc.exe"
            } elseif ($ProcessName -match "mspaint" -or $ProcessName -match "paint") {
                $cmdLine = "mspaint.exe"
            } else {
                $cmdLine = $ProcessName
                if (-not [string]::IsNullOrEmpty($TargetArgs)) {
                    $cmdLine = "$cmdLine $TargetArgs"
                }
            }

            $procId = [WinDesktopEngine]::LaunchProcess($cmdLine)
            Write-Output "OK:LAUNCHED:$procId"
        }
    }

    "focus" {
        if (-not [string]::IsNullOrEmpty($ProcessName)) {
            $ok = [WinDesktopEngine]::FocusTarget($ProcessName)
            if ($ok) {
                Write-Output "OK:FOCUSED:$ProcessName"
            } else {
                Write-Output "WARN:NOT_FOUND"
            }
        }
    }

    "move_smooth" {
        $ok = [WinDesktopEngine]::MoveMouseSmooth($TargetX, $TargetY, $DurationMs)
        Write-Output "OK:MOVED:$TargetX,$TargetY"
    }

    "drag" {
        $ok = [WinDesktopEngine]::Drag($StartX, $StartY, $TargetX, $TargetY, $DurationMs)
        Write-Output "OK:DRAGGED:$StartX,$StartY->${TargetX},$TargetY"
    }

    "scroll" {
        [WinDesktopEngine]::Scroll($ScrollAmount)
        Write-Output "OK:SCROLLED:$ScrollAmount"
    }

    "click" {
        [WinDesktopEngine]::Click($Button)
        Write-Output "OK:CLICKED:$Button"
    }

    "type" {
        if (-not [string]::IsNullOrEmpty($Text)) {
            [WinDesktopEngine]::TypeTextUnicode($Text, $TypeDelayMs)
        }
        Write-Output "OK:TYPED"
    }

    "clipboard_paste" {
        if (-not [string]::IsNullOrEmpty($Text)) {
            $pasted = $false
            for ($attempt = 0; $attempt -lt 5; $attempt++) {
                $ok = [WinDesktopEngine]::SetClipboardText($Text)
                if ($ok) { $pasted = $true; break; }
                Start-Sleep -Milliseconds 60
            }
            Start-Sleep -Milliseconds 100
            [WinDesktopEngine]::SendKeyCombination("ctrl", "v")
            Start-Sleep -Milliseconds 100
            Write-Output "OK:CLIPBOARD_PASTED"
        } else {
            Write-Output "ERR:NO_TEXT"
        }
    }

    "clipboard_get" {
        $txt = [WinDesktopEngine]::GetClipboardText()
        $b64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($txt))
        Write-Output "OK:CLIPBOARD_BASE64:$b64"
    }

    "read_active_text" {
        # Universal active text extraction: Select All (Ctrl+A), Copy (Ctrl+C), read clipboard, deselect (Right)
        [WinDesktopEngine]::SendKeyCombination("ctrl", "a")
        Start-Sleep -Milliseconds 80
        [WinDesktopEngine]::SendKeyCombination("ctrl", "c")
        Start-Sleep -Milliseconds 80
        [WinDesktopEngine]::SendHotkey("right")
        $txt = [WinDesktopEngine]::GetClipboardText()
        $b64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($txt))
        Write-Output "OK:ACTIVE_TEXT_BASE64:$b64"
    }

    "key_combo" {
        if (-not [string]::IsNullOrEmpty($Modifier) -and -not [string]::IsNullOrEmpty($Key)) {
            [WinDesktopEngine]::SendKeyCombination($Modifier, $Key)
            Write-Output "OK:KEY_COMBO:${Modifier}+${Key}"
        } else {
            Write-Output "ERR:INVALID_COMBO"
        }
    }

    "hotkey" {
        if (-not [string]::IsNullOrEmpty($Key)) {
            [WinDesktopEngine]::SendHotkey($Key)
            Write-Output "OK:HOTKEY:$Key"
        }
    }

    "audio_peak" {
        $peak = [WinDesktopEngine]::GetAudioPeak()
        Write-Output "OK:AUDIO_PEAK:$peak"
    }

    "check_file" {
        if (-not [string]::IsNullOrEmpty($OutFile)) {
            $expanded = [System.Environment]::ExpandEnvironmentVariables($OutFile)
            if (Test-Path $expanded) {
                $item = Get-Item $expanded
                Write-Output "OK:FILE_EXISTS:SIZE=$($item.Length):PATH=$expanded"
            } else {
                Write-Output "ERR:FILE_NOT_FOUND:$expanded"
            }
        } else {
            Write-Output "ERR:OUTFILE_REQUIRED"
        }
    }

    "start_border" {
        $overlayScript = Join-Path $PSScriptRoot "screenBorderOverlay.ps1"
        if (Test-Path $overlayScript) {
            $existing = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine -match 'screenBorderOverlay') } -ErrorAction SilentlyContinue
            if (-not $existing) {
                $cmd = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$overlayScript`""
                $procId = [WinDesktopEngine]::LaunchProcess($cmd)
                Write-Output "OK:BORDER_STARTED:$procId"
            } else {
                Write-Output "OK:BORDER_ALREADY_RUNNING"
            }
        } else {
            Write-Output "ERR:OVERLAY_SCRIPT_NOT_FOUND"
        }
    }

    "stop_border" {
        try {
            $procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine -match 'screenBorderOverlay') } -ErrorAction SilentlyContinue
            if ($procs) {
                $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
                Write-Output "OK:BORDER_STOPPED"
            } else {
                Write-Output "OK:BORDER_NOT_RUNNING"
            }
        } catch {
            Write-Output "OK:BORDER_STOPPED"
        }
    }

    default {
        Write-Output "ERR:UNKNOWN_ACTION"
    }
}
