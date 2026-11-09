// Serves this project under /budgeteer/ only, like GitHub Pages serves a project site
// (https://<name>.github.io/budgeteer/). Anything outside /budgeteer/ is a 404, so a path
// that starts with "/" fails the subfolder test. Bound to this computer only.
// Usage: node e2e/subfolder-server.mjs <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const PREFIX = '/budgeteer/';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.png': 'image/png',
};

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  if (pathname === '/budgeteer') {
    response.writeHead(301, { location: PREFIX }).end();
    return;
  }
  if (!pathname.startsWith(PREFIX)) {
    response.writeHead(404).end('Not found');
    return;
  }
  const relative = normalize(decodeURIComponent(pathname.slice(PREFIX.length)) || 'index.html');
  const file = join(root, relative.endsWith(sep) ? join(relative, 'index.html') : relative);
  if (!file.startsWith(root) || relative.split(sep).some((part) => part.startsWith('.'))) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const info = await stat(file);
    const path = info.isDirectory() ? join(file, 'index.html') : file;
    const body = await readFile(path);
    response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(Number(process.argv[2] ?? 8139), '127.0.0.1');
