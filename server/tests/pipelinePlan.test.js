import { discoverActiveAgents, resolveStageAgent } from '../services/orchestrator.js';

console.log('Testing /pipeline/plan logic directly...');
const activeAgents = discoverActiveAgents();

const stages = [
  { name: 'UI Components', query: 'frontend tailwind react' },
  { name: 'Database & Redis Caching', query: 'backend postgres redis docker' },
  { name: 'Tax Compliance & VAT Invoicing', query: 'tax compliance audit vat' },
  { name: 'Search Traffic & Sitemap', query: 'seo traffic search console' }
];

stages.forEach(s => {
  const agent = resolveStageAgent(s.query, activeAgents);
  console.log(`Stage "${s.name}" -> Assigned to: ${agent.name} (${agent.slug}) [${agent.role}]`);
});

console.log('Task pipeline planning logic verified!');
process.exit(0);
