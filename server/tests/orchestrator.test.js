import { matchBestSpecialist, assembleSpecialistSquad } from '../services/orchestrator.js';

console.log('--- Testing Orchestrator Upgrades ---');

const test1 = matchBestSpecialist('need a backend nodejs api with postgresql and docker');
console.log('Test 1 (Backend Query):', test1.name, `(${test1.slug})`);

const test2 = matchBestSpecialist('analyze my seo keywords and search console traffic');
console.log('Test 2 (SEO Query):', test2.name, `(${test2.slug})`);

const test3 = matchBestSpecialist('build a responsive car rental website in react');
console.log('Test 3 (Frontend Query):', test3.name, `(${test3.slug})`);

const test4 = matchBestSpecialist('calculate corporate tax and vat audit compliance');
console.log('Test 4 (Tax Query):', test4.name, `(${test4.slug})`);

const squad = assembleSpecialistSquad('build full ecommerce store with backend api and search console seo');
console.log('Squad Assembled:', squad.map(s => `${s.name} [${s.role}]`));

console.log('--- All tests completed successfully! ---');
process.exit(0);
