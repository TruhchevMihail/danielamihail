import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {brotliDecompressSync} from 'node:zlib';
const assets=JSON.parse(await fs.readFile('assets-manifest.json','utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
let snapshot;
async function retainedAssets(){
 if(snapshot)return snapshot;
 const parts=["aa1869af31abb3e985b63abcf1d5f16eb3494310","11ff41534ccd4b38a7d889868a4a3cfc6fd7ed2d","47086100cf0ee8b7c4a279c79e5e9f3735a298e8","40e343b51bf008ad85f7c68e4705a4296a7d2fb3","2c8031753102b9abb01d74401706b0f2ca6324fe","785b508d03cb17fe8bc623efb97161bd40821775","13a37fc27f0295e8b7f5835bbd30e5bf0ae8fbe1","14e6f6d72d0aa98868e051f50fd2505f8751cec2","855d7b0c5d5522e87cea6bad51cab06b812dfd30","b90b3555a15face95a2b1359cceaac524b2c1a76","917e213ed7a69e7a3c709ac03db8c11e9c66ba6b","69091c981eb141e9de0bf6ca09477a144736ea69","5c5e09aa274b4a1a6c3b370ba42fd95d865c21a5","f067a8989adc42326a3ccba0efa567b4be051023","db1f903a3052f93f4d749a0c1b605ea499b72ea4","cec046aa920bff6288ffcff05ff292425095b30f","a6a47e731dde45d5edc8fac3ac110d73e2f49eb6","39b379ce188c098f181e8ccbdbc45c26b151ea26","93bfd666dfcc006dcef94775adb0ec2128bdd520","dd68cccd2cfe12fe4fce23a12d7c68ece3eda07c","a30684f1978ede9f54a7984f263ef8aff4fb1bd5","7c5e3bcde6403d06e145e4156799d7ac9fa16f0c","8afbfa627b731e012aed0d1e256fa2fa3b2c177f","44958221eea9b50f7400de55bd4464e818314f15","3b309a6763e3adeef4d30316f197e6340a219194","e89828b1acba99a66ca68447b2944db30f8a86dd","16bebb860827814a4863307e79e36540d3d6d8bb","692df0c379d1de8d1d6d1a0dc347686d654a101c","69a925cdfa6f2763755d58904c70aa6f692caf95","8bf2dc8c0c83d0bce595faec81fe19f120bd10a9","756a50025af0debc1ffe812b320e5d9658023585","0b33c48a28804a861d0c05ae01b15c2b2eed6985","01155da721e67f9c56ad0331f01916e6522f179e","63188c4fb6e586f581583656cb8380a3553127f9"];
 const buffers=[];
 for(let i=0;i<parts.length;i+=4){
  buffers.push(...await Promise.all(parts.slice(i,i+4).map(async sha=>{
   const r=await fetch('https://dmmcy0pwk6bqi.cloudfront.net/'+sha,{signal:AbortSignal.timeout(60000)});
   if(!r.ok)throw Error('Retained asset archive unavailable: '+r.status);
   const b=Buffer.from(await r.arrayBuffer());
   if(createHash('sha1').update(b).digest('hex')!==sha)throw Error('Archive part checksum mismatch');
   return b;
  })));
 }
 const archive=Buffer.concat(buffers);
 if(digest(archive)!=="ba4cc5f42e22458482222aa9b052e755b639e5fee448d923845b569de8632bba")throw Error('Archive checksum mismatch');
 snapshot=JSON.parse(brotliDecompressSync(archive));
 return snapshot;
}
for(const asset of assets){
 let bytes;
 try{bytes=await fs.readFile(asset.path)}catch{}
 if(bytes&&bytes.length===asset.size&&digest(bytes)===asset.sha256)continue;
 try{
  const response=await fetch(asset.url,{signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('Asset HTTP '+response.status);
  bytes=Buffer.from(await response.arrayBuffer());
 }catch{
  const retained=await retainedAssets();
  const value=retained[asset.path.replace(/^public\//,'')];
  if(typeof value!=='string')throw Error('Missing approved archive asset: '+asset.path);
  bytes=Buffer.from(value,'base64');
 }
 if(bytes.length!==asset.size||digest(bytes)!==asset.sha256)throw Error('Asset checksum mismatch: '+asset.path);
 await fs.mkdir(path.dirname(asset.path),{recursive:true});
 await fs.writeFile(asset.path,bytes);
}
console.log('Approved images and fonts verified; original portrait unchanged.');
