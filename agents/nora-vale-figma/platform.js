const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function commandPath(command) {
  try {
    const resolver = process.platform === 'win32' ? 'where' : 'which';
    return execFileSync(resolver, [command], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/)[0] || null;
  } catch (_) { return null; }
}

function installCommand() {
  if (process.platform === 'darwin' && commandPath('brew')) return { command: 'brew', args: ['install', '--cask', 'figma'] };
  if (process.platform === 'win32' && commandPath('winget')) return { command: 'winget', args: ['install', '--id', 'Figma.Figma', '-e', '--accept-package-agreements', '--accept-source-agreements'] };
  return null;
}

function platformInstallMessage() {
  return process.platform === 'win32'
    ? 'Install Figma from figma.com/downloads, then ask Nora again.'
    : 'Install Figma from figma.com/downloads, then ask Nora again.';
}

module.exports = { commandPath, installCommand, platformInstallMessage };
