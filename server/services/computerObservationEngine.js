import fs from 'fs';
import path from 'path';
import { runWindowsAction, captureScreenToFile } from './visionComputerUse.js';

/**
 * RuXt Continuous Computer Observation Engine
 * Continuously gathers multi-sensor environmental telemetry:
 * - Real desktop screenshot
 * - Active foreground window
 * - Full visible window topology (positions, sizes, titles)
 * - Master audio output meter
 * - Monitor resolution and DPI bounds
 */
export class ComputerObservationEngine {
  /**
   * Capture a complete, multi-modal situational observation of the computer
   */
  static async captureObservation({ jobDir, stepNumber = 1 } = {}) {
    const timestamp = Date.now();
    const observation = {
      timestamp,
      stepNumber,
      screenshotPath: null,
      screenshotBase64: null,
      screenBounds: { width: 1920, height: 1080 },
      activeWindow: null,
      visibleWindows: [],
      audioPeak: 0
    };

    // 1. Capture screen dimensions
    try {
      const boundsRes = await runWindowsAction(['-Action', 'get_screen_bounds']);
      const bMatch = boundsRes.match(/OK:SCREEN_BOUNDS:(\d+),(\d+)/);
      if (bMatch) {
        observation.screenBounds = {
          width: parseInt(bMatch[1], 10),
          height: parseInt(bMatch[2], 10)
        };
      }
    } catch (_) {}

    // 2. Capture screenshot
    if (jobDir) {
      const snapFile = path.join(jobDir, `step_${stepNumber}.jpg`);
      const captured = await captureScreenToFile(snapFile);
      if (captured && fs.existsSync(snapFile)) {
        observation.screenshotPath = snapFile;
        try {
          observation.screenshotBase64 = fs.readFileSync(snapFile).toString('base64');
        } catch (_) {}
      }
    }

    // 3. Query all visible windows on desktop
    try {
      const winOut = await runWindowsAction(['-Action', 'get_all_windows']);
      const match = winOut.match(/OK:WINDOWS_BASE64:([A-Za-z0-9+/=]+)/);
      if (match && match[1]) {
        const decoded = Buffer.from(match[1], 'base64').toString('utf8');
        const lines = decoded.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          const parts = line.split('|');
          if (parts.length >= 4) {
            const hwnd = parts[0].trim();
            const className = parts[1].trim();
            const rectParts = parts[2].split(',').map(n => parseInt(n.trim(), 10));
            const title = parts.slice(3).join('|').trim();

            if (rectParts.length === 4 && !isNaN(rectParts[0])) {
              const [left, top, width, height] = rectParts;
              observation.visibleWindows.push({
                hwnd,
                className,
                rect: { left, top, width, height },
                center: {
                  x: Math.round(left + (width / 2)),
                  y: Math.round(top + (height / 2))
                },
                title
              });
            }
          }
        }
      }
    } catch (_) {}

    // 4. Query active foreground window
    try {
      const activeOut = await runWindowsAction(['-Action', 'get_active_window']);
      if (activeOut.startsWith('OK:ACTIVE_WINDOW:')) {
        const rest = activeOut.replace('OK:ACTIVE_WINDOW:', '');
        const items = rest.split('|');
        observation.activeWindow = {
          raw: activeOut,
          hwnd: items[0]?.replace('HWND=', '') || '',
          className: items[1]?.replace('CLASS=', '') || '',
          title: items[2]?.replace('TITLE=', '') || ''
        };
      }
    } catch (_) {}

    // 5. Query Master Audio Peak (CoreAudio)
    try {
      const audioOut = await runWindowsAction(['-Action', 'audio_peak']);
      const aMatch = audioOut.match(/OK:AUDIO_PEAK:([0-9.]+)/);
      if (aMatch && aMatch[1]) {
        observation.audioPeak = parseFloat(aMatch[1]);
      }
    } catch (_) {}

    return observation;
  }

  /**
   * Find a specific window by process name, class, or title substring
   */
  static findWindow(observation, query) {
    if (!observation || !observation.visibleWindows) return null;
    const q = (query || '').toLowerCase().trim();
    return observation.visibleWindows.find(w => 
      w.title.toLowerCase().includes(q) || 
      w.className.toLowerCase().includes(q)
    ) || null;
  }
}
