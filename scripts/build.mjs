import {cp,mkdir} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
execFileSync(process.execPath,['--test','tests/unit/core.test.mjs','tests/integration/api.test.mjs','tests/unit/rate.test.mjs'],{stdio:'inherit'});
await import('./assets.mjs');await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'});
// Live storage checks are explicit: ordinary builds must not write guest records.
if(process.env.WEDDING_RUN_LIVE_CHECKS==='1'){await import('./smoke-store.mjs');await import('./live-check.mjs');}
console.log('WEDDING_BUILD_OK');
