import http from 'node:http';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { db, root, dataDir, getContent, saveContent, verifyPassword, assetNames } from './store.mjs';

const port = Number(process.env.PORT || 3000);
const publicFiles = new Set(['index.html','thuc-don.html','ve-hamie.html','khong-gian.html','uu-dai.html','goc-hamie.html','lien-he.html','styles.css','script.js','header.css','header.js','social-icons.css','image-preview.css','image-preview.js','content.js','content.css']);
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp' };
const limits=new Map();
function limited(key, max, window=600000) {
 const now=Date.now(); let item=limits.get(key);
 if (!item || item.until<now) { item={count:0,until:now+window}; limits.set(key,item); }
 if (limits.size>10000) for (const [k,v] of limits) if(v.until<now) limits.delete(k);
 return ++item.count>max;
}
function fail(status,message) { throw Object.assign(new Error(message),{status}); }
function json(res,status,value) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
async function body(req,max=128*1024) {
 if (!req.headers['content-type']?.startsWith('application/json')) fail(415,'Yêu cầu dữ liệu JSON.');
 let size=0;const chunks=[];
 for await(const chunk of req) { size+=chunk.length;if(size>max) fail(413,'Dữ liệu vượt quá giới hạn.');chunks.push(chunk); }
 try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { fail(400,'Dữ liệu không hợp lệ.'); }
}
function text(value,max=200,required=false) { if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(400,'Thông tin bị thiếu hoặc quá dài.');return value.trim(); }
function image(value) {
 value=text(value,250,true);
 if (!/^\/?(?:assets\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp)|uploads\/[a-f0-9-]+\.(?:png|jpg|webp))$/.test(value)) fail(400,'Vui lòng chọn ảnh trong thư viện.');
 return value;
}
function networkUrl(value,kind) {
 value=text(value,500); if(!value)return '';
 let url;try {url=new URL(value);}catch{fail(400,'Liên kết mạng xã hội không hợp lệ.');}
 const hosts={facebook:['facebook.com','fb.com','fb.me'],zalo:['zalo.me','zaloapp.com'],tiktok:['tiktok.com']};
 if(url.protocol!=='https:'||url.username||url.password||!hosts[kind].some(h=>url.hostname===h||url.hostname.endsWith('.'+h)))fail(400,`Vui lòng nhập liên kết HTTPS đúng của ${kind}.`);
 return url.href;
}
const tokenHash=v=>createHash('sha256').update(v).digest('hex');
function auth(req) {
 const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('hamie_session='))?.slice(14);
 const user=token&&db.prepare('SELECT username FROM sessions WHERE token=? AND expires>?').get(tokenHash(token),Date.now());
 if(!user)fail(401,'Vui lòng đăng nhập.');return {username:user.username,token};
}
function sameOrigin(req) {
 const origin=req.headers.origin;
 const expected=process.env.PUBLIC_ORIGIN;
 if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Yêu cầu không hợp lệ.');
 if(origin){let parsed;try{parsed=new URL(origin);}catch{fail(403,'Yêu cầu không hợp lệ.');}
 if(expected ? origin!==expected : parsed.host!==req.headers.host)fail(403,'Yêu cầu không hợp lệ.');}
}
function secureCookie(req){return process.env.COOKIE_SECURE==='true'||req.socket.encrypted;}
function cookie(req,value,age){return `hamie_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookie(req)?'; Secure':''}`;}

const server=http.createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
 try {
 const url=new URL(req.url,'http://localhost');const path=decodeURIComponent(url.pathname);
 if(!['GET','HEAD','POST','PUT','DELETE'].includes(req.method))fail(405,'Phương thức không được hỗ trợ.');
 if(!['GET','HEAD'].includes(req.method))sameOrigin(req);
 if(path==='/api/content'&&req.method==='GET'){const c=getContent();return json(res,200,{...c,menu:c.menu.filter(x=>x.published)});}
 if(path==='/api/contact'&&req.method==='POST'){
  if(limited('contact:'+req.socket.remoteAddress,10))fail(429,'Bạn gửi quá nhiều tin nhắn. Vui lòng thử lại sau.');
  const input=await body(req);const name=text(input.fullName,100,true),contact=text(input.contactInfo,150,true),subject=text(input.subject,200,true),message=text(input.message,5000,true);
  if(name.length<2||message.length<10||input.privacyConsent!==true||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)||/^(?:\+?84|0)[\d\s().-]{8,13}$/.test(contact)))fail(400,'Vui lòng kiểm tra tên, email/số điện thoại, nội dung và đồng ý xử lý dữ liệu.');
  db.prepare('INSERT INTO messages(id,name,contact,subject,message,created) VALUES(?,?,?,?,?,?)').run(randomUUID(),name,contact,subject,message,new Date().toISOString());
  return json(res,201,{ok:true});
 }
 if(path==='/api/admin/login'&&req.method==='POST'){
  if(limited('login:'+req.socket.remoteAddress,20))fail(429,'Đăng nhập quá nhiều lần. Vui lòng thử lại sau 10 phút.');
  const input=await body(req);const username=text(input.username,80,true),password=text(input.password,300,true);
  const user=db.prepare('SELECT hash FROM admins WHERE username=?').get(username);
  if(!verifyPassword(password,user?.hash))fail(401,'Tên đăng nhập hoặc mật khẩu không đúng.');
  const token=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  db.prepare('INSERT INTO sessions(token,username,expires) VALUES(?,?,?)').run(tokenHash(token),username,Date.now()+28800000);
  res.setHeader('Set-Cookie',cookie(req,token,28800));return json(res,200,{username});
 }
 if(path.startsWith('/api/admin/')){
  const user=auth(req);
  if(path==='/api/admin/session'&&req.method==='GET')return json(res,200,{username:user.username});
  if(path==='/api/admin/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(tokenHash(user.token));res.setHeader('Set-Cookie',cookie(req,'',0));return json(res,200,{ok:true});}
  if(path==='/api/admin/content'&&req.method==='GET')return json(res,200,getContent());
  if(path==='/api/admin/settings'&&req.method==='PUT'){
   const input=await body(req),c=getContent();c.settings={address:text(input.address,300,true),hours:text(input.hours,150,true),phone:text(input.phone,30),facebook:networkUrl(input.facebook,'facebook'),zalo:networkUrl(input.zalo,'zalo'),tiktok:networkUrl(input.tiktok,'tiktok')};
   if(c.settings.phone&&!/^\+?[\d\s().-]{8,25}$/.test(c.settings.phone))fail(400,'Số điện thoại không hợp lệ.');
   saveContent(c);return json(res,200,c.settings);
  }
  if(path==='/api/admin/menu'&&req.method==='POST'){
   const input=await body(req),c=getContent();
   if(!['coffee','tea','fruit','blended'].includes(input.category))fail(400,'Danh mục không hợp lệ.');
   if(!Array.isArray(input.prices)||input.prices.length>10)fail(400,'Tối đa 10 lựa chọn giá.');
   const item={id:input.id?text(input.id,100,true):randomUUID(),name:text(input.name,150,true),category:input.category,description:text(input.description,1000),image:image(input.image),published:input.published===true,prices:input.prices.map(x=>{if(!Number.isInteger(x.price)||x.price<0||x.price>100000000)fail(400,'Giá phải là số nguyên không âm.');return {size:text(x.size,30,true),price:x.price};})};
   const index=c.menu.findIndex(x=>x.id===item.id);if(input.id&&index<0)fail(404,'Món không còn tồn tại.');if(index<0)c.menu.push(item);else c.menu[index]=item;
   saveContent(c);return json(res,200,item);
  }
  if(path.startsWith('/api/admin/menu/')&&req.method==='DELETE'){
   const c=getContent();c.menu=c.menu.filter(x=>x.id!==path.split('/').pop());saveContent(c);return json(res,200,{ok:true});
  }
  if(path==='/api/admin/images'&&req.method==='PUT'){
   const input=await body(req),c=getContent();if(!assetNames.includes(input.slot))fail(400,'Vị trí ảnh không hợp lệ.');
   if(input.image)c.images[input.slot]=image(input.image);else delete c.images[input.slot];saveContent(c);return json(res,200,c.images);
  }
  if(path==='/api/admin/media'&&req.method==='GET')return json(res,200,db.prepare('SELECT * FROM media ORDER BY created DESC').all());
  if(path==='/api/admin/media'&&req.method==='POST'){
   const input=await body(req,12*1024*1024);const name=text(input.name,200,true);
   if(typeof input.data!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.data))fail(400,'Tệp ảnh không hợp lệ.');
   const bytes=Buffer.from(input.data,'base64');if(bytes.length>8*1024*1024)fail(413,'Ảnh tối đa 8 MB.');
   let ext;
   if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';
   else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';
   else if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')ext='webp';
   else fail(400,'Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.');
   const id=randomUUID(),url=`/uploads/${id}.${ext}`,created=new Date().toISOString();await writeFile(resolve(dataDir,'uploads',`${id}.${ext}`),bytes,{flag:'wx'});
   db.prepare('INSERT INTO media(id,name,url,created) VALUES(?,?,?,?)').run(id,name,url,created);return json(res,201,{id,name,url,created});
  }
  if(path==='/api/admin/messages'&&req.method==='GET')return json(res,200,db.prepare('SELECT * FROM messages ORDER BY created DESC').all());
  if(path.startsWith('/api/admin/messages/')&&req.method==='PUT'){
   const input=await body(req);if(!['new','read','done'].includes(input.status))fail(400,'Trạng thái không hợp lệ.');
   const result=db.prepare('UPDATE messages SET status=? WHERE id=?').run(input.status,path.split('/').pop());if(!result.changes)fail(404,'Không tìm thấy tin nhắn.');return json(res,200,{ok:true});
  }
  fail(404,'Không tìm thấy API.');
 }
 if(path.startsWith('/api/'))fail(404,'Không tìm thấy API.');
 if(!['GET','HEAD'].includes(req.method))fail(405,'Phương thức không được hỗ trợ.');
 let file;
 if(path==='/admin'||path==='/admin/')file=resolve(root,'admin/index.html');
 else if(/^\/admin\/(?:admin\.js|admin\.css)$/.test(path))file=resolve(root,path.slice(1));
 else if(/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(path))file=resolve(dataDir,path.slice(1));
 else if(/^\/assets\/[a-zA-Z0-9._-]+\.png$/.test(path))file=resolve(root,path.slice(1));
 else {const key=path==='/'?'index.html':path.slice(1).replace(/\/$/,'');const name=publicFiles.has(key)?key:key+'.html';if(publicFiles.has(name))file=resolve(root,name);}
 if(!file)fail(404,'Không tìm thấy trang.');
 let bytes;try{if(!(await stat(file)).isFile())fail(404,'Không tìm thấy tệp.');bytes=await readFile(file);}catch{fail(404,'Không tìm thấy tệp.');}
 res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch(error){if(!res.headersSent)json(res,error.status||500,{error:error.status?error.message:'Có lỗi hệ thống. Vui lòng thử lại.'});else res.end();if(!error.status)console.error(error);}
});
server.listen(port,'0.0.0.0',()=>console.log(`HAMIE: http://localhost:${port} | Admin: /admin/`));
