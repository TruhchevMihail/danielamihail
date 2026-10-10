import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const assets=JSON.parse(await fs.readFile('assets-manifest.json','utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
// Retained Git production snapshot has the same checksum-verified assets.
const fallback='https://daniela-mihail-wedding-gt1wx78lm-truhchevmihails-projects.vercel.app';
for(const asset of assets){
 let bytes;
 try{bytes=await fs.readFile(asset.path)}catch{}
 if(bytes&&bytes.length===asset.size&&digest(bytes)===asset.sha256)continue;
 let failure;
 for(const url of [asset.url,new URL(new URL(asset.url).pathname,fallback).href]){
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
   if(!response.ok)throw Error('Asset download failed: '+asset.path+' '+response.status);
   const candidate=Buffer.from(await response.arrayBuffer());
   if(candidate.length!==asset.size||digest(candidate)!==asset.sha256)throw Error('Asset checksum mismatch: '+asset.path);
   bytes=candidate;failure=null;break;
  }catch(error){failure=error}
 }
 if(failure)throw failure;
 await fs.mkdir(path.dirname(asset.path),{recursive:true});
 await fs.writeFile(asset.path,bytes);
}
console.log('Approved images and fonts verified; original portrait unchanged.');
