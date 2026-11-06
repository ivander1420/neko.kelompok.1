'use strict';
const fs = require('node:fs');
const src = fs.readFileSync('server/server.js', 'utf8').split('\n');
const from = Number(process.argv[2] || 1600);
const to = Number(process.argv[3] || src.length);
const out = [];
for (let i = from - 1; i < Math.min(to, src.length); i += 1) {
  out.push(String(i + 1).padStart(5) + '| ' + src[i]);
}
fs.writeFileSync('.tmp-tail.txt', out.join('\n'), 'utf8');
console.log('wrote ' + out.length + ' lines (' + from + '-' + to + ') of ' + src.length);
