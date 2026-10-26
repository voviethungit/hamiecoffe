import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

const assetNames = ['coffee.png', 'matcha.png', 'orange-tea.png', 'hero-coffee.png', 'cozy-space.png', 'hamie-story.png'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // Leave room for base64 inside Netlify's function payload limit.
const hash = value => createHash('sha256').update(value).digest('hex');
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function text(value, max = 200, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, 'Thông tin bị thiếu hoặc quá dài.');
  return value.trim();
}
function image(value) {
  value = text(value, 250, true);
  if (!/^\/?(?:assets\/[a-zA-Z0-9._-]+\.(?:png|jpe?g|webp)|uploads\/[a-f0-9-]+\.(?:png|jpg|webp))$/.test(value)) fail(400, 'Vui lòng chọn ảnh trong thư viện.');
  return value;
}
function socialLink(value, kind) {
  value = text(value, 500);
  if (!value) return '';
  let url; try { url = new URL(value); } catch { fail(400, 'Liên kết mạng xã hội không hợp lệ.'); }
  const allowed = { facebook: ['facebook.com', 'fb.com', 'fb.me'], zalo: ['zalo.me', 'zaloapp.com'], tiktok: ['tiktok.com'] };
  if (url.protocol !== 'https:' || url.username || url.password || !allowed[kind].some(host => url.hostname === host || url.hostname.endsWith('.' + host))) fail(400, `Vui lòng nhập liên kết HTTPS đúng của ${kind}.`);
  return url.href;
}
async function body(request, max = 128 * 1024) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) fail(415, 'Yêu cầu dữ liệu JSON.');
  if (Number(request.headers.get('content-length')) > max) fail(413, 'Dữ liệu vượt quá giới hạn.');
  const reader = request.body?.getReader();
  if (!reader) fail(400, 'Dữ liệu không hợp lệ.');
  let size = 0; const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); fail(413, 'Dữ liệu vượt quá giới hạn.'); }
    chunks.push(Buffer.from(value));
  }
  let result; try { result = JSON.parse(Buffer.concat(chunks).toString()); } catch { fail(400, 'Dữ liệu không hợp lệ.'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) fail(400, 'Dữ liệu không hợp lệ.');
  return result;
}
function credentials(env) {
  const username = env.ADMIN_USERNAME || 'admin';
  if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 12 || env.ADMIN_PASSWORD.length > 300) {
    fail(503, 'Chưa cấu hình ADMIN_PASSWORD (12–300 ký tự) trong Environment variables của Netlify. Thêm biến cho Functions rồi deploy lại.');
  }
  return { username, password: env.ADMIN_PASSWORD, version: hash(username + ':' + env.ADMIN_PASSWORD) };
}
function sameOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site') fail(403, 'Yêu cầu không hợp lệ.');
  const expected = env.PUBLIC_ORIGIN || new URL(request.url).origin;
  if (origin && origin !== expected) fail(403, 'Yêu cầu không hợp lệ.');
}
function sessionToken(request) {
  const cookie = request.headers.get('cookie') || '';
  return cookie.split(';').map(x => x.trim()).find(x => x.startsWith('hamie_session='))?.slice(14);
}
function sessionCookie(request, token, age) {
  const secure = new URL(request.url).protocol === 'https:';
  return `hamie_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
const responseHeaders = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' };
function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...responseHeaders, 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}

export function createNetlifyAPI(storage, env = process.env) {
  async function auth(request) {
    const config = credentials(env), token = sessionToken(request);
    const session = token && /^[a-f0-9]{64}$/.test(token) && await storage.getSession(hash(token));
    if (!session || session.expires <= Date.now() || session.version !== config.version || session.username !== config.username) fail(401, 'Vui lòng đăng nhập.');
    return { ...session, key: hash(token) };
  }
  return async function handle(request, context = {}) {
    try {
      let path = decodeURIComponent(new URL(request.url).pathname);
      // Both the original Netlify URL and direct function URLs are supported.
      path = path.replace(/^\/\.netlify\/functions\/api(?:\/|$)/, '/api/');
      path = path.replace(/^\/api\/uploads\//, '/uploads/');
      if (!['GET', 'HEAD', 'POST', 'PUT', 'DELETE'].includes(request.method)) fail(405, 'Phương thức không được hỗ trợ.');
      if (!['GET', 'HEAD'].includes(request.method)) sameOrigin(request, env);
      const ip = context.ip || 'unknown'; // Netlify-provided client IP, never a caller-supplied header.
      if (path === '/api/content' && request.method === 'GET') {
        const content = await storage.getContent();
        return json(200, { ...content, menu: content.menu.filter(item => item.published), uploadMaxBytes: MAX_IMAGE_BYTES });
      }
      if (/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(path) && ['GET', 'HEAD'].includes(request.method)) {
        const upload = await storage.getUpload(path.slice('/uploads/'.length));
        if (!upload) fail(404, 'Không tìm thấy ảnh.');
        const type = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[path.split('.').pop()];
        return new Response(request.method === 'HEAD' ? null : upload.data, { headers: { ...responseHeaders, 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' } });
      }
      if (path === '/api/contact' && request.method === 'POST') {
        if (await storage.consumeLimit('contact-' + hash(ip), 10, 600000)) fail(429, 'Bạn gửi quá nhiều tin nhắn. Vui lòng thử lại sau.');
        const input = await body(request);
        const name = text(input.fullName, 100, true), contact = text(input.contactInfo, 150, true), subject = text(input.subject, 200, true), message = text(input.message, 5000, true);
        if (name.length < 2 || message.length < 10 || input.privacyConsent !== true || !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) || /^(?:\+?84|0)[\d\s().-]{8,13}$/.test(contact))) fail(400, 'Vui lòng kiểm tra tên, email/số điện thoại, nội dung và đồng ý xử lý dữ liệu.');
        await storage.putMessage({ id: randomUUID(), name, contact, subject, message, created: new Date().toISOString(), status: 'new' });
        return json(201, { ok: true });
      }
      if (path === '/api/admin/login' && request.method === 'POST') {
        const config = credentials(env);
        if (await storage.consumeLimit('login-' + hash(ip), 20, 600000)) fail(429, 'Đăng nhập quá nhiều lần. Vui lòng thử lại sau 10 phút.');
        const input = await body(request), username = text(input.username, 80, true), password = text(input.password, 300, true);
        const salt = 'hamie-admin:' + config.username;
        const valid = timingSafeEqual(scryptSync(password, salt, 64), scryptSync(config.password, salt, 64));
        if (username !== config.username || !valid) fail(401, 'Tên đăng nhập hoặc mật khẩu không đúng.');
        const token = randomBytes(32).toString('hex');
        await storage.putSession(hash(token), { username, expires: Date.now() + 28800000, version: config.version });
        return json(200, { username }, { 'Set-Cookie': sessionCookie(request, token, 28800) });
      }
      if (!path.startsWith('/api/admin/')) fail(404, 'Không tìm thấy API.');
      const user = await auth(request);
      if (path === '/api/admin/session' && request.method === 'GET') return json(200, { username: user.username });
      if (path === '/api/admin/logout' && request.method === 'POST') {
        await storage.deleteSession(user.key);
        return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) });
      }
      if (path === '/api/admin/content' && request.method === 'GET') return json(200, { ...await storage.getContent(), uploadMaxBytes: MAX_IMAGE_BYTES });
      if (path === '/api/admin/settings' && request.method === 'PUT') {
        const input = await body(request);
        const settings = { address: text(input.address, 300, true), hours: text(input.hours, 150, true), phone: text(input.phone, 30), facebook: socialLink(input.facebook, 'facebook'), zalo: socialLink(input.zalo, 'zalo'), tiktok: socialLink(input.tiktok, 'tiktok') };
        if (settings.phone && !/^\+?[\d\s().-]{8,25}$/.test(settings.phone)) fail(400, 'Số điện thoại không hợp lệ.');
        await storage.updateContent(content => ({ ...content, settings }));
        return json(200, settings);
      }
      if (path === '/api/admin/menu' && request.method === 'POST') {
        const input = await body(request);
        if (!['coffee', 'tea', 'fruit', 'blended'].includes(input.category)) fail(400, 'Danh mục không hợp lệ.');
        if (!Array.isArray(input.prices) || input.prices.length > 10) fail(400, 'Tối đa 10 lựa chọn giá.');
        const item = { id: input.id ? text(input.id, 100, true) : randomUUID(), name: text(input.name, 150, true), category: input.category, description: text(input.description, 1000), image: image(input.image), published: input.published === true,
          prices: input.prices.map(price => {
            if (!price || !Number.isInteger(price.price) || price.price < 0 || price.price > 100000000) fail(400, 'Giá phải là số nguyên không âm.');
            return { size: text(price.size, 30, true), price: price.price };
          }) };
        await storage.updateContent(content => {
          const index = content.menu.findIndex(current => current.id === item.id);
          if (input.id && index < 0) fail(404, 'Món không còn tồn tại.');
          if (index < 0) content.menu.push(item); else content.menu[index] = item;
          return content;
        });
        return json(200, item);
      }
      if (path.startsWith('/api/admin/menu/') && request.method === 'DELETE') {
        await storage.updateContent(content => ({ ...content, menu: content.menu.filter(item => item.id !== path.split('/').pop()) }));
        return json(200, { ok: true });
      }
      if (path === '/api/admin/images' && request.method === 'PUT') {
        const input = await body(request);
        if (!assetNames.includes(input.slot)) fail(400, 'Vị trí ảnh không hợp lệ.');
        const value = input.image ? image(input.image) : '';
        const content = await storage.updateContent(content => {
          if (value) content.images[input.slot] = value; else delete content.images[input.slot];
          return content;
        });
        return json(200, content.images);
      }
      if (path === '/api/admin/media' && request.method === 'GET') return json(200, await storage.listMedia());
      if (path === '/api/admin/media' && request.method === 'POST') {
        const input = await body(request, Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4096), name = text(input.name, 200, true);
        if (typeof input.data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data)) fail(400, 'Tệp ảnh không hợp lệ.');
        const bytes = Buffer.from(input.data, 'base64');
        if (bytes.length > MAX_IMAGE_BYTES) fail(413, 'Ảnh tối đa 4 MB trên Netlify.');
        let ext;
        if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ext = 'png';
        else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) ext = 'jpg';
        else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') ext = 'webp';
        else fail(400, 'Chỉ hỗ trợ ảnh PNG, JPEG hoặc WebP.');
        const id = randomUUID(), item = { id, name, url: `/uploads/${id}.${ext}`, created: new Date().toISOString() };
        await storage.putMedia(item, bytes, { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[ext]);
        return json(201, item);
      }
      if (path === '/api/admin/messages' && request.method === 'GET') return json(200, await storage.listMessages());
      if (path.startsWith('/api/admin/messages/') && request.method === 'PUT') {
        const input = await body(request);
        if (!['new', 'read', 'done'].includes(input.status)) fail(400, 'Trạng thái không hợp lệ.');
        await storage.updateMessage(path.split('/').pop(), input.status);
        return json(200, { ok: true });
      }
      fail(404, 'Không tìm thấy API.');
    } catch (error) {
      if (!error.status) console.error('HAMIE API:', error.message);
      return json(error.status || 500, { error: error.status ? error.message : 'Không thể lưu dữ liệu. Vui lòng thử lại hoặc kiểm tra Netlify Function logs.' });
    }
  };
}
