import { execFileSync } from 'child_process';

// Runs a CLI without ever handing user text to a shell as a command string.
// .exe files are executed directly. On Windows, .cmd/.bat shims must go through
// cmd.exe, so every argument is escaped with the same rules used by cross-spawn.

const META_RE = /([()\][%!^"`<>&|;, *?])/g;

function escapeCommand(arg) {
  return String(arg).replace(META_RE, '^$1');
}

function escapeArgument(arg, doubleEscape) {
  let a = String(arg).replace(/\r?\n/g, ' '); // a newline would end the cmd.exe command line
  a = a.replace(/(\\*)"/g, '$1$1\\"');
  a = a.replace(/(\\*)$/, '$1$1');
  a = `"${a}"`;
  a = a.replace(META_RE, '^$1');
  if (doubleEscape) a = a.replace(META_RE, '^$1');
  return a;
}

export function execCliSync(bin, args = [], options = {}) {
  if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(bin)) {
    const line = [escapeCommand(bin), ...args.map((a) => escapeArgument(a, true))].join(' ');
    return execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${line}"`], {
      ...options,
      windowsVerbatimArguments: true,
    });
  }
  return execFileSync(bin, args, options);
}
