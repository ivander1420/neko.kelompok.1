const fs = require('fs');
const files = ['server/server.js','server/game-room.js','js/store.js','js/app.js','js/voice.js','js/home.js','js/profile.js','js/intro.js','js/ui.js','js/live.js','js/rooms.js','js/community.js','js/friends.js','js/admin.js','scripts/prepare-build.js','index.html'];
for (const f of files) {
  try {
    const s = fs.readFileSync(f, 'utf8');
    console.log(f.padEnd(26), String(s.length).padStart(8), String(s.split('\n').length).padStart(6) + ' lines');
  } catch (e) { console.log(f, 'MISSING'); }
}
console.log('---- routes in server.js ----');
const src = fs.readFileSync('server/server.js', 'utf8');
src.split('\n').forEach((line, i) => {
  if (/\/api\//.test(line)) console.log(String(i + 1).padStart(5) + ': ' + line.trim().slice(0, 120));
});
