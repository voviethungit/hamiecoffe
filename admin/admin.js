'use strict';
const $ = selector => document.querySelector(selector);
let content, media = [], messages = [];
const labels = {overview:'Tổng quan',menu:'Thực đơn',media:'Thư viện ảnh',settings:'Thông tin & mạng xã hội',messages:'Hộp thư liên hệ'};
const slots = {'coffee.png':'Cà phê','matcha.png':'Trà & matcha','orange-tea.png':'Trái cây','hero-coffee.png':'Banner trang chủ','cozy-space.png':'Không gian quán','hamie-story.png':'Câu chuyện HAMIE'};
function el(tag, text, className) { const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node; }
function notify(message,error=false) {const node=$('#notice');node.textContent=message;node.className=error?'error':'';node.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>node.hidden=true,5000);}
async function api(path,method='GET',data) {
 const res=await fetch('/api/admin/'+path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
 const value=await res.json();if(!res.ok){if(res.status===401&&path!=='login')showLogin();throw new Error(value.error||'Không thể kết nối.');}return value;
}
function showLogin() {$('#appView').hidden=true;$('#loginView').hidden=false;$('#menuDialog').close();}
async function load() {
 [content,media,messages]=await Promise.all([api('content'),api('media'),api('messages')]);
 renderMenu();renderMedia();renderSettings();renderMessages();renderStats();
}
function renderStats() {$('#menuCount').textContent=content.menu.filter(x=>x.published).length;$('#mediaCount').textContent=media.length;const count=messages.filter(x=>x.status==='new').length;$('#messageCount').textContent=count;$('#unreadBadge').textContent=count?`(${count})`:'';}
function showTab(tab) {document.querySelectorAll('.panel').forEach(node=>node.hidden=node.id!==tab);document.querySelectorAll('[data-tab]').forEach(node=>node.classList.toggle('active',node.dataset.tab===tab));$('#pageTitle').textContent=labels[tab];}
function imageOptions(select,value) {
 select.replaceChildren();
 const options=[...Object.entries(slots).map(([file,label])=>({url:'assets/'+file,name:label+' (ảnh gốc)'})),...media];
 options.forEach(item=>{const option=el('option',item.name);option.value=item.url;select.append(option);});
 select.value=value||options[0].url;
}
const money=n=>new Intl.NumberFormat('vi-VN').format(n)+'đ';
function renderMenu() {
 const list=$('#menuList');list.replaceChildren();
 if(!content.menu.length)list.append(el('p','Chưa có món. Bấm “Thêm món” để bắt đầu.','empty'));
 content.menu.forEach(item=>{
  const card=el('article',undefined,'menu-item'),img=el('img');img.src=resolvedImage(item.image);img.alt=item.name;
  const details=el('div',undefined,'details');details.append(el('h3',item.name),el('p',item.prices.map(x=>x.size+': '+money(x.price)).join(' · ')||'Chưa có giá'),el('span',item.published?'Đang hiển thị':'Đang ẩn','tag'+(item.published?'':' draft')));
  const actions=el('div',undefined,'actions'),edit=el('button','Chỉnh sửa','secondary'),remove=el('button','Xoá','danger');
  edit.onclick=()=>openMenu(item);remove.onclick=async()=>{if(!confirm(`Xoá món “${item.name}”?`))return;try{await api('menu/'+item.id,'DELETE');await load();notify('Đã xoá món.');}catch(e){notify(e.message,true);}};
  actions.append(edit,remove);card.append(img,details,actions);list.append(card);
 });
}
function resolvedImage(url) {const file=url.replace(/^\//,'').replace(/^assets\//,'');return content.images[file]||('/'+url.replace(/^\//,''));}
function openMenu(item) {
 const form=$('#menuForm');form.reset();$('#menuError').textContent='';
 $('#menuDialogTitle').textContent=item?'Chỉnh sửa món':'Thêm món';
 for(const key of ['id','name','category','description'])form.elements[key].value=item?.[key]|| (key==='category'?'coffee':'');
 form.elements.published.checked=item?item.published:true;
 form.elements.prices.value=item?.prices.map(x=>`${x.size}, ${x.price}`).join('\n')||'';
 imageOptions($('#menuImage'),item?.image);updateMenuPreview();$('#menuDialog').showModal();
}
function updateMenuPreview() {$('#menuImagePreview').src=resolvedImage($('#menuImage').value);}
function renderMedia() {
 const grid=$('#imageSlots');grid.replaceChildren();
 Object.entries(slots).forEach(([file,label])=>{
  const card=el('article',undefined,'media-card'),img=el('img');img.src=content.images[file]||'/assets/'+file;img.alt=label;
  const field=el('label','Chọn ảnh thay thế'),select=el('select');select.setAttribute('aria-label','Ảnh thay thế: '+label);imageOptions(select,content.images[file]||'assets/'+file);field.append(select);
  const button=el('button','Lưu ảnh','secondary');button.onclick=async()=>{button.disabled=true;try{const selected=select.value==='assets/'+file?'':select.value;await api('images','PUT',{slot:file,image:selected});await load();notify('Đã cập nhật ảnh trên website.');}catch(e){notify(e.message,true);}finally{button.disabled=false;}};
  card.append(img,el('h3',label),field,button);grid.append(card);
 });
 const list=$('#mediaList');list.replaceChildren();
 if(!media.length)list.append(el('p','Chưa có ảnh tải lên.','empty'));
 media.forEach(item=>{const card=el('article',undefined,'media-card'),img=el('img');img.src=item.url;img.alt=item.name;card.append(img,el('h3',item.name));list.append(card);});
}
function renderSettings() {for(const [key,value] of Object.entries(content.settings))if($('#settingsForm').elements[key])$('#settingsForm').elements[key].value=value;}
function renderMessages() {
 const list=$('#messageList');list.replaceChildren();
 if(!messages.length)list.append(el('p','Chưa có lời nhắn nào. Khi khách gửi form liên hệ, tin nhắn sẽ xuất hiện ở đây.','empty'));
 messages.forEach(item=>{
  const card=el('article',undefined,'message-card');card.dataset.status=item.status;
  card.append(el('h3',item.subject),el('p',item.name+' · '+item.contact,'message-meta'),el('p',new Date(item.created).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),'message-meta'),el('div',item.message,'message-body'));
  const select=el('select');select.setAttribute('aria-label','Trạng thái tin nhắn: '+item.subject);
  for(const [value,label] of [['new','Chưa đọc'],['read','Đã đọc'],['done','Đã xử lý']]){const option=el('option',label);option.value=value;select.append(option);}select.value=item.status;
  select.onchange=async()=>{select.disabled=true;try{await api('messages/'+item.id,'PUT',{status:select.value});messages=await api('messages');renderMessages();renderStats();notify('Đã cập nhật trạng thái.');}catch(e){select.value=item.status;notify(e.message,true);}finally{select.disabled=false;}};card.append(select);list.append(card);
 });
}
$('#loginForm').onsubmit=async event=>{
 event.preventDefault();const button=event.submitter;button.disabled=true;$('#loginError').textContent='';
 try{const user=await api('login','POST',Object.fromEntries(new FormData(event.target)));await load();$('#account').textContent=user.username;$('#loginView').hidden=true;$('#appView').hidden=false;event.target.reset();}catch(e){$('#loginError').textContent=e.message;}finally{button.disabled=false;}
};
$('#logout').onclick=async()=>{try{await api('logout','POST');showLogin();}catch(e){notify(e.message,true);}};
document.querySelectorAll('[data-tab]').forEach(node=>node.onclick=()=>showTab(node.dataset.tab));
$('#addMenu').onclick=()=>openMenu();$('#closeMenu').onclick=()=>$('#menuDialog').close();$('#menuImage').onchange=updateMenuPreview;
$('#menuDialog').addEventListener('click',event=>{if(event.target===$('#menuDialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}});
$('#menuForm').onsubmit=async event=>{
 event.preventDefault();const form=event.target,button=event.submitter;$('#menuError').textContent='';
 try{
  const data=Object.fromEntries(new FormData(form));data.published=form.elements.published.checked;
  data.prices=data.prices.split('\n').filter(x=>x.trim()).map(line=>{const parts=line.split(',');if(parts.length!==2||!/^\d+$/.test(parts[1].trim()))throw new Error('Nhập giá theo dạng: M, 35000 (mỗi size một dòng).');return {size:parts[0].trim(),price:Number(parts[1].trim())};});
  button.disabled=true;await api('menu','POST',data);$('#menuDialog').close();await load();notify('Đã lưu món.');
 }catch(e){$('#menuError').textContent=e.message;}finally{button.disabled=false;}
};
$('#uploadForm').onsubmit=async event=>{
 event.preventDefault();const file=$('#uploadFile').files[0],button=event.submitter;
 if(!file)return;if(file.size>8*1024*1024)return notify('Ảnh tối đa 8 MB.',true);
 button.disabled=true;button.textContent='Đang tải…';
 try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});await api('media','POST',{name:file.name,data});event.target.reset();await load();notify('Đã tải ảnh lên thư viện.');}catch(e){notify(e.message,true);}finally{button.disabled=false;button.textContent='Tải ảnh';}
};
$('#settingsForm').onsubmit=async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await api('settings','PUT',Object.fromEntries(new FormData(event.target)));await load();notify('Đã lưu thông tin.');}catch(e){notify(e.message,true);}finally{button.disabled=false;}};
$('#refreshMessages').onclick=async()=>{try{messages=await api('messages');renderMessages();renderStats();notify('Đã cập nhật hộp thư.');}catch(e){notify(e.message,true);}};
(async()=>{try{const user=await api('session');await load();$('#account').textContent=user.username;$('#loginView').hidden=true;$('#appView').hidden=false;}catch(e){showLogin();if(e.message!=='Vui lòng đăng nhập.')$('#loginError').textContent=e.message;}})();
