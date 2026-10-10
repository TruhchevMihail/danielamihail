import {blobStore,createResponse,listResponses} from '../lib/storage.js';
import {validateRsvp} from '../lib/validation.js';
const input={requestId:'1b2e38ba-ab26-48a6-9ea4-6c1dc2c0f7f1',guestCount:1,guests:['SITE TEST - NOT A GUEST'],accommodation:false,allergies:'',wish:'Synthetic setup test. Not a wedding guest. May be removed in the owner panel.',song:'',website:''};
const store=await blobStore();const v=validateRsvp(input,Date.parse('2026-10-09T12:00:00Z'));
await createResponse(store,v);const retry=await createResponse(store,v);if(!retry.duplicate)throw new Error('Idempotence verification failed');
const records=await listResponses(store);if(!records.some(r=>r.requestId===input.requestId))throw new Error('Stored record not readable');
console.log('REAL_PRIVATE_STORAGE_CHECK_OK '+input.requestId);
