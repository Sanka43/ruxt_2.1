/**
 * RuXt Computer Use Safety & Boundary Controller
 * Ensures autonomous operations respect user safety, data preservation, and security boundaries.
 */

export class SafetyController {
  static DANGEROUS_PATTERNS = [
    /format\s+[a-z]:/i,
    /del\s+\/[sfq]\s+c:\\windows/i,
    /rmdir\s+\/s\s+\/q\s+[a-z]:\\/i,
    /drop\s+database/i,
    /rm\s+-rf\s+\//i,
    /reg\s+delete\s+hklm/i,
    /diskpart/i,
    /shutdown\s+\/s/i
  ];

  static SENSITIVE_KEYWORDS = [
    'credit card',
    'cvv',
    'password',
    'secret_key',
    'bank account',
    'private key'
  ];

  /**
   * Evaluate task risk level
   */
  static evaluateTaskRisk(goal) {
    const text = (goal || '').toLowerCase();

    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(text)) {
        return {
          allowed: false,
          level: 'BLOCKED',
          reason: 'Request contains destructive system commands that violate safety boundaries.'
        };
      }
    }

    if (text.includes('delete all') || text.includes('wipe disk') || text.includes('format drive')) {
      return {
        allowed: false,
        level: 'BLOCKED',
        reason: 'Bulk deletion or formatting is blocked by safety policy.'
      };
    }

    if (text.includes('delete') || text.includes('remove file')) {
      return {
        allowed: true,
        level: 'CONFIRMATION_REQUIRED',
        reason: 'File deletion requires explicit user confirmation.'
      };
    }

    return {
      allowed: true,
      level: 'SAFE',
      reason: 'Standard autonomous computer operation.'
    };
  }

  /**
   * Check individual action parameters for safety
   */
  static evaluateAction(actionType, params = {}) {
    if (actionType === 'run_shell') {
      const cmd = (params.command || '').toLowerCase();
      for (const pattern of this.DANGEROUS_PATTERNS) {
        if (pattern.test(cmd)) {
          return { allowed: false, reason: `Shell command matched dangerous pattern: ${pattern}` };
        }
      }
    }
    return { allowed: true };
  }
}
