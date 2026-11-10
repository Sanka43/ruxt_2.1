Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Threading;
using System.Net;
using System.IO;

public class ScreenBorderForm : Form {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

    [DllImport("user32.dll")]
    public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    public const int GWL_EXSTYLE = -20;
    public const int WS_EX_TRANSPARENT = 0x00000020;
    public const int WS_EX_LAYERED = 0x00080000;
    public const int WS_EX_TOOLWINDOW = 0x00000080;
    public const int WS_EX_TOPMOST = 0x00000008;

    public static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    public const uint SWP_NOMOVE = 0x0002;
    public const uint SWP_NOSIZE = 0x0001;
    public const uint SWP_SHOWWINDOW = 0x0040;
    public const int VK_ESCAPE = 0x1B;

    private System.Windows.Forms.Timer animTimer;
    private System.Windows.Forms.Timer escCheckTimer;
    private float animPhase = 0f;

    public ScreenBorderForm() {
        this.FormBorderStyle = FormBorderStyle.None;
        this.ShowInTaskbar = false;
        this.TopMost = true;
        this.StartPosition = FormStartPosition.Manual;
        this.Bounds = Screen.PrimaryScreen.Bounds;
        this.BackColor = Color.Black;
        this.TransparencyKey = Color.Black;
        this.DoubleBuffered = true;

        // Animation timer for pulsing neon glow
        animTimer = new System.Windows.Forms.Timer();
        animTimer.Interval = 45;
        animTimer.Tick += (s, e) => {
            animPhase += 0.04f;
            if (animPhase > 1f) animPhase = 0f;
            this.Invalidate();
        };
        animTimer.Start();

        // Background ESC key detector
        escCheckTimer = new System.Windows.Forms.Timer();
        escCheckTimer.Interval = 80;
        escCheckTimer.Tick += (s, e) => {
            // Check if Escape key is pressed
            if ((GetAsyncKeyState(VK_ESCAPE) & 0x8000) != 0) {
                // Trigger backend abort
                try {
                    HttpWebRequest request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:1234/api/desktop/abort-active");
                    request.Method = "POST";
                    request.Timeout = 1000;
                    request.ContentLength = 0;
                    using (var resp = request.GetResponse()) {}
                } catch {}
                Application.Exit();
            }
        };
        escCheckTimer.Start();
    }

    protected override void OnHandleCreated(EventArgs e) {
        base.OnHandleCreated(e);
        int initialStyle = GetWindowLong(this.Handle, GWL_EXSTYLE);
        SetWindowLong(this.Handle, GWL_EXSTYLE, initialStyle | WS_EX_TRANSPARENT | WS_EX_LAYERED | WS_EX_TOOLWINDOW | WS_EX_TOPMOST);
        SetWindowPos(this.Handle, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    }

    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e);
        Graphics g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;

        int borderWidth = 7;
        Rectangle rect = new Rectangle(borderWidth / 2, borderWidth / 2, this.Width - borderWidth, this.Height - borderWidth);

        // Dynamic multi-color neon gradient: Cyan (#06b6d4) -> Violet (#8b5cf6) -> Pink (#ec4899) -> Emerald (#10b981)
        using (LinearGradientBrush brush = new LinearGradientBrush(
            rect, 
            Color.FromArgb(255, 6, 182, 212),
            Color.FromArgb(255, 139, 92, 246),
            LinearGradientMode.ForwardDiagonal)) {

            ColorBlend blend = new ColorBlend(5);
            blend.Colors = new Color[] {
                Color.FromArgb(255, 6, 182, 212),
                Color.FromArgb(255, 139, 92, 246),
                Color.FromArgb(255, 236, 72, 153),
                Color.FromArgb(255, 16, 185, 129),
                Color.FromArgb(255, 6, 182, 212)
            };
            blend.Positions = new float[] { 0.0f, 0.28f, 0.58f, 0.85f, 1.0f };
            brush.InterpolationColors = blend;

            using (Pen pen = new Pen(brush, borderWidth)) {
                g.DrawRectangle(pen, rect);
            }
        }
    }

    public static void RunForm() {
        Thread t = new Thread(() => {
            IntPtr hDesk = OpenDesktop("default", 0, false, 0x01FF);
            if (hDesk != IntPtr.Zero) {
                SetThreadDesktop(hDesk);
            }
            Application.Run(new ScreenBorderForm());
        });
        t.SetApartmentState(ApartmentState.STA);
        t.Start();
        t.Join();
    }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms, System.Drawing

[ScreenBorderForm]::RunForm()
