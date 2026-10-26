import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { BlobsServer } from '@netlify/blobs/server';
import { getStore } from '@netlify/blobs';
import { createBlobStorage } from './netlify-storage.mjs';
import { createNetlifyAPI } from './netlify-api.mjs';

// Integration uses the official Netlify Blobs SDK and local persistence server,
// not a mock database. Every call can create a fresh function/storage instance.
test('Netlify Functions with persistent Blobs', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'hamie-netlify-'));
  const server = new BlobsServer({ directory, token: 'integration-test-only', logger: () => {} });
  const address = await server.start();
  const origin = 'https://hamie.example';
  const env = { ADMIN_USERNAME: 'test-admin', ADMIN_PASSWORD: randomBytes(24).toString('hex') };
  const config = { siteID: 'test-site', token: 'integration-test-only', apiURL: `http://127.0.0.1:${address.port}`, edgeURL: `http://127.0.0.1:${address.port}`, uncachedEdgeURL: `http://127.0.0.1:${address.port}`, consistency: 'strong' };
  function stores() { return { content: getStore({ ...config, name: 'content' }), records: getStore({ ...config, name: 'records' }), uploads: getStore({ ...config, name: 'uploads' }) }; }
  function storage() { return createBlobStorage(stores()); }
  let cookie;
  async function req(path, method = 'GET', data, options = {}) {
    const request = new Request(origin + path, { method, headers: { ...(data !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...options.headers }, body: data === undefined ? undefined : JSON.stringify(data) });
    return createNetlifyAPI(storage(), options.env || env)(request, { ip: options.ip || 'test-client' });
  }
  let item, media;
  try {
    await t.test('public API works without admin config; setup errors are explicit', async () => {
      assert.equal((await req('/api/content', 'GET', undefined, { env: {} })).status, 200);
      const response = await req('/api/admin/session', 'GET', undefined, { env: {} });
      assert.equal(response.status, 503); assert.match((await response.json()).error, /ADMIN_PASSWORD/);
      assert.equal((await req('/api/admin/messages')).status, 401);
      assert.equal((await req('/api/admin/media', 'POST', {})).status, 401);
      assert.equal((await (await req('/api/content')).json()).menu.length, 9);
    });
    await t.test('auth, secure cookies, origin checks and session persistence across cold starts', async () => {
      assert.equal((await req('/api/admin/login', 'POST', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD }, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
      assert.equal((await req('/api/admin/login', 'POST', { username: env.ADMIN_USERNAME, password: 'incorrect-password' })).status, 401);
      const response = await req('/api/admin/login', 'POST', { username: env.ADMIN_USERNAME, password: env.ADMIN_PASSWORD });
      assert.equal(response.status, 200);
      const setCookie = response.headers.get('set-cookie');
      assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /Secure/); assert.match(setCookie, /SameSite=Strict/);
      cookie = setCookie.split(';')[0];
      assert.equal((await req('/api/admin/session')).status, 200);
      assert.equal((await req('/api/admin/session', 'GET', undefined, { env: { ...env, ADMIN_PASSWORD: 'changed-password-for-test' } })).status, 401);
    });
    await t.test('uploads persist, image routes work, bad files and large payloads are rejected', async () => {
      assert.equal((await req('/api/admin/media', 'POST', { name: 'x.svg', data: Buffer.from('<svg/>').toString('base64') })).status, 400);
      const png = await readFile(new URL('../assets/matcha.png', import.meta.url));
      const response = await req('/api/admin/media', 'POST', { name: 'matcha.png', data: png.toString('base64') });
      assert.equal(response.status, 201); media = await response.json();
      const image = await req(media.url); assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png');
      assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
      const direct = await req('/.netlify/functions/api/uploads/' + media.url.split('/').pop()); assert.equal(direct.status, 200);
      const body = { name: 'large.png', data: Buffer.alloc(4 * 1024 * 1024 + 10, 1).toString('base64') };
      assert.equal((await req('/api/admin/media', 'POST', body)).status, 413);
      assert.equal((await (await req('/api/admin/content')).json()).uploadMaxBytes, 4 * 1024 * 1024);
    });
    await t.test('menu CRUD, draft visibility, social settings and replacement images', async () => {
      const input = { name: 'Cà phê Netlify', category: 'coffee', description: 'Món từ admin', image: media.url, prices: [{ size: 'M', price: 35000 }], published: false };
      const create = await req('/api/admin/menu', 'POST', input); assert.equal(create.status, 200); item = await create.json();
      assert.ok(!(await (await req('/api/content')).json()).menu.some(x => x.id === item.id));
      assert.equal((await req('/api/admin/menu', 'POST', { ...item, published: true })).status, 200);
      assert.equal((await req('/api/admin/menu', 'POST', { ...item, prices: [{ size: 'M', price: -1 }] })).status, 400);
      const content = await (await req('/api/admin/content')).json();
      assert.equal((await req('/api/admin/settings', 'PUT', { ...content.settings, tiktok: 'javascript:alert(1)' })).status, 400);
      assert.equal((await req('/api/admin/settings', 'PUT', { ...content.settings, tiktok: 'https://www.tiktok.com/@hamie' })).status, 200);
      assert.equal((await req('/api/admin/images', 'PUT', { slot: 'hero-coffee.png', image: media.url })).status, 200);
      const publicData = await (await req('/api/content')).json();
      assert.equal(publicData.images['hero-coffee.png'], media.url);
      assert.equal(publicData.settings.tiktok, 'https://www.tiktok.com/@hamie');
      assert.equal(publicData.menu.find(x => x.id === item.id).prices[0].price, 35000);
      assert.equal(publicData.messages, undefined);
    });
    await t.test('conditional writes retry and preserve a competing function update', async () => {
      const deps = stores(); let injected = false;
      const nativeSet = deps.content.setJSON.bind(deps.content);
      deps.content.setJSON = async (key, value, options) => {
        if (!injected) {
          injected = true;
          await storage().updateContent(content => ({ ...content, settings: { ...content.settings, address: 'Địa chỉ từ phiên khác' } }));
        }
        return nativeSet(key, value, options);
      };
      await createBlobStorage(deps).updateContent(content => ({ ...content, images: { ...content.images, 'coffee.png': media.url } }));
      const result = await storage().getContent();
      assert.equal(result.settings.address, 'Địa chỉ từ phiên khác');
      assert.equal(result.images['coffee.png'], media.url);
    });
    await t.test('contact inbox, status and rate limit persist between function instances', async () => {
      const contact = { fullName: 'Khách Netlify', contactInfo: 'test@example.com', subject: 'Liên hệ', message: 'Tin nhắn từ website trên Netlify.', privacyConsent: true };
      assert.equal((await req('/api/contact', 'POST', { ...contact, privacyConsent: false })).status, 400);
      assert.equal((await req('/api/contact', 'POST', contact)).status, 201);
      const messages = await (await req('/api/admin/messages')).json(); assert.equal(messages.length, 1);
      assert.equal((await req('/api/admin/messages/' + messages[0].id, 'PUT', { status: 'done' })).status, 200);
      assert.equal((await (await req('/api/admin/messages')).json())[0].status, 'done');
      for (let n = 0; n < 10; n++) assert.equal((await req('/api/contact', 'POST', contact, { ip: 'limited-client' })).status, 201);
      assert.equal((await req('/api/contact', 'POST', contact, { ip: 'limited-client' })).status, 429);
    });
    await t.test('delete, logout, expired sessions and direct function routing', async () => {
      assert.equal((await req('/api/admin/menu/' + item.id, 'DELETE')).status, 200);
      assert.ok(!(await (await req('/api/content')).json()).menu.some(x => x.id === item.id));
      assert.equal((await req('/.netlify/functions/api/content')).status, 200);
      assert.equal((await req('/api/admin/logout', 'POST')).status, 200);
      assert.equal((await req('/api/admin/messages')).status, 401);
      const token = randomBytes(32).toString('hex');
      const { createHash } = await import('node:crypto');
      await storage().putSession(createHash('sha256').update(token).digest('hex'), { username: env.ADMIN_USERNAME, version: createHash('sha256').update(env.ADMIN_USERNAME + ':' + env.ADMIN_PASSWORD).digest('hex'), expires: Date.now() - 1 });
      cookie = 'hamie_session=' + token;
      assert.equal((await req('/api/admin/session')).status, 401);
    });
  } finally { await server.stop(); await rm(directory, { recursive: true, force: true }); }
});
