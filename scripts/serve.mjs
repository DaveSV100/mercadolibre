// Local preview server for dist/: node scripts/serve.mjs  ->  http://localhost:8080
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadConfig } from './lib/core.mjs';

const DIST = path.join(ROOT, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };
const port = Number(process.env.PORT) || 8080;
const base = new URL(loadConfig().baseUrl).pathname.replace(/\/$/, '');

http.createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (base && pathname.startsWith(base)) pathname = pathname.slice(base.length) || '/';
  let file = path.join(DIST, pathname);
  if (!file.startsWith(DIST)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'content-type': TYPES['.html'] });
    return res.end(fs.readFileSync(path.join(DIST, '404.html')));
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}).listen(port, () => console.log(`Preview: http://localhost:${port}`));
