import test from 'node:test';
import assert from 'node:assert/strict';
import { desktopAutomationSupported, requireDesktopAutomation, DESKTOP_UNSUPPORTED_MESSAGE } from '../../services/platformGuard.js';

test('only Windows supports desktop automation', () => {
  assert.equal(desktopAutomationSupported('win32'), true);
  assert.equal(desktopAutomationSupported('darwin'), false);
  assert.equal(desktopAutomationSupported('linux'), false);
});

test('requireDesktopAutomation answers 501 with a clear message off Windows, passes through on Windows', () => {
  let nextCalled = false;
  let status = null;
  let body = null;
  const res = { status: (s) => { status = s; return { json: (b) => { body = b; } }; } };
  requireDesktopAutomation({}, res, () => { nextCalled = true; });

  if (process.platform === 'win32') {
    assert.equal(nextCalled, true);
  } else {
    assert.equal(status, 501);
    assert.equal(body.error, DESKTOP_UNSUPPORTED_MESSAGE);
    assert.equal(nextCalled, false);
  }
});
