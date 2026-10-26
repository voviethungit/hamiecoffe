import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const dataDir = resolve(process.env.DATA_DIR || resolve(root, 'data'));
mkdirSync(resolve(dataDir, 'uploads'), { recursive: true });
export const db = new DatabaseSync(resolve(dataDir, 'hamie.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, username TEXT NOT NULL, expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL, created TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new');
 CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, created TEXT NOT NULL);`);
const initialMenu = [...readFileSync(resolve(root, 'thuc-don.html'), 'utf8').matchAll(/<article class="menu-card" data-group="([^"]+)" data-name="([^"]+)">\s*<div[^>]*>\s*<img src="([^"]+)"[\s\S]*?<p>(.*?)<\/p>/g)].map((m, i) => ({
 id: `menu-${i+1}`, name: m[2].replaceAll('&amp;', '&'), category: m[1].split(' ')[0], description: m[4], image: m[3], prices: [], published: true
}));
export const assetNames = ['coffee.png','matcha.png','orange-tea.png','hero-coffee.png','cozy-space.png','hamie-story.png'];
const initial = { menu: initialMenu, images: {}, settings: { address: '44 Lê Trung Đình, Ngũ Hành Sơn, Đà Nẵng', hours: 'Hằng ngày: 06:00 – 22:00', facebook: '', zalo: '', tiktok: '', phone: '' } };
db.prepare('INSERT OR IGNORE INTO content(id,value) VALUES(1,?)').run(JSON.stringify(initial));
export function getContent() { return JSON.parse(db.prepare('SELECT value FROM content WHERE id=1').get().value); }
export function saveContent(value) { db.prepare('UPDATE content SET value=? WHERE id=1').run(JSON.stringify(value)); }
export function hashPassword(password) { const salt=randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password,salt,64).toString('hex')}`; }
export function verifyPassword(password, hash) {
 if (!hash) { scryptSync(password, 'invalid-user', 64); return false; }
 const [salt, key]=hash.split(':'); return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(key,'hex'));
}
