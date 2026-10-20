// Keeps the studio's servers running (so several recorders can share them): node lib/site-up.mjs
import { DEV, STATIC, startSite } from './site.mjs';
await startSite();
console.log(`dev ${DEV} · static ${STATIC}`);
setInterval(() => {}, 1 << 30);
