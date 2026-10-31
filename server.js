'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
const allowedFiles = new Map([
  ['index.html', 'text/html; charset=utf-8'],
  ['favicon.svg', 'image/svg+xml'],
  ['site.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['sw.js', 'text/javascript; charset=utf-8']
]);
const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Method not allowed');
  }

  const name = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const contentType = allowedFiles.get(name);
  if (!contentType) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Not found');
  }

  try {
    const content = await fs.readFile(path.join(__dirname, name));
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': name === 'index.html' ? 'no-cache' : 'public, max-age=3600'
    });
    return response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    return response.end('Unable to read application file');
  }
});

server.listen(port, host, () => console.log(`NetQuest running at http://${host}:${port}`));