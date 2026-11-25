import assert from 'assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create an isolated fresh PC environment
const tempFreshDataDir = path.join(os.tmpdir(), `ruxt_fresh_test_${Date.now()}`);
fs.mkdirSync(tempFreshDataDir, { recursive: true });

process.env.RUXT_DATA_DIR = tempFreshDataDir;
process.env.PORT = '9876';

console.log(`[Fresh PC Test] Setting up clean environment in: ${tempFreshDataDir}`);

// Dynamically import db, server, and routes with the isolated environment
const { default: db } = await import('../db.js');
const { default: app } = await import('../index.js');
const { ensureRuxtLeaderSeeded } = await import('../routes/agents.js');

async function runTests() {
  const baseUrl = `http://127.0.0.1:${process.env.PORT || '9876'}`;
  
  // Test 1: Verify RuXt Leader is automatically seeded into database
  console.log('\n--- Test 1: Auto-seed on fresh PC ---');
  ensureRuxtLeaderSeeded();
  const leaderInDb = db.prepare("SELECT id, name, slug, role FROM agents WHERE slug = 'ruxt'").get();
  assert.ok(leaderInDb, 'RuXt must exist in fresh SQLite database');
  assert.strictEqual(leaderInDb.slug, 'ruxt', 'Leader slug must be ruxt');
  console.log('✓ RuXt Leader successfully auto-seeded into empty database.');

  // Test 2: Verify /api/agents returns ONLY RuXt (Lead) on fresh PC
  console.log('\n--- Test 2: Active agents on fresh PC ---');
  const resAgents = await fetch(`${baseUrl}/api/agents?refresh=true`);
  const agentsData = await resAgents.json();
  
  assert.strictEqual(agentsData.success, true, 'API should return success');
  assert.strictEqual(agentsData.count, 1, `Expected exactly 1 agent on fresh PC, got ${agentsData.count}`);
  assert.strictEqual(agentsData.agents[0].slug, 'ruxt', 'The single installed agent must be RuXt');
  assert.strictEqual(agentsData.agents[0].isLeader, true, 'RuXt must be flagged as Leader');
  console.log(`✓ /api/agents returns ONLY RuXt (count: ${agentsData.count}, leader: ${agentsData.agents[0].name})`);

  // Test 3: Verify Marketplace Catalog
  console.log('\n--- Test 3: Marketplace Catalog on fresh PC ---');
  const resMarketplace = await fetch(`${baseUrl}/api/marketplace/agents`);
  const marketData = await resMarketplace.json();
  assert.strictEqual(marketData.success, true);

  const ruxtMarket = marketData.agents.find(a => a.slug === 'ruxt');
  assert.ok(ruxtMarket, 'RuXt must be in marketplace catalog');
  assert.strictEqual(ruxtMarket.isInstalled, true, 'RuXt must show as installed');

  const julianMarket = marketData.agents.find(a => a.slug === 'julian-vance');
  assert.ok(julianMarket, 'Julian Vance must be in marketplace catalog');
  assert.strictEqual(julianMarket.isInstalled, false, 'Julian Vance must NOT be installed on fresh PC');

  const damonMarket = marketData.agents.find(a => a.slug === 'damon-cole');
  assert.ok(damonMarket, 'Damon Cole must be in marketplace catalog');
  assert.strictEqual(damonMarket.isInstalled, false, 'Damon Cole must NOT be installed on fresh PC');
  console.log('✓ Marketplace correctly marks RuXt as installed and specialists as not installed.');

  // Test 4: Install a specialist from package
  console.log('\n--- Test 4: Install specialist (Julian Vance) from package ---');
  const installRes = await fetch(`${baseUrl}/api/marketplace/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: 'julian-vance' })
  });
  const installData = await installRes.json();
  assert.strictEqual(installData.success, true, `Install failed: ${installData.error}`);
  console.log('✓ Installed Julian Vance from .ruxt package archive.');

  // Test 5: Verify Active Agents now has RuXt + Julian Vance
  console.log('\n--- Test 5: Active agents after installing Julian Vance ---');
  const resAgentsAfter = await fetch(`${baseUrl}/api/agents?refresh=true`);
  const agentsAfter = await resAgentsAfter.json();
  assert.strictEqual(agentsAfter.count, 2, `Expected 2 agents, got ${agentsAfter.count}`);
  const slugs = agentsAfter.agents.map(a => a.slug);
  assert.ok(slugs.includes('ruxt'), 'RuXt must still be present');
  assert.ok(slugs.includes('julian-vance'), 'Julian Vance must now be present');
  console.log(`✓ Active agents now has ${agentsAfter.count} agents: ${slugs.join(', ')}`);

  // Test 6: Verify RuXt cannot be uninstalled
  console.log('\n--- Test 6: RuXt protected from uninstallation ---');
  const uninstallRuxtRes = await fetch(`${baseUrl}/api/marketplace/uninstall/ruxt`, {
    method: 'DELETE'
  });
  assert.strictEqual(uninstallRuxtRes.status, 400, 'Uninstalling RuXt must be rejected with 400');
  console.log('✓ Protection confirmed: RuXt (Lead) cannot be uninstalled.');

  // Test 7: Uninstall Julian Vance
  console.log('\n--- Test 7: Uninstall Julian Vance ---');
  const uninstallJulianRes = await fetch(`${baseUrl}/api/marketplace/uninstall/julian-vance`, {
    method: 'DELETE'
  });
  const uninstallJulianData = await uninstallJulianRes.json();
  assert.strictEqual(uninstallJulianData.success, true);

  const resAgentsFinal = await fetch(`${baseUrl}/api/agents?refresh=true`);
  const agentsFinal = await resAgentsFinal.json();
  assert.strictEqual(agentsFinal.count, 1, `Expected back to 1 agent, got ${agentsFinal.count}`);
  assert.strictEqual(agentsFinal.agents[0].slug, 'ruxt');
  console.log('✓ Successfully uninstalled Julian Vance; squad returned to only RuXt (Lead).');

  console.log('\n========================================');
  console.log(' ALL FRESH PC INSTALLATION TESTS PASSED! ');
  console.log('========================================\n');

  // Clean up temp dir
  try {
    fs.rmSync(tempFreshDataDir, { recursive: true, force: true });
  } catch (_) {}

  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  try {
    fs.rmSync(tempFreshDataDir, { recursive: true, force: true });
  } catch (_) {}
  process.exit(1);
});
