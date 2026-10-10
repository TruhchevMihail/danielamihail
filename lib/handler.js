import {takeLoginSlot} from './rate-limit.js';
import {createHash} from 'node:crypto';
import {WEDDING} from '../public/config.js';
import {validateRsvp,validId} from './validation.js';
import {readJson,requireSameOrigin,send,HttpError} from './http.js';
import {verifyPassword,issueSession,verifySession,adminCookie,cookieHeader} from './auth.js';
import {blobStore,createResponse,listResponses,deleteResponse} from './storage.js';
import {summarizeResponses,toCsv} from './csv.js';
import {MEDIA} from './media-manifest.js';
const publicMessages={deadline_closed:'\u0421\u0440\u043e\u043a\u044a\u0442 \u0437\u0430 \u043f\u043e\u0442\u0432\u044a\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u0438\u0437\u0442\u0435\u0447\u0435. \u041c\u043e\u043b\u044f, \u0441\u0432\u044a\u0440\u0436\u0435\u0442\u0435 \u0441\u0435 \u0441 \u043d\u0430\u0441 \u043b\u0438\u0447\u043d\u043e.',invalid_input:'\u041f\u0440\u043e\u0432\u0435\u0440\u0435\u0442\u0435 \u0438\u043c\u0435\u043d\u0430\u0442\u0430, \u0431\u0440\u043e\u044f \u0433\u043e\u0441\u0442\u0438 \u0438 \u0438\u0437\u0431\u043e\u0440\u0430 \u0437\u0430 \u043d\u0430\u0441\u0442\u0430\u043d\u044f\u0432\u0430\u043d\u0435.',conflict:'\u0422\u043e\u0437\u0438 \u043e\u0442\u0433\u043e\u0432\u043e\u0440 \u0432\u0435\u0447\u0435 \u0435 \u0437\u0430\u043f\u0438\u0441\u0430\u043d \u0441 \u0434\u0440\u0443\u0433\u0438 \u0434\u0430\u043d\u043d\u0438. \u0421\u0432\u044a\u0440\u0436\u0435\u0442\u0435 \u0441\u0435 \u0441 \u043d\u0430\u0441 \u0437\u0430 \u043f\u0440\u043e\u043c\u044f\u043d\u0430.'};
async function readRaw(req,max){if(Number(req.headers['content-length']||0)>max)throw new HttpError(413,'body_too_large');if(req.body!==undefined){const b=Buffer.isBuffer(req.body)?req.body:Buffer.from(typeof req.body==='string'?req.body:JSON.stringify(req.body));if(b.length>max)throw new HttpError(413,'body_too_large');return b;}let length=0,parts=[];for await(const part of req){const b=Buffer.from(part);length+=b.length;if(length>max)throw new HttpError(413,'body_too_large');parts.push(b);}return Buffer.concat(parts);}
export async function handleApi(req,res,{env=process.env,nowMs=Date.now(),storeFactory=blobStore}={}){
 try {
  const url=new URL(req.url,'https://local.invalid');const route=url.searchParams.get('route')||url.pathname.replace(/^\/api\//,'');
  const method=req.method||'GET';const allowed=[...String(env.ALLOWED_ORIGINS||'').split(','),...[env.VERCEL_URL,env.VERCEL_PROJECT_PRODUCTION_URL].filter(Boolean).map(v=>'https://'+v)].map(v=>v.trim()).filter(Boolean);
  if(route==='media'){
   const id=url.searchParams.get('id'),asset=MEDIA[id];if(!asset||!Object.hasOwn(MEDIA,id))throw new HttpError(404,'not_found');
   // Local activation can upload only the exact approved bytes: no arbitrary uploads, no personal records.
   if(req.headers.origin==='null'||allowed.includes(req.headers.origin)){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');}
   if(method==='OPTIONS'){res.statusCode=204;return res.end();}
   if(method!=='GET'&&method!=='POST')throw new HttpError(405,'method_not_allowed');
   if(method==='POST'){
    const body=await readRaw(req,asset.size+1);if(body.length!==asset.size||createHash('sha256').update(body).digest('hex')!==asset.sha256)throw new HttpError(400,'asset_mismatch');
    const store=await storeFactory();try{await store.put('approved-assets/'+asset.file,body,{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:asset.type});}catch(e){let existing;try{existing=await store.get('approved-assets/'+asset.file,{access:'private',useCache:false});}catch{throw e;}if(!existing)throw e;const b=Buffer.from(await new Response(existing.stream).arrayBuffer());if(createHash('sha256').update(b).digest('hex')!==asset.sha256)throw new Error('asset_unverified');}
    return send(res,200,{ok:true,id,sha256:asset.sha256});
   }
   const store=await storeFactory();const found=await store.get('approved-assets/'+asset.file,{access:'private'});if(!found)throw new HttpError(404,'asset_pending');
   res.statusCode=200;res.setHeader('Content-Type',asset.type);res.setHeader('Cache-Control','public, max-age=86400, immutable');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('ETag','"'+asset.sha256+'"');return res.end(Buffer.from(await new Response(found.stream).arrayBuffer()));
  }
  if(route==='status'&&method==='GET')return send(res,200,{ok:true,now:new Date(nowMs).toISOString(),rsvpOpen:nowMs<Date.parse(WEDDING.rsvpClosesAt)});
  if(route==='rsvp'){
   if(method!=='POST')throw new HttpError(405,'method_not_allowed');requireSameOrigin(req,allowed);
   if(!String(req.headers['content-type']||'').toLowerCase().startsWith('application/json'))throw new HttpError(415,'content_type');
   const validated=validateRsvp(await readJson(req),nowMs);const store=await storeFactory();const {record,duplicate}=await createResponse(store,validated,nowMs);
   return send(res,duplicate?200:201,{ok:true,confirmationId:record.requestId,receivedAt:record.receivedAt,duplicate});
  }
  if(route==='admin/login'){
   if(method!=='POST')throw new HttpError(405,'method_not_allowed');requireSameOrigin(req,allowed);
   if(!env.ADMIN_PASSWORD_HASH||!env.ADMIN_SESSION_SECRET)throw new HttpError(503,'not_configured');
   const body=await readJson(req,2048);await takeLoginSlot(await storeFactory(),String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unresolved').split(',')[0].trim(),env.ADMIN_SESSION_SECRET,nowMs);if(!await verifyPassword(body?.password,env.ADMIN_PASSWORD_HASH))throw new HttpError(401,'invalid_login');
   const session=issueSession(env.ADMIN_SESSION_SECRET,nowMs);res.setHeader('Set-Cookie',cookieHeader(session.cookieValue));return send(res,200,{ok:true,csrfToken:session.csrfToken});
  }
  if(route.startsWith('admin/')){
   const session=verifySession(adminCookie(req),env.ADMIN_SESSION_SECRET,nowMs);if(!session)throw new HttpError(401,'unauthorized');
   if(route==='admin/responses'&&method==='GET'){const records=await listResponses(await storeFactory());return send(res,200,{ok:true,records,summary:summarizeResponses(records),csrfToken:session.csrfToken});}
   if(route==='admin/csv'&&method==='GET'){const records=await listResponses(await storeFactory());res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Disposition','attachment; filename="wedding-guests.csv"');return res.end(toCsv(records));}
   requireSameOrigin(req,allowed);if(req.headers['x-csrf-token']!==session.csrfToken)throw new HttpError(403,'csrf');
   if(route==='admin/logout'&&method==='POST'){res.setHeader('Set-Cookie',cookieHeader('',0));return send(res,200,{ok:true});}
   if(route==='admin/delete'&&method==='DELETE'){const body=await readJson(req);if(!validId(body?.requestId))throw new HttpError(400,'invalid_id');await deleteResponse(await storeFactory(),body.requestId);return send(res,200,{ok:true});}
   throw new HttpError(405,'method_not_allowed');
  }
  throw new HttpError(404,'not_found');
 } catch(error){const status=error.status||503;if(status>=500)console.error('WEDDING_API_FAILURE',{endpoint:new URL(req.url,'https://local.invalid').pathname,name:error.name,code:error.code,storageHttpStatus:/^Failed to fetch blob: (\d{3})/.exec(String(error.message))?.[1],frames:String(error.stack||'').split('\n').filter(line=>line.trim().startsWith('at ')).slice(0,3)});if(status===429)res.setHeader('Retry-After','10');const code=status===503?'unavailable':error.code||'invalid_request';return send(res,status,{ok:false,code,message:publicMessages[code]||'\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435\u0442\u043e \u043d\u0435 \u0435 \u0437\u0430\u0432\u044a\u0440\u0448\u0435\u043d\u043e. \u041c\u043e\u043b\u044f, \u043e\u043f\u0438\u0442\u0430\u0439\u0442\u0435 \u043e\u0442\u043d\u043e\u0432\u043e.',...(error.fields?{fields:error.fields}:{})});}
}
