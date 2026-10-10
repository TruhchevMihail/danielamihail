import {createHash} from 'node:crypto';
import {validId} from './validation.js';
export function payloadDigest(v){return createHash('sha256').update(JSON.stringify({guestCount:v.guestCount,guests:v.guests,accommodation:v.accommodation,allergies:v.allergies,wish:v.wish,song:v.song})).digest('hex');}
export async function blobStore(){if(!process.env.BLOB_READ_WRITE_TOKEN)throw new Error('storage_not_configured');return await import('@vercel/blob');}
export async function createResponse(store,validated,nowMs=Date.now()){
 const path=`rsvps/${validated.requestId}.json`,digest=payloadDigest(validated);const record={version:1,...validated,receivedAt:new Date(nowMs).toISOString(),payloadDigest:digest};
 try {await store.put(path,JSON.stringify(record),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});return {record,duplicate:false};}
 catch(error){let existing;try{existing=await store.get(path,{access:'private',useCache:false});}catch{throw error;}if(!existing)throw error;const saved=await new Response(existing.stream).json();if(saved.requestId===validated.requestId&&saved.payloadDigest===digest)return {record:saved,duplicate:true};const conflict=new Error('conflict');conflict.code='conflict';conflict.status=409;throw conflict;}
}
export async function listResponses(store){const records=[];let cursor;do{const page=await store.list({prefix:'rsvps/',cursor,limit:100});for(const b of page.blobs){const file=await store.get(b.pathname,{access:'private',useCache:false});if(file)records.push(await new Response(file.stream).json());}cursor=page.hasMore?page.cursor:undefined;}while(cursor);return records.sort((a,b)=>b.receivedAt.localeCompare(a.receivedAt));}
export async function deleteResponse(store,id){if(!validId(id))throw new Error('invalid_id');await store.del(`rsvps/${id}.json`);}
