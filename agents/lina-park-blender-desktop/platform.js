const fs = require('fs');
const path = require('path');
const { spawn, execFileSync } = require('child_process');

function commandPath(command) {
  try {
    const resolver = process.platform === 'win32' ? 'where' : 'which';
    return execFileSync(resolver, [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/)[0] || null;
  } catch (_) { return null; }
}
function blenderCandidates() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return [
    process.env.BLENDER_BIN,
    process.platform === 'win32' ? path.join(process.env.ProgramFiles || '', 'Blender Foundation', 'Blender', 'blender.exe') : null,
    process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Blender Foundation', 'Blender', 'blender.exe') : null,
    process.platform === 'darwin' ? '/Applications/Blender.app/Contents/MacOS/Blender' : null,
    process.platform === 'darwin' ? path.join(home, 'Applications/Blender.app/Contents/MacOS/Blender') : null
  ].filter(Boolean);
}
function resolveBlenderBin() {
  return blenderCandidates().find((candidate) => fs.existsSync(candidate)) || commandPath(process.platform === 'win32' ? 'blender.exe' : 'blender');
}
function openBlender(filePath = '') {
  const bin = resolveBlenderBin();
  if (!bin) return { ok: false, error: 'Blender was not found. Install Blender or set BLENDER_BIN.' };
  try {
    if (process.platform === 'darwin') spawn('open', ['-a', 'Blender', ...(filePath ? [filePath] : [])], { stdio: 'ignore' });
    else spawn(bin, filePath ? [filePath] : [], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
    return { ok: true, via: process.platform === 'win32' ? 'blender.exe' : 'open', bin };
  } catch (error) { return { ok: false, error: error.message }; }
}
function installCommand() {
  if (process.platform === 'darwin' && commandPath('brew')) return { command: 'brew', args: ['install', '--cask', 'blender'] };
  if (process.platform === 'win32' && commandPath('winget')) return { command: 'winget', args: ['install', '--id', 'BlenderFoundation.Blender', '-e', '--accept-package-agreements', '--accept-source-agreements'] };
  return null;
}
function platformInstallMessage() {
  if (process.platform === 'win32') return 'Install Blender from blender.org, or install winget and ask Lina again.';
  if (process.platform === 'darwin') return 'Install Blender from blender.org, or install Homebrew and ask Lina again.';
  return 'Install Blender from blender.org, then ask Lina again.';
}
module.exports = { commandPath, resolveBlenderBin, openBlender, installCommand, platformInstallMessage };
