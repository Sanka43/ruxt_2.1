import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Safe .ruxt package handling. Archives are untrusted input (import-package takes
// a base64 upload), so: no shell strings, entry names are validated BEFORE
// extraction, extraction goes to a private temp dir, and the extracted tree is
// re-checked for symlinks/escapes before anything reaches the agents folder.

const MAX_ENTRIES = 5000;
const PS_BASE = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command'];

export function isSafeEntryName(name) {
  const n = String(name).replace(/\\/g, '/');
  if (!n || n.includes('\0')) return false;
  if (n.startsWith('/') || /^[a-zA-Z]:/.test(n)) return false;
  return !n.split('/').some((seg) => seg === '..');
}

// Use the OS bsdtar explicitly: a GNU tar earlier on PATH (e.g. Git for Windows)
// treats "C:\..." as a remote host, and PATH lookups can be hijacked.
const TAR = (() => {
  if (process.platform === 'win32') {
    const sys = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
    if (fs.existsSync(sys)) return sys;
  }
  return 'tar';
})();

function listWithTar(archive) {
  const out = execFileSync(TAR, ['-tf', archive], { stdio: 'pipe', encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return out.split(/\r?\n/).filter(Boolean);
}

function listWithPowerShell(archive) {
  const script =
    'Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
    '$z=[IO.Compression.ZipFile]::OpenRead($env:RUXT_ARCHIVE); try { $z.Entries | ForEach-Object { $_.FullName } } finally { $z.Dispose() }';
  const out = execFileSync('powershell', [...PS_BASE, script], {
    stdio: 'pipe', encoding: 'utf8', env: { ...process.env, RUXT_ARCHIVE: archive },
  });
  return out.split(/\r?\n/).filter(Boolean);
}

function walk(dir, visit) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.lstatSync(full);
    visit(full, st);
    if (st.isDirectory()) walk(full, visit);
  }
}

/** Extracts `archive` into `destDir` after validating it. Throws on anything suspicious. */
export function extractArchiveSafely(archive, destDir) {
  let method = 'tar';
  let entries;
  try {
    entries = listWithTar(archive);
  } catch (_) {
    method = 'powershell';
    entries = listWithPowerShell(archive);
  }
  if (entries.length > MAX_ENTRIES) throw new Error(`Package has too many files (${entries.length})`);
  const bad = entries.find((e) => !isSafeEntryName(e));
  if (bad) throw new Error(`Unsafe path in package: ${bad}`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ruxt-pkg-'));
  try {
    if (method === 'tar') {
      execFileSync(TAR, ['-xf', archive, '-C', tmp], { stdio: 'pipe' });
    } else {
      const script = 'Expand-Archive -LiteralPath $env:RUXT_ARCHIVE -DestinationPath $env:RUXT_DEST -Force';
      execFileSync('powershell', [...PS_BASE, script], {
        stdio: 'pipe', env: { ...process.env, RUXT_ARCHIVE: archive, RUXT_DEST: tmp },
      });
    }

    const root = fs.realpathSync(tmp);
    walk(tmp, (full, st) => {
      if (st.isSymbolicLink()) throw new Error(`Symlink not allowed in package: ${path.relative(tmp, full)}`);
      const real = fs.realpathSync(full);
      if (real !== root && !real.startsWith(root + path.sep)) {
        throw new Error(`Package entry escapes extraction folder: ${path.relative(tmp, full)}`);
      }
    });

    fs.mkdirSync(destDir, { recursive: true });
    fs.cpSync(tmp, destDir, { recursive: true, force: true });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Creates a .ruxt (tar) package from a folder without going through a shell. */
export function createArchive(srcDir, outFile) {
  try {
    execFileSync(TAR, ['-cf', outFile, '-C', srcDir, '.'], { stdio: 'pipe' });
  } catch (err) {
    try {
      const script = "Compress-Archive -Path (Join-Path $env:RUXT_SRC '*') -DestinationPath $env:RUXT_OUT -Force";
      execFileSync('powershell', [...PS_BASE, script], {
        stdio: 'pipe', env: { ...process.env, RUXT_SRC: srcDir, RUXT_OUT: outFile },
      });
    } catch (_) {
      throw new Error(`Failed to archive agent package: ${err.message}`);
    }
  }
}
