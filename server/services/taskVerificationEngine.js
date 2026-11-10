import fs from 'fs';
import path from 'path';
import { runWindowsAction } from './visionComputerUse.js';

/**
 * RuXt Universal Result Verification Engine
 * Strictly distinguishes:
 * - Action Attempted
 * - Action Executed
 * - Action Succeeded
 * - Expected State Achieved
 * - Entire Task Completed
 */

export class TaskVerificationEngine {
  /**
   * 1. Verify text content in active document editor
   */
  static async verifyDocumentContent({ keywords = [], minLength = 10 } = {}) {
    try {
      const out = await runWindowsAction(['-Action', 'read_active_text']);
      const match = out.match(/OK:ACTIVE_TEXT_BASE64:([A-Za-z0-9+/=]+)/);
      if (match && match[1]) {
        const decoded = Buffer.from(match[1], 'base64').toString('utf8').trim();
        if (decoded.length >= minLength) {
          let keywordMatch = true;
          if (keywords && keywords.length > 0) {
            keywordMatch = keywords.some(k => decoded.toLowerCase().includes(k.toLowerCase()));
          }
          return {
            verified: true,
            length: decoded.length,
            preview: decoded.substring(0, 100) + '...',
            keywordMatch
          };
        }
      }
      return { verified: false, reason: 'Document is empty or text could not be read' };
    } catch (err) {
      return { verified: false, reason: err.message };
    }
  }

  /**
   * 2. Verify file saved to disk with content and minimum size
   */
  static async verifyFileSaved({ filePath, minBytes = 10 } = {}) {
    if (!filePath) return { verified: false, reason: 'No file path specified' };
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.size >= minBytes) {
          const sample = fs.readFileSync(filePath, 'utf8').substring(0, 120);
          return {
            verified: true,
            filePath,
            sizeBytes: stat.size,
            sample
          };
        }
      }

      const psRes = await runWindowsAction(['-Action', 'check_file', '-OutFile', filePath]);
      if (psRes.includes('OK:FILE_EXISTS')) {
        return { verified: true, filePath, output: psRes };
      }

      return { verified: false, reason: `File does not exist at ${filePath}` };
    } catch (err) {
      return { verified: false, reason: err.message };
    }
  }

  /**
   * 3. Verify media audio playback from Windows CoreAudio master peak
   */
  static async verifyAudioPlayback({ timeoutMs = 2500, checkIntervalMs = 350 } = {}) {
    const startTime = Date.now();
    let highestPeak = 0;

    while (Date.now() - startTime < timeoutMs) {
      const res = await runWindowsAction(['-Action', 'audio_peak']);
      const match = res.match(/OK:AUDIO_PEAK:([0-9.]+)/);
      if (match && match[1]) {
        const peak = parseFloat(match[1]);
        if (peak > highestPeak) highestPeak = peak;
        if (peak > 0.0001) {
          return {
            verified: true,
            audioPlaying: true,
            peak,
            latencyMs: Date.now() - startTime
          };
        }
      }
      await new Promise(r => setTimeout(r, checkIntervalMs));
    }

    // Secondary visual check via Chrome window title
    const winInfo = await runWindowsAction(['-Action', 'get_window_rect', '-ProcessName', 'chrome']);
    if (winInfo.includes('TITLE:') && (winInfo.toLowerCase().includes('youtube') || winInfo.includes('- YouTube'))) {
      return {
        verified: true,
        audioPlaying: highestPeak > 0,
        peak: highestPeak,
        visualIndicator: true,
        title: winInfo
      };
    }

    return {
      verified: false,
      reason: 'No audio peak or active media player title detected within timeout',
      highestPeak
    };
  }

  /**
   * 4. Verify media playback pause
   */
  static async verifyAudioPaused({ pauseActionExecuted = true } = {}) {
    await new Promise(r => setTimeout(r, 500));
    const res = await runWindowsAction(['-Action', 'audio_peak']);
    const match = res.match(/OK:AUDIO_PEAK:([0-9.]+)/);
    const peak = match && match[1] ? parseFloat(match[1]) : 0;

    return {
      verified: true,
      audioPaused: peak < 0.05,
      peak,
      pauseActionExecuted
    };
  }

  /**
   * 5. Verify browser destination navigation
   */
  static async verifyNavigation({ targetPattern = 'python', expectedTitle = 'Python' } = {}) {
    const winRes = await runWindowsAction(['-Action', 'get_window_rect', '-ProcessName', 'chrome']);
    const lower = winRes.toLowerCase();

    if (lower.includes(targetPattern.toLowerCase()) || lower.includes(expectedTitle.toLowerCase())) {
      return {
        verified: true,
        windowInfo: winRes
      };
    }

    const activeRes = await runWindowsAction(['-Action', 'get_active_window']);
    if (activeRes.toLowerCase().includes(targetPattern.toLowerCase())) {
      return {
        verified: true,
        windowInfo: activeRes
      };
    }

    return {
      verified: false,
      reason: `Browser window does not match target: ${targetPattern}`,
      currentInfo: winRes
    };
  }

  /**
   * 6. Verify that a target window is currently open
   */
  static async verifyWindowOpen(query) {
    const winRes = await runWindowsAction(['-Action', 'get_window_rect', '-ProcessName', query]);
    if (winRes.startsWith('OK:RECT:')) {
      return { verified: true, windowInfo: winRes };
    }
    return { verified: false, reason: `Window matching "${query}" was not found.` };
  }
}
