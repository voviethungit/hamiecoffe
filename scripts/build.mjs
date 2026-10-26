import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = new URL('../dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
// Publish only browser assets. Never publish server code, databases or secrets.
for (const file of await readdir(root)) {
  if (/\.(?:html|css|js)$/.test(file)) await cp(new URL('../' + file, import.meta.url), new URL(file, out));
}
for (const directory of ['assets', 'admin']) {
  await cp(new URL('../' + directory, import.meta.url), new URL(directory, out), { recursive: true });
}
console.log('Built public website and admin in dist/.');
