import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';

test('admin, public content, contact inbox and persistence',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'hamie-test-'));
 const password=randomBytes(24).toString('hex');
 const port=String(35000+Math.floor(Math.random()*10000)),base='http://127.0.0.1:'+port;
 const env={...process.env,DATA_DIR:dir,PORT:port,ADMIN_PASSWORD:password};
 let child,cookie='';
 async function start(){
  child=spawn(process.execPath,['server/index.mjs'],{env,stdio:['ignore','pipe','pipe']});
  for(let n=0;n<100;n++){try{if((await fetch(base+'/api/content')).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}
  throw new Error('Server failed to start');
 }
 async function stop(){if(child&&child.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
 async function req(path,method='GET',data,extra={}){
  return fetch(base+path,{method,headers:{...(data?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...extra},body:data?JSON.stringify(data):undefined});
 }
 try{
  assert.equal(spawnSync(process.execPath,['server/create-admin.mjs','test-admin'],{env}).status,0);
  await start();
  await t.test('protects admin data, uploads, secrets and cross-origin requests',async()=>{
   for(const path of ['/api/admin/content','/api/admin/messages','/api/admin/media'])assert.equal((await req(path)).status,401);
   assert.equal((await req('/api/admin/media','POST',{name:'x',data:''})).status,401);
   for(const path of ['/server/store.mjs','/data/hamie.sqlite','/.env','/.git/config'])assert.equal((await req(path)).status,404);
   assert.equal((await req('/api/admin/login','POST',{username:'test-admin',password},{Origin:'https://untrusted.example'})).status,403);
   assert.equal((await req('/api/admin/login','POST',{username:'test-admin',password:'wrong-password'})).status,401);
   const login=await req('/api/admin/login','POST',{username:'test-admin',password});assert.equal(login.status,200);
   const set=login.headers.get('set-cookie');assert.match(set,/HttpOnly/);assert.match(set,/SameSite=Strict/);cookie=set.split(';')[0];
  });
  let item,uploaded;
  await t.test('uploads images, publishes menu, filters drafts and validates changes',async()=>{
   const initial=await(await req('/api/content')).json();assert.equal(initial.menu.length,9);
   assert.equal((await req('/api/admin/media','POST',{name:'bad.svg',data:Buffer.from('<svg/>').toString('base64')})).status,400);
   const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=';
   const upload=await req('/api/admin/media','POST',{name:'test.png',data:png});assert.equal(upload.status,201);uploaded=await upload.json();assert.equal((await req(uploaded.url)).status,200);
   const input={name:'Cà phê kiểm tra',category:'coffee',description:'Kiểm tra giá theo size',image:uploaded.url,prices:[{size:'M',price:35000},{size:'L',price:45000}],published:false};
   let res=await req('/api/admin/menu','POST',input);assert.equal(res.status,200);item=await res.json();
   assert.ok(!(await(await req('/api/content')).json()).menu.some(x=>x.id===item.id));
   res=await req('/api/admin/menu','POST',{...item,published:true});assert.equal(res.status,200);
   assert.equal((await(await req('/api/content')).json()).menu.find(x=>x.id===item.id).prices[1].price,45000);
   assert.equal((await req('/api/admin/menu','POST',{...item,prices:[{size:'M',price:-1}]})).status,400);
   assert.equal((await req('/api/admin/menu','POST',{...item,image:'https://untrusted.example/image.png'})).status,400);
  });
  await t.test('saves social links and images without exposing private inbox',async()=>{
   const c=await(await req('/api/admin/content')).json();
   assert.equal((await req('/api/admin/settings','PUT',{...c.settings,facebook:'javascript:alert(1)'})).status,400);
   assert.equal((await req('/api/admin/settings','PUT',{...c.settings,facebook:'https://www.facebook.com/hamie',tiktok:'https://www.tiktok.com/@hamie'})).status,200);
   assert.equal((await req('/api/admin/images','PUT',{slot:'hero-coffee.png',image:uploaded.url})).status,200);
   const publicData=await(await req('/api/content')).json();assert.equal(publicData.images['hero-coffee.png'],uploaded.url);assert.equal(publicData.messages,undefined);
  });
  await t.test('validates contact submissions and receives them only in admin',async()=>{
   const message={fullName:'Khách thử',contactInfo:'test@example.com',subject:'Kiểm tra liên hệ',message:'Lời nhắn kiểm tra hộp thư admin.',privacyConsent:true};
   assert.equal((await req('/api/contact','POST',{...message,privacyConsent:false})).status,400);
   assert.equal((await req('/api/contact','POST',{...message,contactInfo:'invalid'})).status,400);
   assert.equal((await req('/api/contact','POST',message)).status,201);
   const inbox=await(await req('/api/admin/messages')).json();assert.equal(inbox.length,1);assert.equal(inbox[0].message,message.message);
   assert.equal((await req('/api/admin/messages/'+inbox[0].id,'PUT',{status:'done'})).status,200);
  });
  await t.test('persists content, uploaded files and messages after restart',async()=>{
   await stop();await start();
   assert.ok((await(await req('/api/content')).json()).menu.some(x=>x.id===item.id));
   assert.equal((await req(uploaded.url)).status,200);
   assert.equal((await(await req('/api/admin/messages')).json())[0].status,'done');
   assert.equal((await req('/api/admin/menu/'+item.id,'DELETE')).status,200);
   assert.ok(!(await(await req('/api/content')).json()).menu.some(x=>x.id===item.id));
   assert.equal((await req('/api/admin/logout','POST')).status,200);
   assert.equal((await req('/api/admin/content')).status,401);
  });
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
