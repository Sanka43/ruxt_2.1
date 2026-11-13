import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRootDir = path.resolve(__dirname, '../..');
const agentsDir = path.resolve(appRootDir, 'agents');
const packagesDir = path.join(agentsDir, 'packages');

export async function testAgentStudio() {
  const logFile = path.resolve(__dirname, 'test_output.log');
  fs.writeFileSync(logFile, '--- Starting Agent Studio Test ---\n');

  const log = (msg) => {
    fs.appendFileSync(logFile, `${msg}\n`);
  };

  try {
    const testSlug = 'unit-test-agent';
    const targetDir = path.join(agentsDir, testSlug);

    // Clean any previous test run
    if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    const pkgPath = path.join(packagesDir, `${testSlug}.ruxt`);
    if (fs.existsSync(pkgPath)) fs.unlinkSync(pkgPath);

    // 1. Simulate agent build
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'agent.md'), '# Unit Test Agent\nTest persona instructions.', 'utf8');
    fs.writeFileSync(path.join(targetDir, 'README.md'), '# Unit Test Agent Readme', 'utf8');

    const manifest = {
      format: 'ruxt-agent-package/v2',
      slug: testSlug,
      name: 'Unit Test Agent',
      role: 'QA Specialist',
      headline: 'Automated test agent',
      category: 'Engineering',
      version: '1.0.0',
      skills: ['Automated Testing'],
      permissions: ['filesystem:read'],
      agent: {
        name: 'Unit Test Agent',
        role: 'QA Specialist',
        persona: 'agent.md'
      }
    };
    fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

    // 2. Package into .ruxt
    execSync(`tar -cf "${pkgPath}" -C "${targetDir}" .`, { stdio: 'pipe' });
    log(`[PASS] .ruxt package generated: ${pkgPath} (Size: ${fs.statSync(pkgPath).size} bytes)`);

    // 3. Test extraction / import simulation
    const extractDir = path.join(agentsDir, 'unit-test-extracted');
    if (fs.existsSync(extractDir)) fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });

    execSync(`tar -xf "${pkgPath}" -C "${extractDir}"`, { stdio: 'pipe' });
    const extractedManifest = JSON.parse(fs.readFileSync(path.join(extractDir, 'manifest.json'), 'utf8'));

    if (extractedManifest.name === 'Unit Test Agent' && extractedManifest.role === 'QA Specialist') {
      log('[PASS] .ruxt archive verified and unpacked with identical manifest.');
    } else {
      throw new Error('Manifest mismatch in unpacked package');
    }

    // 4. Test SQLite database registration
    db.prepare(`
      INSERT INTO agents (id, name, slug, role, description, version, avatar, ui_entry, manifest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET name = excluded.name
    `).run(
      testSlug,
      'Unit Test Agent',
      testSlug,
      'QA Specialist',
      'Automated test agent',
      '1.0.0',
      `/agent-avatars/${testSlug}.png`,
      '',
      JSON.stringify(manifest)
    );

    const row = db.prepare('SELECT * FROM agents WHERE slug = ?').get(testSlug);
    if (row && row.name === 'Unit Test Agent') {
      log('[PASS] Agent successfully saved and queried in SQLite database.');
    } else {
      throw new Error('Failed to find agent in SQLite');
    }

    // Cleanup
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
    if (fs.existsSync(pkgPath)) fs.unlinkSync(pkgPath);
    db.prepare('DELETE FROM agents WHERE slug = ?').run(testSlug);

    log('[PASS] Cleanup completed cleanly.');
    log('--- ALL AGENT STUDIO & MARKET TESTS PASSED ---');
  } catch (err) {
    log(`[FAIL] Test error: ${err.message}`);
  }
}

testAgentStudio();
