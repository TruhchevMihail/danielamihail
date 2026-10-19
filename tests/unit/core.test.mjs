import test from 'node:test';
import {readFileSync} from 'node:fs';

test('dress code shows the approved palette and black suit with white shirt',()=>{
 const source=readFileSync(new URL('../../src/Wedding.tsx',import.meta.url),'utf8');
 const section=source.match(/<section id="style"[\s\S]*?<\/section>/)?.[0]||'';
 for(const label of ['За дамите','За господата','Пепел от рози','Нежно розово','Пепелно лилаво','Салвия','Лавандула','Пудрено синьо','Таупе','Златист блясък','Сребрист блясък','Черен костюм с бяла риза.','Бялото запазваме за булката.'])assert.ok(section.includes(label),`Missing dress code: ${label}`);
 assert.equal((section.match(/className="dress-swatch(?: |")/g)||[]).length,9);
 assert.doesNotMatch(section,/Няма задължителен дрескод|шампанско/i);
});
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WEDDING} from '../../public/config.js';
import {validateRsvp, ValidationError} from '../../lib/validation.js';
import {countdownParts} from '../../public/js/countdown.js';
import {hashPassword,verifyPassword,issueSession,verifySession} from '../../lib/auth.js';
import {createResponse,listResponses} from '../../lib/storage.js';
import {toCsv,summarizeResponses} from '../../lib/csv.js';
import {requireSameOrigin,readJson} from '../../lib/http.js';
import {Readable} from 'node:stream';
const now=Date.parse('2026-10-09T20:00:00+03:00');
const input=(over={})=>({requestId:randomUUID(),guestCount:2,guests:['\u0414\u0430\u043d\u0438\u0435\u043b\u0430 \u0422\u0435\u0441\u0442','Guest Two'],accommodation:false,allergies:'',wish:'',song:'',website:'',...over});
function fakeStore(){const data=new Map();return {data,async put(p,b){if(data.has(p)){const e=new Error('exists');e.name='BlobAlreadyExistsError';throw e;}data.set(p,b);return {pathname:p};},async get(p){return data.has(p)?{stream:new Blob([data.get(p)]).stream()}:null;},async list({prefix,cursor}){const blobs=[...data.keys()].filter(p=>p.startsWith(prefix)).map(pathname=>({pathname}));const start=Number(cursor||0);return{blobs:blobs.slice(start,start+1),hasMore:start+1<blobs.length,cursor:start+1<blobs.length?String(start+1):undefined};},async del(p){data.delete(p);}}}
test('exact witness name and program',()=>{assert.equal(WEDDING.witnesses[1],'\u041a\u0440\u0438\u0441\u0442\u0438\u0430\u043d\u0430 \u0422\u0430\u043a\u0435\u0432\u0430');assert.deepEqual(WEDDING.program.map(x=>x.time),['11:30','13:00','17:30']);assert.deepEqual(Object.values(WEDDING.locations),[null,null,null]);});
test('countdown exact and nonnegative',()=>{assert.deepEqual(countdownParts(0,90061000),{days:1,hours:1,minutes:1,seconds:1,finished:false});assert.deepEqual(countdownParts(10,0),{days:0,hours:0,minutes:0,seconds:0,finished:true});});
test('deadline final millisecond accepted midnight rejected',()=>{assert.ok(validateRsvp(input(),Date.parse('2027-07-01T23:59:59.999+03:00')));assert.throws(()=>validateRsvp(input(),Date.parse(WEDDING.rsvpClosesAt)),e=>e.code==='deadline_closed');});
test('unicode names normalized',()=>{const r=validateRsvp(input({guests:['  \u0410\u043d\u043d\u0430   \u041f\u0435\u0442\u0440\u043e\u0432\u0430 ','Jean-Luc O\'Neill']}),now);assert.equal(r.guests[0],'\u0410\u043d\u043d\u0430 \u041f\u0435\u0442\u0440\u043e\u0432\u0430');assert.equal('website' in r,false);});
for(const over of [{guestCount:0},{guestCount:21},{guestCount:1.5},{guestCount:'2'},{guests:['One']},{guests:[null,'Two']},{guests:['','Two']},{accommodation:null},{allergies:'a'.repeat(2001)},{wish:[]},{song:'x'.repeat(301)},{requestId:'../../etc/passwd'},{website:'bot'}])test('reject '+JSON.stringify(over).slice(0,90),()=>assert.throws(()=>validateRsvp(input(over),now),ValidationError));
test('null rejected',()=>assert.throws(()=>validateRsvp(null,now),ValidationError));
test('scrypt bounded password verification',async()=>{const h=await hashPassword('test-only-long-password');assert.equal(await verifyPassword('test-only-long-password',h),true);assert.equal(await verifyPassword('wrong',h),false);assert.equal(await verifyPassword({},h),false);assert.equal(await verifyPassword('x'.repeat(300),h),false);assert.equal(await verifyPassword('abc',''),false);});
test('session signed expires 7200s missing secret closed',()=>{const secret='test'.repeat(12);const s=issueSession(secret,now);assert.equal(verifySession(s.cookieValue,secret,now).role,'owner');assert.equal(verifySession(s.cookieValue,secret,now+7200000),null);assert.equal(verifySession(s.cookieValue+'a',secret,now),null);assert.equal(verifySession(s.cookieValue,'',now),null);assert.throws(()=>issueSession('',now));});
test('concurrent identical id one immutable record',async()=>{const store=fakeStore(),v=validateRsvp(input(),now);const r=await Promise.all([createResponse(store,v,now),createResponse(store,v,now)]);assert.equal(store.data.size,1);assert.deepEqual(r.map(x=>x.duplicate).sort(),[false,true]);assert.equal(r[0].record.requestId,r[1].record.requestId);await assert.rejects(createResponse(store,{...v,song:'different'},now),e=>e.code==='conflict');});
test('failure never succeeds',async()=>await assert.rejects(createResponse({put:async()=>{throw new Error('offline');}},validateRsvp(input(),now),now)));
test('all list pages sorted',async()=>{const s=fakeStore();for(let i=0;i<3;i++)await createResponse(s,validateRsvp(input(),now),now+i);const r=await listResponses(s);assert.equal(r.length,3);assert.ok(r[0].receivedAt>=r[2].receivedAt);});
test('CSV formula protection correct totals',()=>{const r=[{guests:['  =cmd','\u0418\u0432\u0430\u043d, \"X\"'],guestCount:2,accommodation:true,allergies:'\t@attack',song:'+cmd',wish:'hello\nworld',receivedAt:'date'}];const c=toCsv(r);assert.ok(c.startsWith('\ufeff'));assert.ok(c.includes("'  =cmd"));assert.ok(c.includes('""X""'));assert.ok(c.includes("'+cmd"));assert.equal(summarizeResponses(r).totalGuests,2);assert.equal(summarizeResponses(r).groupsNeedingAccommodation,1);});
test('exact origin required',()=>{assert.doesNotThrow(()=>requireSameOrigin({headers:{origin:'https://w.example'}},['https://w.example']));for(const origin of [null,'null','https://w.example.evil','https://evil'])assert.throws(()=>requireSameOrigin({headers:{origin}},['https://w.example']));});
test('body bounded without length',async()=>{const r=Readable.from([Buffer.alloc(16385)]);r.headers={};await assert.rejects(readJson(r),e=>e.status===413);const ok=Readable.from(['{"x":1}']);ok.headers={};assert.deepEqual(await readJson(ok),{x:1});});

test('generic BlobError duplicate verified by read',async()=>{const s=fakeStore(),v=validateRsvp(input(),now);await createResponse(s,v,now);s.put=async()=>{const e=new Error('Vercel Blob: This blob already exists');e.name='BlobError';throw e;};assert.equal((await createResponse(s,v,now)).duplicate,true);});
test('failed write with absent stored record remains failure',async()=>{const s={put:async()=>{throw new Error('offline');},get:async()=>null};await assert.rejects(createResponse(s,validateRsvp(input(),now)));});

test('guest list survives a transient private Blob read failure',async()=>{
 const record={receivedAt:'2026-10-10T00:00:00Z',guests:['Test fixture'],guestCount:1};
 let calls=0;
 const store={list:async()=>({blobs:[{pathname:'rsvps/test.json'}],hasMore:false}),get:async()=>{if(++calls===1)throw Error('Failed to fetch blob: 503 Service Unavailable');return {stream:new Blob([JSON.stringify(record)]).stream()};}};
 assert.deepEqual(await listResponses(store),[record]);assert.equal(calls,2);
});
test('guest list preserves permanent private storage access failures',async()=>{
 let calls=0;
 const store={list:async()=>({blobs:[{pathname:'rsvps/test.json'}],hasMore:false}),get:async()=>{calls++;throw Error('Failed to fetch blob: 403 Forbidden');}};
 await assert.rejects(listResponses(store),/403 Forbidden/);assert.equal(calls,1);
});
test('guest list stops after bounded transient read attempts',async()=>{
 let calls=0;
 const store={list:async()=>({blobs:[{pathname:'rsvps/test.json'}],hasMore:false}),get:async()=>{calls++;throw Error('Failed to fetch blob: 503 Service Unavailable');}};
 await assert.rejects(listResponses(store),/503 Service Unavailable/);assert.equal(calls,3);
});

test('successful admin login remains signed in when guest loading is temporarily unavailable',async()=>{
 const {readFile}=await import('node:fs/promises');const {runInNewContext}=await import('node:vm');
 const nodes=Object.fromEntries(['admin-login','admin-dashboard','admin-status','responses','password','guest-search','refresh','logout','totals'].map(id=>[id,{hidden:id==='admin-dashboard',value:'test-fixture',textContent:'',handlers:{},replaceChildren(){},addEventListener(event,fn){this.handlers[event]=fn;}}]));
 const button={disabled:false};nodes['admin-login'].querySelector=()=>button;
 let calls=0;const fetch=async()=>{const status=[401,200,503][calls++];return {status,ok:status===200,json:async()=>status===200?{ok:true}:{message:'temporary failure'}};};
 runInNewContext(await readFile('public/js/admin.js','utf8'),{document:{querySelector:s=>nodes[s.slice(1)]},fetch,confirm:()=>false});
 await new Promise(resolve=>setImmediate(resolve));
 await nodes['admin-login'].handlers.submit({preventDefault(){}});
 assert.equal(nodes['admin-login'].hidden,true);assert.equal(nodes['admin-dashboard'].hidden,false);
 assert.match(nodes['admin-status'].textContent,/Обнови/);
});
