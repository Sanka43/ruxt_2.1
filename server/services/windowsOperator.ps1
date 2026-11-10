param (
    [string]$Action,
    [int]$TargetX = 0,
    [int]$TargetY = 0,
    [int]$DurationMs = 500,
    [string]$Button = "left",
    [string]$Text = "",
    [string]$TextBase64 = "",
    [int]$TypeDelayMs = 25,
    [string]$ProcessName = ""
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

if (-not [string]::IsNullOrEmpty($TextBase64)) {
    try {
        $bytes = [System.Convert]::FromBase64String($TextBase64)
        $Text = [System.Text.Encoding]::UTF8.GetString($bytes)
    } catch {}
}

$code = @"
using System;
using System.Runtime.InteropServices;

public class Win32Gui {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;
    public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
}
"@
Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

switch ($Action.ToLower()) {
    "get_pos" {
        $p = [System.Windows.Forms.Cursor]::Position
        Write-Output "$($p.X),$($p.Y)"
    }

    "move_smooth" {
        $current = [System.Windows.Forms.Cursor]::Position
        $startX = $current.X
        $startY = $current.Y
        $steps = [Math]::Max(10, [Math]::Min(50, [Math]::Round($DurationMs / 18)))
        $sleepPerStep = [Math]::Max(5, [Math]::Round($DurationMs / $steps))

        for ($i = 1; $i -le $steps; $i++) {
            $t = $i / $steps
            # Ease-in-out quadratic interpolation
            $ease = if ($t -lt 0.5) { 2 * $t * $t } else { -1 + (4 - 2 * $t) * $t }
            $currX = [Math]::Round($startX + ($TargetX - $startX) * $ease)
            $currY = [Math]::Round($startY + ($TargetY - $startY) * $ease)
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($currX, $currY)
            Start-Sleep -Milliseconds $sleepPerStep
        }
        [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($TargetX, $TargetY)
        Write-Output "OK:MOVED:$TargetX,$TargetY"
    }

    "click" {
        if ($Button -eq "right") {
            [Win32Gui]::mouse_event([Win32Gui]::MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, 0)
            Start-Sleep -Milliseconds 60
            [Win32Gui]::mouse_event([Win32Gui]::MOUSEEVENTF_RIGHTUP, 0, 0, 0, 0)
        } else {
            [Win32Gui]::mouse_event([Win32Gui]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0)
            Start-Sleep -Milliseconds 60
            [Win32Gui]::mouse_event([Win32Gui]::MOUSEEVENTF_LEFTUP, 0, 0, 0, 0)
        }
        Write-Output "OK:CLICKED:$Button"
    }

    "type" {
        if (-not [string]::IsNullOrEmpty($Text)) {
            # Type text smoothly, escaping special SendKeys characters
            for ($i = 0; $i -lt $Text.Length; $i++) {
                $c = $Text[$i]
                if ($c -eq "`n") {
                    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
                } elseif ($c -eq "`r") {
                    # Skip carriage return
                } elseif ("+^%~{}[]()".IndexOf($c) -ge 0) {
                    [System.Windows.Forms.SendKeys]::SendWait("{$c}")
                } else {
                    [System.Windows.Forms.SendKeys]::SendWait([string]$c)
                }
                if ($TypeDelayMs -gt 0) {
                    Start-Sleep -Milliseconds $TypeDelayMs
                }
            }
        }
        Write-Output "OK:TYPED"
    }

    "focus" {
        if (-not [string]::IsNullOrEmpty($ProcessName)) {
            $p = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
            if ($p) {
                [Win32Gui]::ShowWindow($p.MainWindowHandle, 9) # SW_RESTORE
                [Win32Gui]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
                Write-Output "OK:FOCUSED:$($p.ProcessName)"
            } else {
                Write-Output "WARN:NOT_FOUND"
            }
        }
    }

    default {
        Write-Output "ERR:UNKNOWN_ACTION"
    }
}
