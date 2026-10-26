import { db, hashPassword } from './store.mjs';
import { randomBytes } from 'node:crypto';
const username = process.argv[2] || 'admin';
const password = process.env.ADMIN_PASSWORD || randomBytes(18).toString('base64url');
if (username.length > 80 || password.length < 12) throw new Error('Tên đăng nhập tối đa 80 ký tự; mật khẩu tối thiểu 12 ký tự.');
if (db.prepare('SELECT username FROM admins WHERE username=?').get(username) && !process.argv.includes('--reset')) throw new Error('Tài khoản đã tồn tại. Dùng --reset nếu muốn đổi mật khẩu.');
db.prepare('INSERT INTO admins(username,hash) VALUES(?,?) ON CONFLICT(username) DO UPDATE SET hash=excluded.hash').run(username,hashPassword(password));
db.prepare('DELETE FROM sessions WHERE username=?').run(username);
console.log(`Tài khoản: ${username}\nMật khẩu: ${password}\nĐăng nhập: /admin/`);
