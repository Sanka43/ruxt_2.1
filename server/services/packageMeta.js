import crypto from 'crypto';
import fs from 'fs';

/** SHA-256 of a Buffer or a file path, hex encoded. Lets users compare a package with what its author published. */
export function sha256(input) {
  const hash = crypto.createHash('sha256');
  hash.update(Buffer.isBuffer(input) ? input : fs.readFileSync(input));
  return hash.digest('hex');
}

const FILESYSTEM_LEVELS = ['none', 'agent', 'user'];

/**
 * Turns the (untrusted) manifest into a fixed, human-readable permission summary.
 * - Declared permissions are what the author says the agent needs.
 * - MCP servers are detected from the manifest itself, so they cannot be hidden by omitting them.
 * Unknown or malformed values fall back to the safest option.
 */
export function describePermissions(manifest = {}) {
  const declared = manifest && typeof manifest.permissions === 'object' && manifest.permissions !== null
    ? manifest.permissions
    : null;
  const d = declared || {};

  const mcpServers = manifest && typeof manifest.mcpServers === 'object' && manifest.mcpServers !== null
    ? Object.keys(manifest.mcpServers)
    : [];

  const permissions = {
    network: d.network === true,
    filesystem: FILESYSTEM_LEVELS.includes(d.filesystem) ? d.filesystem : 'none',
    desktopControl: d.desktopControl === true,
    shell: d.shell === true,
    mcpServers
  };

  const summary = [];
  if (permissions.network) summary.push('Connect to the internet');
  if (permissions.filesystem === 'agent') summary.push("Read and write files in its own folder");
  if (permissions.filesystem === 'user') summary.push('Read and write files in your user folders');
  if (permissions.desktopControl) summary.push('Control your mouse, keyboard and screen');
  if (permissions.shell) summary.push('Run shell commands');
  if (mcpServers.length) summary.push(`Start local tool servers: ${mcpServers.join(', ')}`);
  if (summary.length === 0) summary.push('No special permissions');

  return { declared: declared !== null, permissions, summary };
}
