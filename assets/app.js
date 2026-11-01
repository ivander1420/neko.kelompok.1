
(()=>{
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],APP_VERSION='1.4.13';
const ic=n=>`<svg class="i"><use href="#i-${n}"/></svg>`;
let mx=innerWidth/2,my=innerHeight/2;
addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;const cursor=$('#cur');if(cursor)cursor.style.transform=`translate3d(${mx}px,${my}px,0)`;const t=e.target.closest('.glass');if(t){const r=t.getBoundingClientRect();t.style.setProperty('--mx',(mx-r.left)+'px');t.style.setProperty('--my',(my-r.top)+'px')}});
document.addEventListener('pointerdown',event=>{
 const button=event.target.closest('button,[role="button"]');
 if(!button||document.documentElement.dataset.motion==='off'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const ripple=document.createElement('span');
 ripple.className='action-ripple';ripple.style.left=event.clientX+'px';ripple.style.top=event.clientY+'px';
 document.body.append(ripple);
 ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
});
// Efek suara ringan dibuat dengan Web Audio, aktif hanya setelah pengguna menyalakannya.
let soundOn=false,audioCtx=null;
function sfx(kind='tap'){if(!soundOn)return;try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);const now=audioCtx.currentTime;const tones=kind==='success'?[660,880,1040]:kind==='login'?[440,660,880]:kind==='fail'?[300,190]:kind==='tap'?[520]:[520];o.type=kind==='fail'?'triangle':'sine';o.frequency.setValueAtTime(tones[0],now);tones.slice(1).forEach((n,i)=>o.frequency.setValueAtTime(n,now+(i+1)*.085));g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(kind==='fail'?.06:.045,now+.018);g.gain.exponentialRampToValueAtTime(.0001,now+(kind==='fail'?.32:.26));o.start(now);o.stop(now+(kind==='fail'?.33:.27))}catch(e){}}
let musicOn=false,musicConfigured=false,musicTimer=null,musicBus=null,musicStep=0,musicScene='study',musicVolume=24;
try{const musicPreference=localStorage.getItem('nq_music_enabled');musicConfigured=musicPreference!==null;musicOn=musicPreference==='true';const savedVolume=Number(localStorage.getItem('nq_music_volume')||24);musicVolume=Number.isFinite(savedVolume)?Math.max(0,Math.min(40,savedVolume)):24}catch(error){console.warn('Preferensi musik tidak dapat dibaca.',error)}
function setMusicButton(){const b=$('#musicToggle');if(!b)return;b.innerHTML='<svg class="i" aria-hidden="true"><use href="#i-music"/></svg>';b.setAttribute('aria-pressed',String(musicOn));b.setAttribute('aria-label',musicOn?'Matikan musik':'Putar musik');b.title=musicOn?'Matikan musik':'Putar musik'}
function playMusicTone(frequency,duration,level,type='sine'){
 if(!audioCtx||!musicBus||audioCtx.state!=='running')return;
 const oscillator=audioCtx.createOscillator(),envelope=audioCtx.createGain(),now=audioCtx.currentTime;
 oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,now);
 envelope.gain.setValueAtTime(.0001,now);envelope.gain.linearRampToValueAtTime(level,now+.12);envelope.gain.exponentialRampToValueAtTime(.0001,now+duration);
 oscillator.connect(envelope);envelope.connect(musicBus);oscillator.start(now);oscillator.stop(now+duration+.02);
}
function musicTick(){
 if(!musicOn||!audioCtx||audioCtx.state!=='running'||document.hidden)return;
 const normal=[523.25,587.33,659.25,783.99,659.25,587.33,493.88,587.33];
 const playful=[659.25,783.99,880,783.99,698.46,880,987.77,880];
 const notes=musicScene==='game'?playful:normal,step=musicStep++%notes.length;
 playMusicTone(notes[step],musicScene==='game'?.3:.48,musicScene==='game'?.018:.013,'triangle');
 if(step===0){const chord=musicScene==='game'?[261.63,329.63,392]:[196,246.94,293.66];chord.forEach(n=>playMusicTone(n,musicScene==='game'?1.25:2.1,.008,'sine'))}
 if(step===4)playMusicTone(musicScene==='game'?130.81:98, musicScene==='game'?.52:.9,.012,'sine');
}
function startMusicLoop(){
 if(!musicOn||musicTimer)return;
 const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio){console.warn('Web Audio tidak didukung; musik tidak dapat diputar.');$('#musicToggle').setAttribute('aria-label','Musik tidak tersedia');return}
 try{
   audioCtx=audioCtx||new Audio();if(!musicBus){musicBus=audioCtx.createGain();musicBus.connect(audioCtx.destination)}musicBus.gain.setTargetAtTime(musicVolume/100,audioCtx.currentTime,.12);
  const resume=audioCtx.resume();if(resume&&typeof resume.catch==='function')resume.catch(error=>console.warn('Audio belum dapat dimulai.',error));
  musicTimer=window.setInterval(musicTick,musicScene==='game'?410:620);musicTick();
 }catch(error){console.warn('Musik tidak dapat dimulai.',error)}
}
function setMusicEnabled(enabled){
 musicOn=Boolean(enabled);musicConfigured=true;try{localStorage.setItem('nq_music_enabled',String(musicOn))}catch(error){console.warn('Preferensi musik tidak dapat disimpan.',error)}
 if(musicOn)startMusicLoop();else{if(musicTimer){clearInterval(musicTimer);musicTimer=null}if(musicBus&&audioCtx)musicBus.gain.setTargetAtTime(0,audioCtx.currentTime,.06)}
 setMusicButton();
}
function setMusicScene(view){
 const next=view==='game'?'game':'study';if(next===musicScene)return;musicScene=next;musicStep=0;
 if(musicTimer){clearInterval(musicTimer);musicTimer=null;startMusicLoop()}
}
window.nqSetMusicScene=setMusicScene;window.nqSetMusicEnabled=setMusicEnabled;
setMusicButton();
$('#musicToggle').addEventListener('click',()=>setMusicEnabled(!musicOn));
function configureMusicVolume(){const slider=$('#musicVolume'),output=$('#musicVolumeValue');if(!slider||!output)return;slider.value=String(musicVolume);output.value=musicVolume+'%';slider.addEventListener('input',e=>{musicVolume=Math.max(0,Math.min(40,Number(e.target.value)));output.value=musicVolume+'%';if(musicBus&&audioCtx)musicBus.gain.setTargetAtTime(musicVolume/100,audioCtx.currentTime,.08);try{localStorage.setItem('nq_music_volume',String(musicVolume))}catch(error){console.warn('Volume musik tidak dapat disimpan.',error)}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',configureMusicVolume,{once:true});else configureMusicVolume();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{$('#appVersion').textContent='v'+APP_VERSION},{once:true});else if($('#appVersion'))$('#appVersion').textContent='v'+APP_VERSION;
document.addEventListener('pointerdown',()=>{if(musicOn)startMusicLoop()},{once:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&musicOn){if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(error=>console.warn('Audio belum dapat dilanjutkan.',error));startMusicLoop()}});
$('#soundToggle').addEventListener('click',()=>{soundOn=!soundOn;$('#soundToggle').innerHTML='<svg class="i" aria-hidden="true"><use href="#i-volume"/></svg>';$('#soundToggle').setAttribute('aria-label',soundOn?'Matikan efek suara':'Aktifkan efek suara');$('#soundToggle').setAttribute('title',soundOn?'Matikan efek suara':'Aktifkan efek suara');$('#soundToggle').setAttribute('aria-pressed',String(soundOn));if(soundOn)sfx('success')});
document.addEventListener('click',e=>{const el=e.target.closest('button,[role="button"]');if(el&&!el.matches('[data-q],[data-osi],[data-det],[data-route],[data-mchoice],[data-s]')&&el.id!=='again')sfx('tap')});
$('#shareApp')?.addEventListener('click',async()=>{
 const status=$('#shareAppStatus'),english=document.documentElement.dataset.language==='en';
 try{
  if(navigator.share){await navigator.share({title:'Neko',text:english?'Explore Neko, the interactive TJKT learning app.':'Yuk belajar TJKT interaktif dengan Neko.',url:location.href});if(status)status.textContent=english?'Share sheet opened.':'Menu berbagi dibuka.';return}
  if(!navigator.clipboard?.writeText){if(status)status.textContent=english?'Sharing is not supported in this browser.':'Browser ini tidak mendukung fitur berbagi.';return}
  await navigator.clipboard.writeText(location.href);if(status)status.textContent=english?'App link copied.':'Tautan aplikasi disalin.';
 }catch(error){if(error?.name==='AbortError')return;console.warn('Tautan aplikasi tidak dapat dibagikan.',error);if(status)status.textContent=english?'Could not share the app link.':'Tautan aplikasi tidak dapat dibagikan.'}
});
const AUTHORIZED_ACCOUNTS=[
  {username:'ivander',displayName:'Ivander',pin:'141210',role:'Developer'},
  {username:'Muhaditrafanizam',displayName:'Arafa',pin:'220810',role:'President'},
  {username:'Akhsanjauharantoso',displayName:'Akhsyan',pin:'140411',role:'admin'},
  {username:'Pakandy',displayName:'Pak Andy',pin:'123321',role:'Guru'},
  {username:'Pakharry',displayName:'Pak Harry',pin:'456654',role:'Guru'},
  {username:'Buksri',displayName:'Bu Sri',pin:'789987',role:'Guru'},
  {username:'Pakfirman',displayName:'Pak Firman',pin:'100110',role:'Wali kelas'}
  // Add school-managed accounts here with role: 'teacher'.
];
const ACCOUNT_STORAGE_KEY='neko_accounts_v1',ACCOUNT_SESSION_KEY='neko_account_session';
let activeAccount=null;
function normalizeUsername(value){return String(value||'').trim().toLocaleLowerCase('id')}
function readLocalAccounts(){
 try{
  const raw=localStorage.getItem(ACCOUNT_STORAGE_KEY);if(!raw)return [];
  const accounts=JSON.parse(raw);
  if(!Array.isArray(accounts)||accounts.some(account=>!account||typeof account.username!=='string'||typeof account.displayName!=='string'||typeof account.salt!=='string'||typeof account.pinHash!=='string'||account.role!=='member'))throw new Error('Format data akun tidak valid.');
  return accounts;
 }catch(error){console.warn('Data akun lokal tidak dapat dibaca.',error);throw new Error('Data akun lokal tidak dapat dibaca. Coba muat ulang aplikasi.')}
}
function saveLocalAccounts(accounts){
 try{localStorage.setItem(ACCOUNT_STORAGE_KEY,JSON.stringify(accounts))}
 catch(error){console.warn('Akun lokal tidak dapat disimpan.',error);throw new Error('Akun tidak dapat disimpan di perangkat ini. Periksa ruang penyimpanan browser.')}
}
function toHex(bytes){return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('')}
async function hashPin(pin,salt){
 if(!window.crypto?.subtle||!window.crypto?.getRandomValues)throw new Error('Penyimpanan PIN aman tidak tersedia. Buka Neko melalui HTTPS atau aplikasi.');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
 const digest=await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/.{2}/g),pair=>parseInt(pair,16)),iterations:120000,hash:'SHA-256'},key,256);
 return toHex(digest);
}
async function createPinRecord(pin){
 const salt=toHex(crypto.getRandomValues(new Uint8Array(16)));
 return {salt,pinHash:await hashPin(pin,salt)};
}
function storedSession(){
 try{
  const value=JSON.parse(localStorage.getItem(ACCOUNT_SESSION_KEY)||'null');
  return value&&typeof value.username==='string'&&typeof value.displayName==='string'&&['admin','teacher','member'].includes(value.role)?value:null;
 }catch(error){console.warn('Sesi akun lokal tidak dapat dibaca.',error);return null}
}
function saveSession(account){
 try{localStorage.setItem(ACCOUNT_SESSION_KEY,JSON.stringify({username:account.username,displayName:account.displayName,role:account.role}));localStorage.setItem('nq_demo_user',account.displayName)}
 catch(error){console.warn('Sesi akun tidak dapat disimpan.',error);throw new Error('Sesi tidak dapat disimpan. Izinkan penyimpanan lokal lalu coba lagi.')}
}
function openNeko(account){
 saveSession(account);activeAccount={username:account.username,displayName:account.displayName,role:account.role};updateSession();
 const gate=$('#authGate'),intro=$('#introSequence');
 document.body.classList.add('unlocked');document.body.style.overflowX='hidden';
 if(gate){gate.style.transition='opacity .35s ease, transform .35s ease';gate.style.opacity='0';gate.style.transform='scale(.985)'}
 soundOn=true;const sound=$('#soundToggle');if(sound){sound.innerHTML='<svg class="i" aria-hidden="true"><use href="#i-volume"/></svg>';sound.setAttribute('aria-label','Matikan efek suara');sound.setAttribute('title','Matikan efek suara');sound.setAttribute('aria-pressed','true')}
 if(!musicConfigured)setMusicEnabled(true);else if(musicOn)startMusicLoop();sfx('login');
 window.setTimeout(()=>{if(gate)gate.style.display='none';if(intro){intro.style.display='grid';intro.classList.add('play')}sfx('success')},380);
 let enteredHome=false;
 const enterHome=()=>{if(enteredHome)return;enteredHome=true;if(intro){intro.classList.remove('play','intro-exit');intro.style.display='none'}if(gate)gate.style.display='none';document.body.classList.add('unlocked');go('home');updateSession()};
 window.setTimeout(()=>{if(intro)intro.classList.add('intro-exit');window.setTimeout(enterHome,700)},3500);
 window.setTimeout(enterHome,5200);
}
async function authenticateNeko(form,action){
 const username=form.querySelector('[name="username"]').value.trim(),displayName=form.querySelector('[name="displayName"]').value.trim(),pin=form.querySelector('[name="pin"]').value,errorNode=form.querySelector('.form-error'),submit=form.querySelector('[data-auth-action="login"]');
 errorNode.textContent='';
 if(!/^[a-zA-Z0-9._-]{3,24}$/.test(username)){errorNode.textContent='Username 3–24 karakter: huruf, angka, titik, garis, atau garis bawah.';return}
 if(!/^\d{6,12}$/.test(pin)){errorNode.textContent='PIN harus terdiri dari 6–12 angka.';return}
 if(action==='register'&&displayName.length<2){errorNode.textContent='Nama tampilan minimal 2 karakter.';form.querySelector('[name="displayName"]').focus();return}
 if(submit)submit.disabled=true;
 form.querySelectorAll('[data-auth-action="register"]').forEach(button=>button.disabled=true);
 try{
  const normalized=normalizeUsername(username),preset=AUTHORIZED_ACCOUNTS.find(account=>normalizeUsername(account.username)===normalized);
  if(action==='register'){
   const accounts=readLocalAccounts();
   if(preset||accounts.some(account=>normalizeUsername(account.username)===normalized)){errorNode.textContent='Username sudah digunakan. Pilih username lain.';return}
   const record=await createPinRecord(pin),account={username,displayName,role:'member',...record};
   accounts.push(account);saveLocalAccounts(accounts);openNeko(account);return;
  }
  if(preset){
   if(pin!==preset.pin){errorNode.textContent='Username atau PIN tidak cocok.';return}
   openNeko(preset);return;
  }
  const account=readLocalAccounts().find(item=>normalizeUsername(item.username)===normalized);
  if(!account||await hashPin(pin,account.salt)!==account.pinHash){errorNode.textContent='Username atau PIN tidak cocok.';return}
  openNeko(account);
 }catch(error){console.warn('Proses akun lokal gagal.',error);errorNode.textContent=error instanceof Error?error.message:'Akun tidak dapat diproses. Coba lagi.'}
 finally{if(submit)submit.disabled=false;form.querySelectorAll('[data-auth-action="register"]').forEach(button=>button.disabled=false)}
}
function startNetQuestLogin(event){event?.preventDefault();authenticateNeko($('#gateForm'),'login');return false}
window.startNetQuestLogin=startNetQuestLogin;
$('#gateForm').addEventListener('submit',startNetQuestLogin);
$('#loginForm').addEventListener('submit',event=>{event.preventDefault();authenticateNeko(event.currentTarget,'login')});
$$('[data-auth-action="register"]').forEach(button=>button.addEventListener('click',()=>authenticateNeko(button.closest('[data-auth-form]'),'register')));

// XP
let st={xp:0,got:{}};try{st=JSON.parse(localStorage.getItem('nq')||'')||st}catch(e){}
const ranks=[[0,'Newbie'],[25,'Teknisi Pemula'],[55,'Teknisi Junior'],[90,'Teknisi Madya'],[135,'Spesialis LAN'],[190,'Admin Jaringan'],[260,'Engineer Jaringan'],[340,'Senior Network Engineer'],[440,'Arsitek Jaringan'],[560,'Network Operations Pro'],[700,'Network Master'],[850,'Legenda TJKT']];
function draw(){const r=[...ranks].reverse().find(x=>st.xp>=x[0]);$('#rank').textContent=r[1];$('#xpt').textContent=st.xp+' XP';$('#xpb').style.width=Math.min(100,st.xp/850*100)+'%';['vlan','ip','fix','quiz'].forEach(k=>$('#m-'+k).classList.toggle('ok',!!st.got['done_'+k]));if(window.premiumReady&&typeof refreshPremiumUI==='function')refreshPremiumUI()}
function gain(key,n,x=mx,y=my){if(st.got[key])return;st.got[key]=1;st.xp+=n;try{localStorage.setItem('nq',JSON.stringify(st))}catch(e){}draw();const f=document.createElement('div');f.className='fx';f.textContent='+'+n+' XP';f.style.left=x+'px';f.style.top=y+'px';document.body.appendChild(f);setTimeout(()=>f.remove(),1200)}
window.nqAwardXP=gain;
draw();
// navigasi
function go(v){$$('.view').forEach(s=>s.classList.toggle('on',s.id===v));const dock=$('#dock');$$('#dock button').forEach(button=>{const active=button.dataset.v===v;button.classList.toggle('on',active);if(active){button.setAttribute('aria-current','page');if(dock&&dock.scrollWidth>dock.clientWidth){const dockRect=dock.getBoundingClientRect(),buttonRect=button.getBoundingClientRect();dock.scrollTo({left:Math.max(0,buttonRect.left-dockRect.left+dock.scrollLeft-(dock.clientWidth-buttonRect.width)/2),behavior:document.documentElement.dataset.motion==='off'?'auto':'smooth'})}}else button.removeAttribute('aria-current')});$$('.topnav [data-v]').forEach(b=>b.classList.toggle('active',b.dataset.v===v));document.documentElement.dataset.activeView=v;if(window.nqSetMusicScene)window.nqSetMusicScene(v);if(v!=='game'&&v!=='classroom'&&window.nqBuddyNavigate)window.nqBuddyNavigate(v);scrollTo({top:0,behavior:document.documentElement.dataset.motion==='off'?'auto':'smooth'})}
// Navigasi halaman untuk chatbot Miko
window.nqOpenPage = function(view) {
  const allowedPages = [
    ...document.querySelectorAll('main .view')
  ].map(element => element.id);

  if (!allowedPages.includes(view)) {
    return false;
  }

  go(view);
  return true;
};
document.addEventListener('click',e=>{const logoutButton=e.target.closest('[data-action="logout"]');if(logoutButton){if(window.confirm('Yakin ingin logout dari Neko?'))performLogout();return;}const b=e.target.closest('[data-v]');if(b)go(b.dataset.v)});
const sessionBtn=$('#sessionBtn'),loginNav=$('#loginNav');
function updateSession(){const account=activeAccount,u=account?.displayName||'';sessionBtn.textContent=u?(account.role==='admin'?'Admin · '+u.slice(0,9):'Hai, '+u.slice(0,12)):'Login';sessionBtn.setAttribute('aria-label',u?(account.role==='admin'?'Admin '+u:'Hai, '+u):'Login');sessionBtn.title=u?(account.role==='admin'?'Administrator lokal · '+u:'Profil '+u):'Login';sessionBtn.dataset.v=u?'home':'login';if(u){loginNav.textContent='Logout';loginNav.removeAttribute('data-v');loginNav.dataset.action='logout'}else{loginNav.textContent='Masuk / Login';loginNav.dataset.v='login';loginNav.removeAttribute('data-action')}}
function performLogout(){let errorMessage='';try{localStorage.removeItem(ACCOUNT_SESSION_KEY);localStorage.removeItem('nq_demo_user');sessionStorage.removeItem('nq_session_user')}catch(error){console.warn('Sesi akun tidak dapat dihapus.',error);errorMessage='Sesi tidak dapat dihapus dari perangkat. Periksa izin penyimpanan.'}activeAccount=null;updateSession();document.body.classList.remove('unlocked');document.body.style.overflow='hidden';document.body.style.overflowX='';const gate=$('#authGate'),intro=$('#introSequence');if(gate){gate.style.display='grid';gate.style.opacity='1';gate.style.transform='none';gate.style.transition=''}if(intro){intro.classList.remove('play','intro-exit');intro.style.display='none'}$$('[data-auth-form] input').forEach(input=>input.value='');$$('[data-auth-form] .form-error').forEach(error=>error.textContent='');$('#gateError').textContent=errorMessage;scrollTo(0,0)}
activeAccount=storedSession();updateSession();
if(activeAccount){document.body.classList.add('unlocked');document.body.style.overflowX='hidden';$('#authGate').style.display='none';$('#introSequence').style.display='none';go('home')}

// Theme toggle is managed by the enhanced preference controller below.
// terminal hero
const lines=['$ ping 192.168.10.1','Reply: time=1ms','$ show vlan brief','10 GURU   aktif','20 SISWA  aktif','30 SERVER aktif','$ semua jaringan OK'];let li=0,ci=0,buf='';
setInterval(()=>{const L=lines[li];if(ci<L.length){buf+=L[ci++]}else if(ci++>L.length+6){buf+='\n';li++;ci=0;if(li>=lines.length){li=0;buf=''}}$('#heroTerm').textContent=buf},70);
// VLAN
const H=[['PC Guru','laptop',10],['PC Siswa','monitor',20],['PC Lab','monitor',20],['Server','server',30]];let src=null,dst=null,l3=false;
function hosts(){$('#hosts').innerHTML=H.map((h,i)=>`<div class="host ${i===src?'sel':i===dst?'dst':''}" data-i="${i}"><div class="ic">${ic(h[1])}</div><small>${h[0]}</small><br><button class="tag v${h[2]}" data-c="${i}">VLAN ${h[2]}</button></div>`).join('')}
hosts();
$('#hosts').addEventListener('click',e=>{const c=e.target.closest('[data-c]');if(c){const h=H[Number(c.dataset.c)];h[2]=h[2]===30?10:h[2]+10;hosts();return}const k=e.target.closest('.host');if(!k)return;const i=Number(k.dataset.i);if(src===null){src=i}else if(dst===null){dst=i}else{src=i;dst=null}hosts();$('#vmsg').className='msg';$('#vmsg').textContent=dst===null?`Pengirim: ${H[src][0]}. Pilih perangkat tujuan.`:`Sumber: ${H[src][0]} • Tujuan: ${H[dst][0]}. Tekan Kirim paket.`});
$('#l3').onclick=function(){l3=!l3;this.classList.toggle('on',l3);this.setAttribute('aria-pressed',String(l3));$('#vmsg').textContent=l3?'Router Layer 3 aktif: paket antar-VLAN dapat dirutekan.':'Router Layer 3 mati: paket hanya dapat dikirim di VLAN yang sama.'};
function center(el,p){const a=el.getBoundingClientRect(),b=p.getBoundingClientRect();return[a.left-b.left+a.width/2-9,a.top-b.top+a.height/2-9]}
$('#send').onclick=()=>{if(src===null||dst===null||src===dst){$('#vmsg').className='msg no';$('#vmsg').textContent='Pilih pengirim dan tujuan yang berbeda. Ketuk satu kartu untuk tujuan, klik dua kali untuk pengirim.';return}
const s=H[src],d=H[dst],ok=s[2]===d[2]||l3,stg=$('#stage'),el=$$('.host'),a=center(el[src],stg),m=center($('#sw'),stg),b=center(el[dst],stg),p=$('#pkt');
const kf=ok?[a,m,b]:[a,m];p.animate(kf.map((c,i)=>({transform:`translate(${c[0]}px,${c[1]}px) scale(${i===kf.length-1&&!ok?.2:1})`,opacity:1})),{duration:1300,easing:'ease-in-out',fill:'forwards'}).finished.then(()=>{p.animate([{opacity:1},{opacity:0}],{duration:300,fill:'forwards'});if(!ok){$('#sw').classList.add('bad');setTimeout(()=>$('#sw').classList.remove('bad'),600)}});
setTimeout(()=>{const same=s[2]===d[2];$('#vmsg').className='msg '+(ok?'ok':'no');$('#vmsg').innerHTML=ok?(same?`<b>Terkirim.</b> ${s[0]} dan ${d[0]} sama-sama di VLAN ${s[2]}.`:`<b>Terkirim lewat router.</b> Paket lintas VLAN diteruskan oleh perangkat Layer 3.`):`<b>Paket ditolak switch.</b> VLAN ${s[2]} dan VLAN ${d[2]} adalah broadcast domain berbeda. Samakan VLAN atau aktifkan router Layer 3.`;
if(ok&&same)gain('v1',15);if(!ok)gain('v2',10);if(ok&&!same){gain('v3',20);gain('done_vlan',10)}},1300)};
// Subnet
const toInt=s=>{const b=s.trim().split('.');return b.length===4&&b.every(x=>/^\d+$/.test(x)&&+x<256)?b.reduce((a,x)=>a*256+ +x,0)>>>0:null},toIp=n=>[n>>>24,n>>>16&255,n>>>8&255,n&255].join('.');
$('#bits').innerHTML=Array.from({length:4},()=>'<div class="oct">'+'<i></i>'.repeat(8)+'</div>').join('');
function sub(){const p=+$('#pre').value,n=toInt($('#ipin').value);$('#prel').textContent='/'+p;$$('#bits i').forEach((b,i)=>{b.className=i<p?'':'h';b.textContent=i<p?'N':'H'});if(n===null){$('#stats').innerHTML='<div class="stat" style="grid-column:1/3"><small>Error</small><b>Isi 4 angka 0–255 dipisah titik.</b></div>';return}
const mask=(0xffffffff<<(32-p))>>>0,net=(n&mask)>>>0,bc=(net|~mask)>>>0,u=Math.pow(2,32-p)-2,S=[['Network',toIp(net)],['Broadcast',toIp(bc)],['Mask',toIp(mask)],['Host usable',u.toLocaleString('id-ID')],['Host pertama',toIp(net+1)],['Host terakhir',toIp(bc-1)]];$('#stats').innerHTML=S.map(x=>`<div class="stat"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('')}
$('#pre').oninput=()=>{sub();gain('s1',10)};$('#ipin').oninput=sub;sub();
$('#chk').onclick=()=>{const a=+$('#ans').value,ok=a===26;$('#imsg').className='msg '+(ok?'ok':'no');$('#imsg').innerHTML=ok?'<b>Tepat.</b> /26 memberi 62 host usable, cukup untuk 50 dan masih ada ruang tumbuh.':a>26?`<b>Terlalu kecil.</b> /${a} hanya menyediakan ${Math.max(0,Math.pow(2,32-a)-2)} host.`:'<b>Belum optimal.</b> Muat, tetapi memboroskan alamat. Coba prefix yang lebih besar.';if(ok){gain('s2',25);gain('done_ip',10)}};
// Diagnosa
const T=[{n:'PC pindah port, ping gateway gagal',b:'Setelah dipindah ke port switch lain, link menyala tetapi gateway tidak terjangkau.',o:['Port masuk VLAN yang salah','DNS server mati','Bandwidth penuh'],c:0,pr:['Link UP 1 Gbps full duplex. Kabel sehat.','IP 192.168.20.34/24\nGateway 192.168.20.1\nIP terlihat benar.','Ping gateway: Request timed out\nHost lain di VLAN sama: tidak terlihat.','Tidak relevan: ping memakai alamat IP.']},
{n:'Ping IP berhasil, nama domain gagal',b:'Client bisa ping 198.51.100.25 tetapi browser gagal membuka nama situs.',o:['Kabel putus','Resolver DNS bermasalah','Trunk VLAN rusak'],c:1,pr:['Link UP, tidak ada error.','IP, mask, dan gateway benar.','Ping 198.51.100.25: reply 12 ms','dig example.test\nconnection timed out ke resolver.\nPeriksa IP DNS dan port 53.']},
{n:'Bisa akses lokal, tidak bisa antar-subnet',b:'Client mengakses perangkat satu subnet, tetapi semua subnet lain gagal.',o:['Gateway salah atau rute balik hilang','Monitor rusak','Kabel terlalu panjang'],c:0,pr:['Link UP, counter error normal.','IP dan mask sesuai.\nGateway 192.168.10.254, padahal router di .1','Ke subnet lain: Destination unreachable\nKe sesama subnet: reply','Uji memakai IP juga gagal, bukan masalah nama.']}];
let ti=0;$('#tk').innerHTML=T.map((t,i)=>`<option value="${i}">${t.n}</option>`).join('');
function tick(){const t=T[ti];$('#brief').textContent=t.b;$('#dx').innerHTML=t.o.map((o,i)=>`<button class="opt" data-a="${i}">${o}</button>`).join('');$('#dmsg').innerHTML='';type('$ pilih alat uji...')}
let tm;function type(s){clearInterval(tm);let i=0;$('#out').textContent='';tm=setInterval(()=>{$('#out').textContent=s.slice(0,++i);if(i>=s.length)clearInterval(tm)},18)}
$('#tk').onchange=e=>{ti=+e.target.value;tick()};
document.addEventListener('click',e=>{const p=e.target.closest('[data-p]');if(p){type('$ '+p.textContent.toLowerCase()+'\n'+T[ti].pr[+p.dataset.p]);gain('p'+ti,5)}
const a=e.target.closest('[data-a]');if(a){const ok=+a.dataset.a===T[ti].c;a.classList.add(ok?'right':'wrong');$('#dmsg').innerHTML=`<div class="msg ${ok?'ok':'no'}">${ok?'<b>Benar.</b> Jalankan perbaikan, uji ulang, lalu dokumentasikan.':'<b>Belum sesuai bukti.</b> Jalankan alat uji dan cocokkan hasilnya.'}</div>`;if(ok){gain('f'+ti,20);if(['f0','f1','f2'].every(k=>st.got[k]))gain('done_fix',10)}}});
tick();
// Kuis
const Q=[["Fungsi utama VLAN adalah...",["Memisahkan broadcast domain secara logis","Menambah kecepatan internet","Menggantikan firewall"],0],["Host beda VLAN perlu berkomunikasi. Yang dibutuhkan...",["Hub tambahan","Perangkat Layer 3 dengan routing","Kabel lebih pendek"],1],["Prefix /26 memiliki berapa alamat IPv4 total?",["32","64","128"],1],["Ping ke IP berhasil tetapi nama domain gagal. Periksa...",["Konfigurasi DNS","Daya switch","Warna kabel"],0],["PAT/NAT pada router berfungsi untuk...",["Membuat VLAN","Menerjemahkan alamat privat ke publik","Mempercepat DNS"],1],["Langkah troubleshooting yang paling tepat...",["Ubah banyak setting sekaligus","Kumpulkan bukti, uji hipotesis, perbaiki, verifikasi","Langsung ganti semua perangkat"],1],["Perangkat yang meneruskan frame berdasarkan MAC address adalah...",["Switch","Router","Modem"],0],["Alamat IPv4 memiliki panjang...",["16 bit","32 bit","64 bit"],1],["Alamat MAC umumnya memiliki panjang...",["32 bit","48 bit","128 bit"],1],["Perintah Windows untuk melihat konfigurasi IP adalah...",["ipconfig","mkdir","format"],0],["Perintah untuk menguji keterjangkauan host adalah...",["ping","copy","tasklist"],0],["Subnet mask untuk prefix /24 adalah...",["255.255.0.0","255.255.255.0","255.255.255.252"],1],["Port default HTTP adalah...",["21","80","443"],1],["Port default HTTPS adalah...",["25","110","443"],2],["DHCP digunakan untuk...",["Memberikan konfigurasi IP secara otomatis","Mengenkripsi semua trafik","Membuat kabel jaringan"],0],["DNS bertugas untuk...",["Mengubah nama domain menjadi alamat IP","Mengisi daya router","Mengatur kecepatan kipas"],0],["Kabel straight-through biasanya digunakan untuk menghubungkan...",["Perangkat berbeda jenis, misalnya PC ke switch","Dua PC langsung pada perangkat lama tanpa auto MDI-X","Dua konektor listrik"],0],["Jika lampu link switch mati, pemeriksaan awal yang masuk akal adalah...",["Periksa kabel, port, dan daya perangkat","Ubah wallpaper PC","Hapus browser"],0],["Default gateway adalah...",["Alamat perangkat yang menjadi jalan keluar ke jaringan lain","Nama Wi-Fi","Nomor seri keyboard"],0],["Prinsip keamanan akun yang baik adalah...",["Gunakan satu password untuk semua akun","Bagikan password ke teman","Gunakan password kuat dan jangan dibagikan"],2]]
Q.push(
["Apa fungsi ARP pada jaringan IPv4 lokal?",["Mencari alamat MAC dari alamat IPv4","Membagi jaringan menjadi VLAN","Memberi nama domain"],0],
["Prefix /25 menyediakan berapa host usable?",["62","126","254"],1],
["Prefix /27 menyediakan berapa host usable?",["14","30","62"],1],
["Port default SSH adalah...",["21","22","23"],1],
["Proses DHCP DORA berurutan adalah...",["Discover, Offer, Request, Acknowledge","Data, Open, Route, Apply","Detect, Output, Resolve, Access"],0],
["Layer OSI yang menangani pengalamatan logis dan routing adalah...",["Data Link","Network","Presentation"],1],
["Perangkat yang memisahkan broadcast domain secara default adalah...",["Router","Repeater","Hub"],0],
["Pada switch, tabel MAC dipakai untuk...",["Menentukan port tujuan frame","Memberi IP otomatis","Mengenkripsi Wi-Fi"],0],
["Konektor Ethernet tembaga yang umum dipakai adalah...",["RJ45","SC","F-type"],0],
["Fiber optik mengirimkan data menggunakan...",["Cahaya","Arus DC langsung","Gelombang suara"],0],
["SSID adalah...",["Nama jaringan Wi-Fi","Kunci enkripsi WPA","Alamat IP router"],0],
["Pilihan keamanan Wi-Fi yang disarankan saat tersedia adalah...",["WPA3","WEP","Jaringan terbuka"],0],
["Pada topologi star, perangkat ujung biasanya terhubung ke...",["Switch pusat","Kabel bus tunggal","Perangkat ujung lain"],0],
["Alamat 127.0.0.1 biasanya menunjuk ke...",["Loopback perangkat sendiri","Default gateway publik","Alamat broadcast LAN"],0],
["Sebelum mengubah konfigurasi jaringan produksi, teknisi sebaiknya...",["Mencatat kondisi awal dan menyiapkan rencana pemulihan","Mengubah semua perangkat sekaligus","Membagikan kata sandi admin"],0]
);
let qi=0,sc=0,sk=0;
function q(){if(qi>=Q.length){const pct=Math.round(sc/Q.length*100);$('#qbox').innerHTML=`<div style="text-align:center;padding:30px 0"><div style="font-size:64px;color:var(--c1)">${ic(pct>=80?'trophy':pct>=50?'thumb':'book')}</div><h2>Skor ${sc} dari ${Q.length}</h2><p>${pct>=80?'Mantap, kamu siap praktik di lab.':pct>=50?'Cukup baik. Ulangi misi yang masih ragu.':'Pelajari lagi lewat simulasi, lalu coba ulang.'}</p><div class="row" style="justify-content:center"><button class="btn p" id="again">Ulangi kuis</button></div></div>`;$('#qb').style.width='100%';gain('done_quiz',20);return}
$('#qn').textContent=`Soal ${qi+1} dari ${Q.length}`;$('#qs').textContent='Streak '+sk;$('#qb').style.width=qi/Q.length*100+'%';const x=Q[qi];$('#qbox').innerHTML=`<h3 style="margin-top:20px;font-size:20px">${x[0]}</h3><div class="opts">${x[1].map((o,i)=>`<button class="opt" data-quiz-choice="${i}">${String.fromCharCode(65+i)}. ${o}</button>`).join('')}</div>`}
$('#qbox').addEventListener('click',e=>{
 if(e.target.closest('#again')){qi=sc=sk=0;q();return}
 const b=e.target.closest('[data-quiz-choice]');
 if(!b||b.disabled)return;
 const answers=b.closest('.opts');
 if(!answers||answers.dataset.locked)return;
 answers.dataset.locked='true';
 const choice=Number(b.dataset.quizChoice),correct=Q[qi][2],ok=choice===correct;
 answers.querySelectorAll('[data-quiz-choice]').forEach((button,index)=>{
  button.disabled=true;
  if(index===correct)button.classList.add('right');
  else if(index===choice)button.classList.add('wrong');
 });
 if(ok){sfx('success');sc++;sk++;gain('q'+qi,8+(sk>2?4:0),e.clientX,e.clientY)}else{sfx('fail');sk=0}
 $('#qs').textContent='Streak '+sk;
 const fb=document.createElement('p');fb.style.cssText='margin:14px 0 0;color:var(--muted);font-size:14px';fb.textContent=ok?'Benar! Bagus, lanjutkan.':'Belum tepat. Jawaban yang benar ditandai warna hijau.';
 answers.after(fb);
 setTimeout(()=>{qi++;q()},1350);
});
q();
// Arena Game
function boom(){const cs=['#22e1ff','#8b6cff','#3dffb0','#ffb454','#ff5d7a'];for(let i=0;i<36;i++){const d=document.createElement('i');d.className='cf';d.style.background=cs[i%5];d.style.left=innerWidth/2+'px';d.style.top=innerHeight/2.5+'px';document.body.appendChild(d);const a=Math.random()*6.28,v=140+Math.random()*260;d.animate([{transform:'translate(0,0) rotate(0)',opacity:1},{transform:`translate(${Math.cos(a)*v}px,${Math.sin(a)*v+160}px) rotate(${Math.random()*720}deg)`,opacity:0}],{duration:1300+Math.random()*600,easing:'cubic-bezier(.2,.8,.4,1)'}).finished.then(()=>d.remove())}}
const extraGames={
 'g-port-blitz':{title:'Port Blitz',button:'Port Blitz',icon:'i-server',questions:[
  ['Layanan web HTTPS biasanya memakai port...', ['22','53','443','8080'],2],['SSH secara default memakai port...', ['21','22','23','25'],1],['DNS biasanya menggunakan port...', ['53','67','80','110'],0],['DHCP server menerima permintaan klien pada port UDP...', ['53','67','123','443'],1],['SMTP submission terenkripsi umumnya memakai port...', ['25','110','587','3389'],2],['Remote Desktop Protocol default memakai port...', ['143','389','3389','8080'],2],['NTP untuk sinkronisasi waktu biasanya memakai port...', ['22','53','123','161'],2],['HTTP tanpa TLS biasanya memakai port...', ['21','80','443','445'],1]
 ]},
 'g-wireless':{title:'Wireless Detective',button:'Wi-Fi Detective',icon:'i-antenna',questions:[
  ['Satu ruangan memiliki sinyal Wi-Fi lemah. Langkah awal terbaik...', ['Periksa posisi AP dan lakukan site survey','Matikan DHCP','Ganti semua alamat menjadi publik'],0],['Klien tersambung ke SSID tetapi mendapat alamat 169.254.x.x. Periksa...', ['DHCP dan koneksi menuju server DHCP','Monitor klien','Nama komputer saja'],0],['Banyak jaringan 2.4 GHz saling bertumpuk. Tindakan yang tepat...', ['Survey kanal dan pilih kanal yang minim interferensi','Gunakan semua kanal sekaligus','Matikan enkripsi'],0],['Cara aman memberi akses internet untuk tamu...', ['Gunakan guest network terpisah','Bagikan akun admin router','Matikan kata sandi Wi-Fi utama'],0],['Standar keamanan modern yang disarankan saat tersedia...', ['WPA3','WEP','Open network'],0],['Sinyal turun setelah melewati beberapa dinding. Penyebab yang masuk akal...', ['Redaman material dan jarak','DNS record MX','Subnet mask terlalu besar'],0],['Perangkat 2.4 GHz lama tidak dapat tersambung ke jaringan 5 GHz saja. Solusi...', ['Sediakan band 2.4 GHz yang kompatibel','Ubah gateway ke DNS','Matikan access point'],0],['Setelah mengganti SSID, klien lama gagal tersambung. Periksa...', ['Profil tersimpan dan kredensial jaringan klien','Tabel routing internet global','Ukuran MTU printer'],0]
 ]}
};
const gameTabs=$('.gtabs'),extraGameStates={};
Object.entries(extraGames).forEach(([id,game])=>{
 gameTabs.insertAdjacentHTML('beforeend',`<button class="btn" data-g="${id}"><svg class="i"><use href="#${game.icon}"/></svg> ${game.button}</button>`);
 $('#g-route').insertAdjacentHTML('afterend',`<div class="gp" id="${id}"><div class="glass card"><div class="gh"><h3>${game.title}</h3><span class="chip">Ronde <b data-extra-score="${id}">0</b>/${game.questions.length}</span></div><p>${game.questions.length} soal cepat dengan jawaban dan penjelasan langsung.</p><div data-extra-host="${id}"><div class="msg">Tekan mulai untuk bermain.</div><button class="btn p" type="button" data-extra-start="${id}">Mulai</button></div></div></div>`);
 extraGameStates[id]={index:0,score:0,locked:false};
});
function renderExtraGame(id){const game=extraGames[id],state=extraGameStates[id],host=$(`[data-extra-host="${id}"]`);$(`[data-extra-score="${id}"]`).textContent=state.score;if(state.index>=game.questions.length){host.innerHTML=`<div class="msg ${state.score>=6?'ok':'no'}"><b>Ronde selesai: ${state.score}/${game.questions.length}</b><p>${state.score>=6?'Bagus! Kamu menguasai topik ini.':'Baca kembali materi lalu coba lagi.'}</p><button class="btn p" type="button" data-extra-start="${id}">Main lagi</button></div>`;if(state.score>=6)gain(id,20);return}const [question,answers,correct]=game.questions[state.index];host.innerHTML=`<p style="margin:16px 0 8px">${state.index+1}. ${question}</p><div class="opts">${answers.map((answer,index)=>`<button class="opt" type="button" data-extra-answer="${index}" data-extra-game="${id}">${String.fromCharCode(65+index)}. ${answer}</button>`).join('')}</div>`}
$('#game')?.addEventListener('click',e=>{const start=e.target.closest('[data-extra-start]');if(start){const state=extraGameStates[start.dataset.extraStart];state.index=0;state.score=0;state.locked=false;renderExtraGame(start.dataset.extraStart);return}const answer=e.target.closest('[data-extra-answer]');if(!answer)return;const id=answer.dataset.extraGame,state=extraGameStates[id],game=extraGames[id];if(state.locked)return;state.locked=true;const item=game.questions[state.index],correct=Number(answer.dataset.extraAnswer)===item[2];if(correct){state.score++;answer.classList.add('right');sfx('success')}else{answer.classList.add('wrong');sfx('fail')}answer.parentElement.querySelectorAll('button').forEach(button=>button.disabled=true);const explanation=document.createElement('div');explanation.className='msg '+(correct?'ok':'no');explanation.textContent=correct?'Tepat!':`Belum tepat. Jawaban benar: ${item[1][item[2]]}.`;answer.parentElement.after(explanation);window.setTimeout(()=>{state.index++;state.locked=false;renderExtraGame(id)},1000)});
$$('[data-g]').forEach(b=>b.onclick=()=>{$$('[data-g]').forEach(x=>x.classList.toggle('p',x===b));$$('.gp').forEach(p=>p.classList.toggle('on',p.id===b.dataset.g))});
const spyHost=$('#spyHost'),spyWords=[
 {word:'PANTAI',category:'Tempat',categoryEn:'Place',clue:'Tempat terbuka yang sering memiliki pasir dan ombak.',clueEn:'An open place that often has sand and waves.'},
 {word:'ROUTER',category:'Perangkat jaringan',categoryEn:'Network device',clue:'Perangkat yang membantu data memilih jalur ke jaringan lain.',clueEn:'A device that helps data find a path to another network.'},
 {word:'KABEL UTP',category:'Media jaringan',categoryEn:'Network medium',clue:'Media tembaga yang umum dipakai untuk koneksi Ethernet.',clueEn:'A copper medium commonly used for Ethernet connections.'},
 {word:'LAB KOMPUTER',category:'Ruang sekolah',categoryEn:'School room',clue:'Ruangan untuk praktik menggunakan banyak komputer.',clueEn:'A room where students practice using many computers.'},
 {word:'ACCESS POINT',category:'Perangkat jaringan',categoryEn:'Network device',clue:'Perangkat yang menyediakan akses jaringan nirkabel.',clueEn:'A device that provides access to a wireless network.'},
 {word:'SWITCH',category:'Perangkat jaringan',categoryEn:'Network device',clue:'Perangkat yang meneruskan frame di dalam jaringan lokal.',clueEn:'A device that forwards frames within a local network.'},
 {word:'FIBER OPTIK',category:'Media jaringan',categoryEn:'Network medium',clue:'Media transmisi yang membawa data menggunakan cahaya.',clueEn:'A transmission medium that carries data using light.'},
 {word:'SERVER',category:'Komputer',categoryEn:'Computer',clue:'Komputer yang menyediakan layanan atau sumber daya bagi klien.',clueEn:'A computer that provides services or resources to clients.'},
 {word:'SEKOLAH',category:'Tempat',categoryEn:'Place',clue:'Tempat siswa belajar bersama guru.',clueEn:'A place where students learn with teachers.'},
 {word:'PERPUSTAKAAN',category:'Tempat',categoryEn:'Place',clue:'Tempat untuk membaca atau meminjam buku.',clueEn:'A place to read or borrow books.'},
 {word:'KANTIN',category:'Tempat',categoryEn:'Place',clue:'Tempat membeli makanan saat istirahat.',clueEn:'A place to buy food during a break.'},
 {word:'LAPANGAN',category:'Tempat',categoryEn:'Place',clue:'Area terbuka untuk berolahraga atau bermain.',clueEn:'An open area for sports or games.'},
 {word:'KELAS',category:'Tempat',categoryEn:'Place',clue:'Ruangan tempat pelajaran biasanya berlangsung.',clueEn:'A room where lessons usually take place.'},
 {word:'KOMPUTER',category:'Perangkat',categoryEn:'Device',clue:'Perangkat elektronik untuk mengolah data dan menjalankan aplikasi.',clueEn:'An electronic device that processes data and runs applications.'},
 {word:'KEYBOARD',category:'Perangkat',categoryEn:'Device',clue:'Alat dengan banyak tombol untuk mengetik.',clueEn:'A device with many keys used for typing.'},
 {word:'MOUSE',category:'Perangkat',categoryEn:'Device',clue:'Alat untuk menggerakkan penunjuk di layar.',clueEn:'A device used to move the pointer on a screen.'},
 {word:'MONITOR',category:'Perangkat',categoryEn:'Device',clue:'Layar yang menampilkan gambar dari komputer.',clueEn:'A screen that displays images from a computer.'},
 {word:'PRINTER',category:'Perangkat',categoryEn:'Device',clue:'Perangkat yang mencetak dokumen ke kertas.',clueEn:'A device that prints documents onto paper.'},
 {word:'KAMERA',category:'Perangkat',categoryEn:'Device',clue:'Perangkat untuk mengambil foto atau video.',clueEn:'A device used to take photos or videos.'},
 {word:'HEADSET',category:'Perangkat',categoryEn:'Device',clue:'Perangkat yang dipakai untuk mendengar suara dengan lebih dekat.',clueEn:'A device worn to listen to sound more privately.'},
 {word:'FLASHDISK',category:'Penyimpanan',categoryEn:'Storage',clue:'Penyimpanan kecil yang mudah dibawa dan dipasang ke USB.',clueEn:'A small portable storage device that plugs into USB.'},
 {word:'ROTI',category:'Makanan',categoryEn:'Food',clue:'Makanan yang sering dibuat dari tepung dan dipanggang.',clueEn:'A food often made from flour and baked.'},
 {word:'NASI GORENG',category:'Makanan',categoryEn:'Food',clue:'Hidangan nasi yang dimasak kembali bersama bumbu.',clueEn:'A rice dish cooked again with seasonings.'},
 {word:'PISANG',category:'Buah',categoryEn:'Fruit',clue:'Buah berkulit kuning yang mudah dikupas.',clueEn:'A yellow-skinned fruit that is easy to peel.'},
 {word:'JERUK',category:'Buah',categoryEn:'Fruit',clue:'Buah berwarna cerah yang rasanya bisa manis atau asam.',clueEn:'A bright-colored fruit that can taste sweet or sour.'},
 {word:'ES KRIM',category:'Makanan',categoryEn:'Food',clue:'Camilan dingin yang biasanya disimpan di freezer.',clueEn:'A cold treat usually kept in a freezer.'},
 {word:'AIR MINUM',category:'Minuman',categoryEn:'Drink',clue:'Minuman yang dibutuhkan tubuh setiap hari.',clueEn:'A drink the body needs every day.'},
 {word:'SEPEDA',category:'Kendaraan',categoryEn:'Vehicle',clue:'Kendaraan beroda dua yang digerakkan dengan pedal.',clueEn:'A two-wheeled vehicle powered by pedals.'},
 {word:'BUS',category:'Kendaraan',categoryEn:'Vehicle',clue:'Kendaraan besar yang membawa banyak penumpang.',clueEn:'A large vehicle that carries many passengers.'},
 {word:'KERETA',category:'Kendaraan',categoryEn:'Vehicle',clue:'Kendaraan panjang yang berjalan di atas rel.',clueEn:'A long vehicle that travels on rails.'},
 {word:'PAYUNG',category:'Benda',categoryEn:'Object',clue:'Benda yang dibuka di atas kepala saat hujan.',clueEn:'An object opened over your head when it rains.'},
 {word:'JAM TANGAN',category:'Benda',categoryEn:'Object',clue:'Benda yang dipakai di pergelangan untuk melihat waktu.',clueEn:'An item worn on the wrist to tell the time.'},
 {word:'BOLA',category:'Olahraga',categoryEn:'Sport',clue:'Benda bulat yang digunakan dalam banyak permainan.',clueEn:'A round object used in many games.'},
 {word:'SEPAK BOLA',category:'Olahraga',categoryEn:'Sport',clue:'Olahraga beregu yang dimainkan dengan menendang bola.',clueEn:'A team sport played by kicking a ball.'},
 {word:'BULU TANGKIS',category:'Olahraga',categoryEn:'Sport',clue:'Olahraga raket yang memakai kok dan net.',clueEn:'A racket sport played with a shuttlecock and net.'},
 {word:'MATAHARI',category:'Alam',categoryEn:'Nature',clue:'Bintang yang memberi cahaya dan panas pada siang hari.',clueEn:'The star that gives us light and warmth during the day.'},
 {word:'HUJAN',category:'Alam',categoryEn:'Nature',clue:'Air yang jatuh dari awan ke permukaan bumi.',clueEn:'Water falling from clouds to the ground.'},
 {word:'GUNUNG',category:'Alam',categoryEn:'Nature',clue:'Bentuk daratan tinggi yang menjulang di atas sekitarnya.',clueEn:'A high landform rising above the surrounding area.'},
 {word:'KUCING',category:'Hewan',categoryEn:'Animal',clue:'Hewan peliharaan yang suka mengeong dan mengejar benda kecil.',clueEn:'A pet that meows and likes chasing small things.'},
 {word:'KELINCI',category:'Hewan',categoryEn:'Animal',clue:'Hewan bertelinga panjang yang suka melompat.',clueEn:'A long-eared animal that likes to hop.'},
 {word:'KURA-KURA',category:'Hewan',categoryEn:'Animal',clue:'Hewan yang membawa cangkang keras di punggungnya.',clueEn:'An animal that carries a hard shell on its back.'},
 {word:'BINTANG',category:'Alam',categoryEn:'Nature',clue:'Benda langit yang tampak berkilau pada malam cerah.',clueEn:'A celestial object that shines on a clear night.'},
 {word:'JEMBATAN',category:'Tempat',categoryEn:'Place',clue:'Bangunan yang membantu orang atau kendaraan melewati rintangan.',clueEn:'A structure that helps people or vehicles cross an obstacle.'},
 {word:'PASAR',category:'Tempat',categoryEn:'Place',clue:'Tempat orang membeli dan menjual berbagai barang.',clueEn:'A place where people buy and sell many kinds of goods.'},
 {word:'RUMAH SAKIT',category:'Tempat',categoryEn:'Place',clue:'Tempat tenaga kesehatan merawat orang yang sakit.',clueEn:'A place where health workers care for sick people.'},
 {word:'APLIKASI',category:'Teknologi',categoryEn:'Technology',clue:'Perangkat lunak yang membantu pengguna melakukan tugas tertentu.',clueEn:'Software that helps users perform a particular task.'},
 {word:'PASSWORD',category:'Teknologi',categoryEn:'Technology',clue:'Kata rahasia yang digunakan untuk membuktikan akses ke akun.',clueEn:'A secret phrase used to prove access to an account.'}
];
let spyRound=null;
function spyButton(label,action,primary=false){const button=document.createElement('button');button.type='button';button.className=primary?'btn p':'btn';button.textContent=label;button.addEventListener('click',action);return button}
function spyText(parent,tag,text,className=''){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;parent.append(node);return node}
function spyLanguage(id,en){return document.documentElement.dataset.language==='en'?en:id}
function clearSpyTimer(){if(spyRound?.timerHandle){clearInterval(spyRound.timerHandle);spyRound.timerHandle=null}}
function formatSpyTime(seconds){return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`}
function renderSpySetup(previousNames=[],playerCount=6,durationMinutes=3){
 if(!spyHost)return;
 spyHost.innerHTML=`<div class="spy-setup"><label for="spyCount">${spyLanguage('Jumlah pemain','Players')}</label><select id="spyCount">${Array.from({length:28},(_,i)=>i+3).map(count=>`<option value="${count}" ${count===playerCount?'selected':''}>${count} ${spyLanguage('pemain',count===1?'player':'players')}</option>`).join('')}</select><label for="spyDuration">${spyLanguage('Durasi diskusi','Discussion timer')}</label><select id="spyDuration">${[1,2,3,5,8,10].map(minutes=>`<option value="${minutes}" ${minutes===durationMinutes?'selected':''}>${minutes} ${spyLanguage('menit',minutes===1?'minute':'minutes')}</option>`).join('')}</select><div class="spy-player-fields" id="spyPlayerFields"></div><p class="tiny">${spyLanguage('Nama hanya dipakai di perangkat ini untuk ronde saat ini. Tidak ada akun atau server.','Names are used only on this device for this round. No account or server is required.')}</p><p class="form-error" id="spyError" role="status"></p><button class="btn p" id="spyStart" type="button">${spyLanguage('Acak peran & mulai','Shuffle roles & start')}</button></div>`;
 const fields=$('#spyPlayerFields');for(let i=0;i<playerCount;i++){const label=document.createElement('label');label.className='spy-player-field';const number=spyText(label,'b',String(i+1).padStart(2,'0'));number.setAttribute('aria-hidden','true');const input=document.createElement('input');input.type='text';input.maxLength=20;input.autocomplete='off';input.placeholder=`${spyLanguage('Nama pemain','Player')} ${i+1}`;input.value=previousNames[i]||'';input.dataset.spyName='';input.setAttribute('aria-label',input.placeholder);label.append(input);fields.append(label)}
 $('#spyCount').addEventListener('change',event=>{const names=[...spyHost.querySelectorAll('[data-spy-name]')].map(input=>input.value);renderSpySetup(names,Number(event.target.value),Number($('#spyDuration').value))});
 $('#spyStart').addEventListener('click',()=>{
  const names=[...spyHost.querySelectorAll('[data-spy-name]')].map((input,index)=>input.value.trim()||`${spyLanguage('Pemain','Player')} ${index+1}`),normalized=names.map(name=>name.toLocaleLowerCase());
  if(new Set(normalized).size!==names.length){$('#spyError').textContent=spyLanguage('Setiap pemain perlu nama yang berbeda.','Each player needs a unique name.');return}
  const durationMinutes=Number($('#spyDuration').value);
  spyRound={players:names,spyIndex:Math.floor(Math.random()*names.length),word:spyWords[Math.floor(Math.random()*spyWords.length)],turn:0,roleShown:false,phase:'roles',votes:[],voteShown:false,durationSeconds:durationMinutes*60,secondsLeft:durationMinutes*60,timerHandle:null};
  renderSpy();
 });
}
function renderSpy(){
 if(!spyHost||!spyRound)return;
 spyHost.replaceChildren();
 const round=spyRound;
 if(round.phase==='roles'&&round.roleShown&&round.turn===round.spyIndex)document.documentElement.dataset.spyScreen='spy';else delete document.documentElement.dataset.spyScreen;
 if(round.phase==='roles'){
  const center=spyText(spyHost,'div','','spy-stage-center'),name=round.players[round.turn];
  spyText(center,'div',`${spyLanguage('Pemain','Player')} ${round.turn+1} ${spyLanguage('dari','of')} ${round.players.length}`,'section-kicker');
  spyText(center,'h4',round.roleShown?spyLanguage('Peran pribadi','Private role'):spyLanguage('Berikan perangkat ke pemain berikut','Pass the device to the next player'));
  spyText(center,'p',round.roleShown?spyLanguage('Jangan tunjukkan layar kepada pemain lain. Sembunyikan peran sebelum menyerahkan perangkat.','Keep your role hidden. Hide it before passing the device to the next player.'):spyLanguage(`Serahkan perangkat kepada ${name}. Pastikan pemain lain tidak melihat layar.`,`Pass the device to ${name}. Make sure other players cannot see the screen.`),'spy-private');
  if(round.roleShown){
   const isSpy=round.turn===round.spyIndex,card=spyText(spyHost,'div','','spy-role-card'+(isSpy?' is-spy':''));spyText(card,'h4',name);
   if(isSpy){const logo=document.createElementNS('http://www.w3.org/2000/svg','svg');logo.setAttribute('viewBox','0 0 24 24');logo.setAttribute('class','spy-role-logo');logo.setAttribute('aria-label',spyLanguage('Logo mata-mata','Spy emblem'));logo.innerHTML='<use href="#i-spy"></use>';card.prepend(logo);spyText(card,'strong',spyLanguage('KAMU ADALAH SPY','YOU ARE THE SPY'));spyText(card,'p',spyLanguage('Kamu tidak mengetahui kata rahasia. Gunakan kategori dan clue ini untuk menyusun petunjuk yang meyakinkan.','You do not know the secret word. Use this category and clue to give a convincing hint.'))}
   else{spyText(card,'strong',round.word.word);spyText(card,'p',spyLanguage('Kamu bukan Spy. Berikan clue tanpa menyebut kata rahasia secara langsung.','You are not the Spy. Give a clue without saying the secret word.'))}
   spyText(card,'p',`${spyLanguage('Kategori','Category')}: ${spyLanguage(round.word.category,round.word.categoryEn)}`,'spy-category');
   const details=document.createElement('details');details.className='spy-clue';const summary=document.createElement('summary');summary.textContent=spyLanguage('Lihat clue','Show clue');spyText(details,'p',spyLanguage(round.word.clue,round.word.clueEn));details.prepend(summary);card.append(details);
   const next=round.turn+1===round.players.length?spyLanguage('Sembunyikan peran & atur diskusi','Hide roles & set up discussion'):`${spyLanguage('Sembunyikan & serahkan ke','Hide & pass to')} ${round.players[round.turn+1]}`;
   spyHost.append(spyButton(next,()=>{if(round.turn+1===round.players.length){round.phase='discussion'}else{round.turn++;round.roleShown=false}renderSpy()},true));
  }else spyHost.append(spyButton(spyLanguage('Lihat peranku','Reveal my role'),()=>{round.roleShown=true;renderSpy()},true));
  return;
 }
 if(round.phase==='discussion'){
  const center=spyText(spyHost,'div','','spy-stage-center');spyText(center,'div',spyLanguage('SEMUA PERAN SUDAH DIBAGIKAN','ALL ROLES HAVE BEEN SHARED'),'section-kicker');spyText(center,'h4',spyLanguage('Waktu diskusi','Discussion time'));spyText(center,'p',spyLanguage('Berikan clue satu per satu, lalu diskusikan siapa Spy. Timer dimulai saat tombol ditekan.','Take turns giving clues, then discuss who the Spy is. The timer starts when you press the button.'),'spy-private');
  spyText(center,'div',formatSpyTime(round.durationSeconds),'spy-timer');
  spyHost.append(spyButton(spyLanguage('Mulai timer & diskusi','Start timer & discussion'),()=>{round.phase='discussionActive';round.secondsLeft=round.durationSeconds;renderSpy();round.timerHandle=window.setInterval(()=>{if(!spyRound||spyRound!==round)return;round.secondsLeft=Math.max(0,round.secondsLeft-1);const timer=$('#spyTimer');if(timer)timer.textContent=formatSpyTime(round.secondsLeft);if(round.secondsLeft===0){clearSpyTimer();round.phase='vote';round.turn=0;round.voteShown=false;renderSpy()}},1000)},true));return;
 }
 if(round.phase==='discussionActive'){
  const center=spyText(spyHost,'div','','spy-stage-center');spyText(center,'div',spyLanguage('DISKUSI BERLANGSUNG','DISCUSSION IN PROGRESS'),'section-kicker');spyText(center,'h4',spyLanguage('Sisa waktu','Time remaining'));spyText(center,'div',formatSpyTime(round.secondsLeft),'spy-timer');const timer=center.lastElementChild;timer.id='spyTimer';timer.setAttribute('role','timer');timer.setAttribute('aria-live','off');
  spyHost.append(spyButton(spyLanguage('Diskusi selesai — mulai voting','End discussion — start voting'),()=>{clearSpyTimer();round.phase='vote';round.turn=0;round.voteShown=false;renderSpy()},true));return;
 }
 if(round.phase==='vote'){
  const voter=round.players[round.turn],center=spyText(spyHost,'div','','spy-stage-center');
  spyText(center,'div',`${spyLanguage('VOTING','VOTING')} • ${round.turn+1}/${round.players.length}`,'section-kicker');
  if(!round.voteShown){
   spyText(center,'h4',spyLanguage('Serahkan perangkat ke pemilih berikutnya','Pass the device to the next voter'));spyText(center,'p',spyLanguage(`Berikan perangkat hanya kepada ${voter}. Pilihan tidak akan ditampilkan ke pemain lain.`,`Pass the device only to ${voter}. Their vote will stay private.`),'spy-private');
   spyHost.append(spyButton(spyLanguage('Siap memilih','Ready to vote'),()=>{round.voteShown=true;renderSpy()},true));return;
  }
  spyText(center,'h4',`${voter}, ${spyLanguage('pilih siapa yang kamu curigai','choose who you suspect')}`);spyText(center,'p',spyLanguage('Pilih satu pemain. Kamu tidak bisa memilih dirimu sendiri.','Choose one player. You cannot vote for yourself.'),'spy-private');
  const choices=spyText(spyHost,'div','','spy-vote-options');
  round.players.forEach((candidate,index)=>{if(index===round.turn)return;choices.append(spyButton(candidate,()=>{round.votes.push(index);round.turn++;round.voteShown=false;if(round.turn===round.players.length)round.phase='result';renderSpy()}))});
  return;
 }
 const counts=round.players.map((_,index)=>round.votes.filter(vote=>vote===index).length),maxVotes=Math.max(...counts),leaders=counts.map((count,index)=>count===maxVotes?index:-1).filter(index=>index>=0),caught=leaders.length===1&&leaders[0]===round.spyIndex;
 const center=spyText(spyHost,'div','','spy-stage-center');spyText(center,'div',spyLanguage('HASIL RONDE','ROUND RESULTS'),'section-kicker');spyText(center,'h4',caught?spyLanguage('Spy berhasil ditemukan!','The Spy was found!'):leaders.length>1?spyLanguage('Voting imbang — Spy lolos.','The vote is tied — the Spy escapes.'):spyLanguage('Spy belum tertangkap.','The Spy was not caught.'));spyText(center,'p',`${spyLanguage('Kata rahasia','Secret word')}: ${round.word.word} • Spy: ${round.players[round.spyIndex]}`,'spy-private');
 const results=spyText(spyHost,'div','','spy-results');round.players.forEach((name,index)=>{const row=spyText(results,'div','','spy-result-row'+(index===round.spyIndex?' is-spy':''));spyText(row,'span',name);spyText(row,'strong',`${counts[index]} suara${index===round.spyIndex?' • SPY':''}`)});
 spyHost.append(spyButton(spyLanguage('Main ronde baru','Play another round'),()=>{clearSpyTimer();delete document.documentElement.dataset.spyScreen;spyRound=null;renderSpySetup(round.players,round.players.length,round.durationSeconds/60)},true));
}
renderSpySetup();
window.nqRefreshSpyLanguage=()=>{
 const names=[...spyHost.querySelectorAll('[data-spy-name]')].map(input=>input.value),count=Number($('#spyCount')?.value)||6,duration=Number($('#spyDuration')?.value)||3;
 if(spyRound)renderSpy();else renderSpySetup(names,count,duration);
};
const W=[['Putih-Oranye','#ff9a3c',1],['Oranye','#ff9a3c',0],['Putih-Hijau','#2fcf6b',1],['Biru','#3b82f6',0],['Putih-Biru','#3b82f6',1],['Hijau','#2fcf6b',0],['Putih-Cokelat','#a0693b',1],['Cokelat','#a0693b',0]];
const wc=w=>w[2]?`repeating-linear-gradient(135deg,#fff 0 5px,${w[1]} 5px 10px)`:w[1];
let ck=0,ct=0,ctm;
function cable(){clearInterval(ctm);ck=0;ct=0;$('#ctime').textContent='0.0 s';$('#cslots').classList.remove('won');$('#cslots').innerHTML=W.map((w,i)=>`<div class="slot"><small>${i+1}</small></div>`).join('');const o=W.map((w,i)=>i).sort(()=>Math.random()-.5);$('#cpool').innerHTML=o.map(i=>`<button class="wire" data-w="${i}"><i style="background:${wc(W[i])}"></i><small>${W[i][0]}</small></button>`).join('');$('#cmsg').className='msg';$('#cmsg').textContent='Mulai dari pin 1: Putih-Oranye.'}
$('#cpool').addEventListener('click',e=>{const b=e.target.closest('[data-w]');if(!b)return;if(!ck&&!ctm){const t0=performance.now();ctm=setInterval(()=>{ct=(performance.now()-t0)/1000;$('#ctime').textContent=ct.toFixed(1)+' s'},100)}
if(+b.dataset.w===ck){const s=$$('#cslots .slot')[ck];if(document.documentElement.dataset.motion!=='off'&&typeof b.animate==='function'){const from=b.getBoundingClientRect(),to=s.getBoundingClientRect(),clone=b.cloneNode(true);clone.classList.add('wire-flight');clone.style.left=from.left+'px';clone.style.top=from.top+'px';clone.style.width=from.width+'px';clone.style.height=from.height+'px';document.body.appendChild(clone);const dx=to.left-from.left+(to.width-from.width)/2,dy=to.top-from.top+(to.height-from.height)/2;clone.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${dx}px,${dy}px) scale(.7)`,opacity:.25}],{duration:480,easing:'cubic-bezier(.2,.8,.2,1)'}).finished.then(()=>clone.remove(),()=>clone.remove())}s.insertAdjacentHTML('afterbegin',`<i style="background:${wc(W[ck])}"></i>`);s.classList.add('fill');b.classList.add('gone');ck++;if(window.nqBuddyCable)window.nqBuddyCable(true,ck);if(ck===8){clearInterval(ctm);ctm=0;$('#cmsg').className='msg ok';$('#cmsg').innerHTML=`<b>🎉 Selesai dalam ${ct.toFixed(1)} detik.</b> Kabel straight T568B siap di-crimping.`;$('#cslots').classList.add('won');boom();gain('g1',25);if(window.nqBuddyCable)window.nqBuddyCable(true,8)}}else{b.classList.add('shake');setTimeout(()=>b.classList.remove('shake'),400);$('#cmsg').className='msg no';$('#cmsg').textContent='Urutan belum tepat. Cek pin berikutnya.';if(window.nqBuddyCable)window.nqBuddyCable(false,ck)}});
$('#cre').onclick=()=>{ctm=0;cable()};cable();
const P=[['80','HTTP'],['443','HTTPS'],['22','SSH'],['53','DNS'],['21','FTP'],['25','SMTP']];
let fl=[],mv=0,mt=0,lock=false;
function mem(){fl=[];mv=0;mt=0;lock=false;const c=P.flatMap((p,i)=>[[i,p[0],'port'],[i,p[1],'layanan']]).sort(()=>Math.random()-.5);$('#mgrid').innerHTML=c.map(x=>`<button class="fc" data-k="${x[0]}"><span class="fi"><b class="ff">${ic('plug')}</b><b class="fb ${x[2]}">${x[1]}</b></span></button>`).join('');$('#mmv').textContent='0 langkah';$('#mmsg').className='msg';$('#mmsg').textContent='Cocokkan nomor port dengan layanannya.'}
$('#mgrid').addEventListener('click',e=>{const c=e.target.closest('.fc');if(!c||lock||c.classList.contains('open')||c.classList.contains('hit'))return;c.classList.add('open');fl.push(c);if(fl.length===2){mv++;$('#mmv').textContent=mv+' langkah';const[a,b]=fl;if(a.dataset.k===b.dataset.k){a.classList.add('hit');b.classList.add('hit');fl=[];if(++mt===P.length){$('#mmsg').className='msg ok';$('#mmsg').innerHTML=`<b>Semua pasangan ketemu dalam ${mv} langkah.</b>`;boom();gain('g2',25)}}else{lock=true;setTimeout(()=>{a.classList.remove('open');b.classList.remove('open');fl=[];lock=false},800)}}});
$('#mre').onclick=mem;mem();
let sp={on:0,s:0,t:0,a:0};
function sq(){const p=24+Math.floor(Math.random()*7),c=2**(32-p)-2,o=[...new Set([c,c+2,c*2+2,Math.max(2,Math.floor(c/2)-1)])].sort(()=>Math.random()-.5);sp.a=c;$('#sq').innerHTML=`<h3 style="font-size:22px;margin-top:16px">Host usable pada /${p}?</h3><div class="opts">${o.map(v=>`<button class="opt" data-s="${v}">${v}</button>`).join('')}</div>`}
function endSp(){sp.on=0;$('#sgo').disabled=false;$('#sq').innerHTML=`<div class="msg ${sp.s>=5?'ok':'no'}"><b>Waktu habis. Skor ${sp.s}.</b> ${sp.s>=5?'Bagus, kamu cepat menghitung subnet.':'Target 5 benar. Coba lagi.'}</div>`;if(sp.s>=5){boom();gain('g3',30)}}
$('#sgo').onclick=()=>{sp.on=1;sp.s=0;$('#ssc').textContent='0';$('#sgo').disabled=true;const b=$('#sbar');b.style.transition='none';b.style.width='100%';void b.offsetWidth;b.style.transition='width 30s linear';b.style.width='0%';sq();clearTimeout(sp.t);sp.t=setTimeout(endSp,30000)};
$('#sq').addEventListener('click',e=>{const b=e.target.closest('[data-s]');if(!b||!sp.on)return;if(+b.dataset.s===sp.a){sp.s++;$('#ssc').textContent=sp.s;b.classList.add('right');sfx('success');setTimeout(()=>sp.on&&sq(),250)}else{b.classList.add('wrong');sfx('tap');setTimeout(()=>sp.on&&sq(),300)}});
// GAME 4: OSI Challenge
const osiQ=[
 {q:'Kabel UTP putus sehingga sinyal tidak sampai.',a:'Physical',o:['Physical','Network','Application','Session'],why:'Layer Physical menangani media fisik dan bit.'},
 {q:'Switch meneruskan frame berdasarkan alamat MAC.',a:'Data Link',o:['Transport','Data Link','Presentation','Network'],why:'Layer Data Link menangani frame dan alamat MAC.'},
 {q:'Router menentukan jalur paket berdasarkan alamat IP.',a:'Network',o:['Network','Physical','Application','Data Link'],why:'Layer Network menangani pengalamatan IP dan routing.'},
 {q:'TCP memastikan pengiriman data yang andal.',a:'Transport',o:['Session','Transport','Network','Physical'],why:'Layer Transport mengatur komunikasi end-to-end, termasuk TCP.'},
 {q:'Browser meminta halaman web melalui HTTP/HTTPS.',a:'Application',o:['Application','Data Link','Physical','Network'],why:'HTTP dan HTTPS merupakan protokol layer Application.'},
 {q:'Data dienkripsi atau diterjemahkan ke format yang sesuai.',a:'Presentation',o:['Presentation','Transport','Network','Physical'],why:'Layer Presentation berkaitan dengan format, enkripsi, dan kompresi data.'},
 {q:'Komunikasi antar aplikasi memakai nomor port sumber dan tujuan.',a:'Transport',o:['Transport','Physical','Presentation','Session'],why:'Layer Transport menggunakan port dan mengatur pengiriman antaraplikasi.'},
 {q:'Sebuah frame Ethernet memiliki alamat MAC sumber dan tujuan.',a:'Data Link',o:['Data Link','Network','Session','Application'],why:'Alamat MAC dan frame merupakan tanggung jawab Data Link.'},
 {q:'Aplikasi membuat permintaan DNS untuk mencari alamat sebuah nama domain.',a:'Application',o:['Application','Physical','Data Link','Presentation'],why:'DNS adalah protokol layanan pada layer Application.'},
 {q:'Koneksi TCP dibangun dan dikelola selama komunikasi berlangsung.',a:'Transport',o:['Transport','Network','Physical','Presentation'],why:'TCP berada pada layer Transport.'}
];let oi=0,oscore=0,olock=false;
function osiRender(){if(oi>=osiQ.length){$('#osibox').innerHTML=`<div class="msg ${oscore>=4?'ok':'no'}"><h3>Tantangan selesai: ${oscore}/${osiQ.length}</h3><p>${oscore>=4?'Mantap! Pemahaman layer OSI kamu bagus.':'Coba lagi dan perhatikan fungsi setiap layer.'}</p><button class="btn p" id="osiplayagain">Main lagi</button></div>`;if(oscore>=4){boom();gain('g-osi',30)}$('#osiplayagain').onclick=osiReset;return}const x=osiQ[oi];$('#osinum').textContent=oi+1;$('#osibar').style.width=(oi/osiQ.length*100)+'%';$('#osibox').innerHTML=`<h3 style="margin:18px 0">${x.q}</h3><div class="opts">${x.o.map(v=>`<button class="opt" data-osi="${v}">${v}</button>`).join('')}</div><div id="osifeed" class="msg" aria-live="polite"></div>`}
function osiReset(){oi=0;oscore=0;olock=false;osiRender()}$('#osirestart').onclick=osiReset;$('#osibox').addEventListener('click',e=>{const b=e.target.closest('[data-osi]');if(!b||olock)return;olock=true;const x=osiQ[oi];const ok=b.dataset.osi===x.a;if(ok){oscore++;b.classList.add('right');sfx('success')}else{b.classList.add('wrong');sfx('tap')}$('#osifeed').className='msg '+(ok?'ok':'no');$('#osifeed').textContent=(ok?'Benar! ':'Belum tepat. ')+x.why;setTimeout(()=>{oi++;olock=false;osiRender()},1150)});osiRender();
// GAME 5: Detektif Jaringan
const detQ=[
 {q:'Satu PC tidak bisa membuka situs, tetapi PC lain normal.',o:['Periksa kabel/Wi-Fi dan konfigurasi IP PC itu','Matikan semua switch sekolah','Ganti semua kabel di lab'],a:0,why:'Mulai dari perangkat yang bermasalah: koneksi, IP, gateway, dan DNS.'},
 {q:'PC dapat ping gateway, tetapi tidak dapat membuka nama situs.',o:['Periksa DNS','Ganti monitor','Ubah warna kabel'],a:0,why:'Jika koneksi IP jalan tetapi nama domain gagal, periksa DNS.'},
 {q:'Lampu port switch mati dan perangkat tidak terhubung.',o:['Periksa kabel, konektor, dan port','Ubah subnet menjadi /8 langsung','Hapus browser'],a:0,why:'Lampu link mati sering menunjukkan masalah fisik atau port.'},
 {q:'Dua PC punya alamat IP yang sama.',o:['Atasi konflik IP dan tetapkan alamat unik','Tambah volume speaker','Ganti nama file'],a:0,why:'Setiap host pada jaringan yang sama harus memiliki IP yang tidak bentrok.'},
 {q:'PC berbeda subnet tidak bisa berkomunikasi.',o:['Periksa gateway dan routing','Periksa wallpaper desktop','Ganti keyboard'],a:0,why:'Komunikasi antar-subnet memerlukan gateway dan routing yang benar.'},
 {q:'Pengguna tersambung ke Wi-Fi tetapi mendapat alamat 169.254.x.x.',o:['Periksa layanan DHCP dan koneksi ke server DHCP','Ganti monitor','Ubah nama SSID saja'],a:0,why:'Alamat APIPA sering muncul ketika klien tidak memperoleh lease DHCP.'},
 {q:'Satu VLAN tidak dapat melewati link antar-switch.',o:['Periksa konfigurasi trunk dan VLAN yang diizinkan','Ganti alamat MAC PC','Matikan DNS'],a:0,why:'Trunk perlu membawa VLAN yang digunakan oleh kedua sisi.'},
 {q:'Koneksi melambat saat banyak perangkat memakai Wi-Fi 2.4 GHz.',o:['Periksa interferensi, kanal, dan kepadatan klien','Ubah semua IP menjadi publik','Nonaktifkan DHCP'],a:0,why:'Pita 2.4 GHz mudah mengalami interferensi dan kepadatan kanal.'},
 {q:'Perangkat menyala, tetapi satu port switch terus menunjukkan banyak error.',o:['Periksa kabel, konektor, dan negosiasi port','Ubah password pengguna','Hapus cache DNS saja'],a:0,why:'Error fisik pada port mengarahkan pemeriksaan awal ke kabel dan konektor.'}
];let di=0,dscore=0,dlock=false;
function detRender(){if(di>=detQ.length){$('#detbox').innerHTML=`<div class="msg ${dscore>=4?'ok':'no'}"><h3>Kasus selesai: ${dscore}/${detQ.length}</h3><p>${dscore>=4?'Detektif hebat! Kamu memilih langkah diagnosis yang tepat.':'Coba ulangi. Diagnosis jaringan harus dilakukan secara bertahap.'}</p><button class="btn p" id="detagain">Mulai lagi</button></div>`;if(dscore>=4){boom();gain('g-detect',30)}$('#detagain').onclick=detReset;return}const x=detQ[di];$('#detnum').textContent=di+1;$('#detbox').innerHTML=`<div class="glass card" style="margin-top:16px"><div class="feature-icon"><svg class="i"><use href="#i-wrench"/></svg></div><h3>${x.q}</h3><div class="opts">${x.o.map((v,i)=>`<button class="opt" data-det="${i}">${v}</button>`).join('')}</div><div id="detfeed" class="msg"></div></div>`}
function detReset(){di=0;dscore=0;dlock=false;detRender()}$('#detrestart').onclick=detReset;$('#detbox').addEventListener('click',e=>{const b=e.target.closest('[data-det]');if(!b||dlock)return;dlock=true;const x=detQ[di],ok=+b.dataset.det===x.a;if(ok){dscore++;b.classList.add('right');sfx('success')}else{b.classList.add('wrong');sfx('tap')}$('#detfeed').className='msg '+(ok?'ok':'no');$('#detfeed').textContent=(ok?'Tepat! ':'Belum tepat. ')+x.why;setTimeout(()=>{di++;dlock=false;detRender()},1400)});detRender();
// GAME 6: Rute Paket
const routeSteps=[{q:'Langkah pertama: perangkat apa yang menghubungkan PC ke jaringan lokal?',o:['Switch','Printer','Speaker'],a:'Switch',why:'Switch menghubungkan perangkat dalam LAN.'},{q:'Server berada di jaringan berbeda. Perangkat apa yang memilih jalur antarjaringan?',o:['Router','Mouse','Accessori monitor'],a:'Router',why:'Router meneruskan paket antarjaringan berdasarkan alamat IP.'},{q:'Sebelum paket sampai, apa yang perlu dipastikan pada PC?',o:['IP tujuan dan gateway benar','Wallpaper sama','Volume maksimal'],a:'IP tujuan dan gateway benar',why:'Alamat tujuan dan default gateway yang tepat membantu paket menemukan jalurnya.'}];let ri=0,rlock=false;
function routeRender(){if(ri>=routeSteps.length){$('#rstep').textContent='3';$('#routebox').innerHTML='<div class="msg ok"><h3>Paket berhasil sampai!</h3><p>Kamu menyelesaikan rute PC → Switch → Router → Server.</p><button class="btn p" id="routeagain">Kirim paket lagi</button></div>';boom();gain('g-route',35);$('#routeagain').onclick=routeReset;return}$('#rstep').textContent=ri;const x=routeSteps[ri];$('#routebox').innerHTML=`<h3 style="margin:18px 0">${x.q}</h3><div class="opts">${x.o.map(v=>`<button class="opt" data-route="${v}">${v}</button>`).join('')}</div><div id="routefeed" class="msg"></div>`}
function routeReset(){ri=0;rlock=false;routeRender()}$('#routerestart').onclick=routeReset;$('#routebox').addEventListener('click',e=>{const b=e.target.closest('[data-route]');if(!b||rlock)return;rlock=true;const x=routeSteps[ri],ok=b.dataset.route===x.a;if(ok){b.classList.add('right');sfx('success')}else{b.classList.add('wrong');sfx('tap')}$('#routefeed').className='msg '+(ok?'ok':'no');$('#routefeed').textContent=(ok?'Benar! ':'Coba lagi. ')+x.why;if(ok)setTimeout(()=>{ri++;rlock=false;routeRender()},1050);else setTimeout(()=>{b.classList.remove('wrong');rlock=false},850)});routeRender();


// ===== Premium interactive experiences =====
const premiumMissions=[
 {title:'Lab kehilangan koneksi',label:'INCIDENT 01 / PHYSICAL LAYER',story:'Beberapa komputer di lab tidak dapat terhubung. Lampu indikator pada salah satu port switch mati setelah meja dipindahkan.',question:'Apa pemeriksaan pertama yang paling tepat?',choices:['Periksa kabel, konektor, dan port switch','Ubah semua alamat IP menjadi statis','Ganti DNS seluruh lab'],correct:0,explain:'Mulai dari Layer 1: pastikan kabel dan konektor terpasang baik, lalu uji port. Jangan mengubah konfigurasi IP sebelum bukti fisik diperiksa.'},
 {title:'IP bertabrakan',label:'INCIDENT 02 / ADDRESSING',story:'Dua komputer kadang kehilangan koneksi dan sistem menampilkan peringatan konflik alamat IP.',question:'Apa tindakan yang paling tepat?',choices:['Tetapkan alamat unik dan periksa cakupan DHCP','Ganti kabel HDMI','Matikan semua firewall tanpa pemeriksaan'],correct:0,explain:'Konflik terjadi ketika dua perangkat memakai alamat IP yang sama. Periksa konfigurasi DHCP/reservasi dan pastikan setiap host memperoleh alamat unik.'},
 {title:'Internet tanpa nama',label:'INCIDENT 03 / DNS',story:'Pengguna dapat melakukan ping ke alamat IP publik, tetapi nama domain tidak bisa dibuka.',question:'Komponen apa yang paling relevan untuk diperiksa?',choices:['DNS resolver dan konfigurasi DNS klien','Ukuran monitor','Nomor VLAN printer saja'],correct:0,explain:'Jika konektivitas IP berhasil tetapi nama domain gagal diterjemahkan, periksa alamat DNS, keterjangkauan resolver, dan respons query.'},
 {title:'Jaringan beda subnet',label:'INCIDENT 04 / ROUTING',story:'Komputer dapat berkomunikasi dengan perangkat satu subnet, tetapi tidak dapat mencapai server di subnet lain.',question:'Apa yang perlu diverifikasi lebih dulu?',choices:['Default gateway, routing, dan rute balik','Kecepatan refresh monitor','Nama folder pada komputer'],correct:0,explain:'Komunikasi antar-subnet memerlukan gateway Layer 3 serta rute yang sesuai di kedua arah. Verifikasi IP, mask, gateway, dan routing.'}
];
let missionIndex=0,missionDone={};
try{missionDone=JSON.parse(localStorage.getItem('nq_story_done')||'{}')||{}}catch(e){}
function renderMission(){const m=premiumMissions[missionIndex];const map=$('#missionMap');if(!map)return;$$('#missionMap [data-mission]').forEach(b=>{b.classList.toggle('active',+b.dataset.mission===missionIndex);const n=b.querySelector('.node-num');if(n)n.textContent=missionDone[missionIndex]?'✓':String(+b.dataset.mission+1).padStart(2,'0')});$('#missionPanel').innerHTML=`<div class="section-kicker">${m.label}</div><h2 style="font-size:clamp(23px,3vw,32px)">${m.title}</h2><p style="margin-top:10px">${m.story}</p><div class="msg" style="margin-top:16px"><b>Ticket / Gejala</b><br>${m.question}</div><div id="missionChoices" style="margin-top:12px">${m.choices.map((c,i)=>`<button class="mission-choice" data-mchoice="${i}">${String.fromCharCode(65+i)}. ${c}</button>`).join('')}</div><div id="missionFeedback" aria-live="polite"></div><div class="row"><button class="btn" id="missionPrev" ${missionIndex===0?'disabled':''}>← Sebelumnya</button><button class="btn p" id="missionNext">${missionIndex===3?'Kembali ke misi pertama':'Misi berikutnya →'}</button></div>`;$('#missionPrev').onclick=()=>{missionIndex=Math.max(0,missionIndex-1);renderMission()};$('#missionNext').onclick=()=>{missionIndex=missionIndex===3?0:missionIndex+1;renderMission()}}
$('#missionMap')?.addEventListener('click',e=>{const b=e.target.closest('[data-mission]');if(!b)return;missionIndex=+b.dataset.mission;renderMission()});
$('#missionPanel')?.addEventListener('click',e=>{const b=e.target.closest('[data-mchoice]');if(!b||b.disabled)return;const m=premiumMissions[missionIndex],ok=+b.dataset.mchoice===m.correct;$$('#missionChoices [data-mchoice]').forEach(x=>{x.disabled=true;if(+x.dataset.mchoice===m.correct)x.classList.add('correct')});if(!ok)b.classList.add('incorrect');$('#missionFeedback').innerHTML=`<div class="msg ${ok?'ok':'no'}"><b>${ok?'Keputusan tepat.':'Belum tepat.'}</b><br>${m.explain}</div>`;sfx(ok?'success':'tap');if(ok&&!missionDone[missionIndex]){missionDone[missionIndex]=1;try{localStorage.setItem('nq_story_done',JSON.stringify(missionDone))}catch(e){}gain('story_'+missionIndex,20);refreshPremiumUI()} });
renderMission();

// Virtual lab topology: interactive source/target selection and simulated packet test.
const labNodes={pc1:{name:'PC Siswa',ip:'192.168.10.10',net:'10',type:'host'},pc2:{name:'PC Guru',ip:'192.168.10.20',net:'10',type:'host'},switch:{name:'Switch',ip:'Layer 2',net:'lan',type:'switch'},router:{name:'Router',ip:'192.168.10.1 / 192.168.20.1',net:'router',type:'router'},server:{name:'Server',ip:'192.168.20.10',net:'20',type:'server'}};
let labSource='pc1',labTarget='server',labPick='source';
function labRender(){if(!$('#labTopology'))return;$$('#labTopology [data-node]').forEach(n=>{n.classList.toggle('active',n.dataset.node===labSource||n.dataset.node===labTarget)});$('#labSourceValue').textContent=labNodes[labSource]?.name||'Belum dipilih';$('#labTargetValue').textContent=labNodes[labTarget]?.name||'Belum dipilih'}
$('#labSource')?.addEventListener('click',()=>{labPick='source';$('#labStatus').innerHTML='<span class="live-dot"></span><span>Pilih perangkat yang akan menjadi sumber paket.</span>'});
$('#labTarget')?.addEventListener('click',()=>{labPick='target';$('#labStatus').innerHTML='<span class="live-dot"></span><span>Pilih perangkat tujuan paket.</span>'});
$('#labTopology')?.addEventListener('click',e=>{const b=e.target.closest('[data-node]');if(!b)return;const id=b.dataset.node;if(labPick==='source'){labSource=id;if(labTarget===labSource)labTarget=id==='server'?'pc1':'server'}else{labTarget=id;if(labTarget===labSource)labSource=id==='server'?'pc1':'server'}labRender();$('#labStatus').innerHTML=`<span class="live-dot"></span><span>${labPick==='source'?'Sumber':'Tujuan'} dipilih: ${labNodes[id].name}.</span>`});
$('#labSend')?.addEventListener('click',()=>{if(labSource===labTarget){$('#labStatus').innerHTML='<span class="live-dot"></span><span>Pilih sumber dan tujuan yang berbeda.</span>';return}const a=labNodes[labSource],b=labNodes[labTarget];const same=a.net===b.net;const ok=same||labSource==='router'||labTarget==='router'||labSource==='switch'||labTarget==='switch';const hops=(a.net===b.net)?'1 (LAN)':'2 (Switch + Router)';const latency=(same?'1.2':'4.8')+' ms';$('#labHops').textContent=hops;$('#labLatency').textContent=latency;$('#labTerminal').textContent=`NEKO NETWORK CONSOLE\n$ ping ${b.ip}\nSource: ${a.name} (${a.ip})\nDestination: ${b.name} (${b.ip})\n\n${ok?'Reply from '+b.ip+': time='+latency+' TTL=64\nReply from '+b.ip+': time='+(same?'1.4':'5.1')+' ms TTL=64\n\nSimulation result: SUCCESS':'Request timed out. Check VLAN and routing.'}\n\nNote: simulated output only.`;$('#labStatus').innerHTML=`<span class="live-dot" style="background:${ok?'#48f2ba':'#ff5d7a'}"></span><span>${ok?'Ping simulasi berhasil.':'Koneksi simulasi gagal. Periksa topologi.'}</span>`;sfx(ok?'success':'tap');if(ok){gain('lab_packet',15);refreshPremiumUI()}});
labRender();

function refreshPremiumUI(){const name=(()=>{try{return localStorage.getItem('nq_demo_user')||'Teknisi Jaringan'}catch(e){return'Teknisi Jaringan'}})();const dash=$('#dashName');if(dash)dash.textContent=name.split(/[\s_-]+/)[0].slice(0,22);if($('#dashRank'))$('#dashRank').textContent=$('#rank')?.textContent||'Newbie';if($('#dashXP'))$('#dashXP').textContent=String(st?.xp||0);if($('#dashMissions'))$('#dashMissions').textContent=Object.keys(missionDone).filter(k=>missionDone[k]).length+'/4';renderCheckin()}
function localDateKey(date=new Date()){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function dateIndex(value){const parts=value.split('-').map(Number);return parts.length===3&&parts.every(Number.isFinite)?Date.UTC(parts[0],parts[1]-1,parts[2])/86400000:NaN}
const checkinRewards=[10,20,30,40,50,60,100];
function checkinStorageGet(key,fallback){try{return localStorage.getItem(key)||fallback}catch(error){console.warn('Penyimpanan check-in tidak tersedia.',error);return fallback}}
function checkinStorageSet(key,value){try{localStorage.setItem(key,value)}catch(error){console.warn('Check-in tidak dapat disimpan pada perangkat ini.',error)}}
function checkinSnapshot(){
 const user=checkinStorageGet('nq_demo_user','Teknisi Jaringan').trim()||'Teknisi Jaringan',userKey=user.toLocaleLowerCase('id'),today=localDateKey();
 let records={};try{records=JSON.parse(checkinStorageGet('nq_checkin','{}'))||{}}catch(error){console.warn('Data check-in lokal tidak valid; mulai dengan streak baru.',error)}
 const record=records[userKey]&&typeof records[userKey]==='object'?records[userKey]:{streak:0,lastDate:''};
 const gap=record.lastDate?dateIndex(today)-dateIndex(record.lastDate):NaN;
 const claimedToday=record.lastDate===today;
 const previousStreak=Number.isInteger(record.streak)?Math.min(7,Math.max(0,record.streak)):0;
 const currentStreak=claimedToday?previousStreak:gap===1&&previousStreak<7?previousStreak:0;
 const nextDay=claimedToday?previousStreak:(gap===1&&previousStreak<7?previousStreak+1:1);
 return{records,userKey,today,claimedToday,currentStreak,nextDay};
}
function renderCheckin(){
 const progress=$('#checkinProgress'),days=$('#checkinDays'),button=$('#claimCheckin'),status=$('#checkinStatus');if(!progress||!days||!button||!status)return;
 const info=checkinSnapshot(),shown=info.currentStreak;
 progress.textContent=`${shown}/7 hari`;
 days.innerHTML=checkinRewards.map((reward,index)=>`<div class="checkin-day${index<shown?' complete':''}${!info.claimedToday&&index===info.nextDay-1?' next':''}"><span>Hari ${index+1}</span><b>+${reward} XP</b></div>`).join('');
 button.disabled=info.claimedToday;
 button.textContent=info.claimedToday?'Sudah check-in hari ini':`Klaim +${checkinRewards[info.nextDay-1]} XP`;
 status.textContent=info.claimedToday?'Check-in hari ini sudah diklaim. Kembali besok untuk melanjutkan streak.':`Hari ke-${info.nextDay} dari 7 • Hadiah hari ini +${checkinRewards[info.nextDay-1]} XP`;
}
$('#claimCheckin')?.addEventListener('click',()=>{
 const info=checkinSnapshot();if(info.claimedToday){renderCheckin();return}
 const day=info.nextDay,reward=checkinRewards[day-1];
 info.records[info.userKey]={streak:day,lastDate:info.today};
 checkinStorageSet('nq_checkin',JSON.stringify(info.records));
 gain(`checkin_${info.userKey}_${info.today}`,reward);
 renderCheckin();refreshPremiumUI();sfx('success');
});
window.addEventListener('storage',event=>{
 if(event.key==='nq'&&event.newValue){
  try{const incoming=JSON.parse(event.newValue);if(incoming&&Number.isFinite(incoming.xp)){st={xp:incoming.xp,got:incoming.got&&typeof incoming.got==='object'?incoming.got:{}};draw();return}}catch(error){console.warn('Tidak dapat menyinkronkan XP dari tab lain.',error)}
 }
 if(event.key===ACCOUNT_SESSION_KEY){
  activeAccount=storedSession();updateSession();
  if(activeAccount){document.body.classList.add('unlocked');document.body.style.overflowX='hidden';$('#authGate').style.display='none';go('home')}
  else{document.body.classList.remove('unlocked');document.body.style.overflow='hidden';$('#authGate').style.display='grid'}
  refreshPremiumUI();return;
 }
 if(event.key==='nq_checkin')refreshPremiumUI();
 if(event.key==='nq_demo_user'){updateSession();refreshPremiumUI()}
});
window.premiumReady=true;refreshPremiumUI();
})();

;


(()=>{
const root=document.documentElement;
const $=s=>document.querySelector(s);
const safeGet=(k,d)=>{try{return localStorage.getItem(k)||d}catch(e){return d}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const englishText={
 'Kelas Live':'Live Classroom','Beranda':'Home','Tentang Web':'About','Materi TJKT':'TJKT Materials','Panduan':'Guide','Kontak':'Contact',
 'Media Pembelajaran Interaktif • XI TJKT 2':'Interactive Learning • Grade XI TJKT 2',
 'Belajar jaringan,':'Learn networking,','naik level.':'level up.',
 'Mulai Misi 1':'Start Mission 1','Langsung ke kuis':'Go to Quiz','Lanjutkan misi':'Continue Mission',
 'Siap,':'Ready,','Teknisi Jaringan':'Network Technician','Lanjutkan misi, uji kemampuan, dan bangun skill jaringanmu satu tantangan dalam satu waktu.':'Continue your mission, test your skills, and build your networking skills one challenge at a time.',
 'Pusat belajar':'Learning Hub','Materi Dasar TJKT':'TJKT Fundamentals',
 'Pilih materi untuk membaca ringkasan dan lanjutkan dengan simulasi di Neko.':'Choose a lesson to read a summary, then continue with a Neko simulation.',
 'Mulai dari mana saja.':'Start anywhere.','Pilih pengalaman belajar yang sesuai dengan tantanganmu.':'Choose a learning activity that suits your challenge.',
 'Pengaturan Tampilan':'Display Settings','Tema warna':'Color theme','Mode tampilan':'Display mode','Gelap':'Dark','Terang':'Light','Merah':'Red','Hutan':'Forest',
 'Maskot kucing':'Cat mascot','Gaya Miki / Miko':'Miki / Miko style','Ukuran kucing':'Cat size','Transparansi maskot':'Mascot opacity',
 'Pengalaman':'Experience','Bahasa antarmuka':'Interface language','Animasi':'Animations','Notifikasi browser':'Browser notifications',
 'Musik belajar':'Study music','Volume musik lembut':'Background music volume','Versi aplikasi':'App version','Pasang aplikasi':'Install app',
 'Jelaskan ulang cara memakai aplikasi':'Replay the app tour',
 'Pilih tema warna':'Choose a color theme','Pilih mode tampilan':'Choose display mode','Pengaturan':'Settings','Tutup pengaturan':'Close settings',
 'Cari materi, halaman, atau tampilan':'Search lessons, pages, or appearance',
 'Cari materi, misalnya VLAN atau subnet':'Search lessons, e.g. VLAN or subnet',
 'Cari materi, permainan, halaman, atau tema warna.':'Search lessons, games, pages, or color themes.',
 'Ngobrol dengan Miki':'Chat with Miki','Percakapan dengan Miki':'Chat with Miki','Pesan untuk Miki':'Message for Miki',
 'Tanya Miki tentang pelajaran...':'Ask Miki about a lesson...','Kirim':'Send','Kirim pesan':'Send message',
 'Teman belajar • tanpa database':'Learning companion • offline','Jawaban belajar memakai materi lokal; chat tidak disimpan. Mikrofon bergantung dukungan browser dan izinmu.':'Answers use built-in learning materials. Chat is not saved.',
 'Tanya apa saja tentang pelajaran TJKT. Kamu juga bisa mencari materi lewat kolom di atas.':'Ask me anything about TJKT. You can also search for lessons above.',
 'Selamat datang.':'Welcome.','Akses pembelajaran':'Learning access','Masukkan nama saja untuk memulai pengalaman Neko.':'Enter your name to start using Neko.',
 'Masukkan nama saja untuk melanjutkan pengalaman belajar.':'Enter your name to continue learning.',
 'Nama pengguna':'Username','Mulai belajar':'Start learning','Panduan Game & Aplikasi':'Game & App Guide',
 'Panduan Arena Game':'Game Arena Guide','Panduan Penggunaan APK / Web App':'APK / Web App Guide',
 'Tips belajar TJKT':'TJKT study tips','Semua misi':'All missions','Pilih misi untuk memulai':'Choose a mission to begin',
 'Kembali':'Back','Lewati':'Skip','Selanjutnya':'Next','Tutup percakapan':'Close conversation',
 'Pilihan ini tersimpan di browser perangkat ini. Notifikasi perlu izin browser dan hanya tersedia pada situs HTTPS atau localhost.':'Your choices are saved in this browser. Notifications require permission and are available on HTTPS or localhost.',
 'Panduan penggunaan untuk siswa, guru, dan angkatan berikutnya.':'Instructions for students, teachers, and future classes.',
 'Masuk / Login':'Sign in','Keluar':'Leave','Mulai':'Start','Batal':'Cancel','Simpan':'Save','Hapus':'Delete',
 'Periksa':'Check','Coba lagi':'Try again','Jawab':'Answer','Lanjut':'Continue','Selesai':'Done',
 'Sumber':'Source','Tujuan':'Destination','Pilih sumber':'Choose source','Pilih tujuan':'Choose destination',
 'Jalankan ping →':'Run ping →','Pilih perangkat sumber dan tujuan untuk memulai uji koneksi.':'Choose source and destination devices to start the connection test.',
 'Hasil pemeriksaan':'Inspection results','Topologi jaringan':'Network topology','Pusat bantuan Neko':'Neko Help Center',
 'Misi 4: Kuis kilat':'Mission 4: Quick quiz','Satu soal per layar. Jawaban benar berturut-turut memberi bonus.':'One question per screen. Consecutive correct answers earn a bonus.',
 'Kelas Live':'Live Classroom','Belajar bersama • room sementara tanpa database':'Learn together • temporary room, no database',
 'Guru membuat room dan membagikan ID kepada siswa. Jawaban, skor, dan reaksi disinkronkan melalui server selama sesi berlangsung.':'Teachers create a room and share its ID with students. Answers, scores, and reactions sync through the server during the session.',
 'Gaya Miki / Miko':'Miki / Miko style','Miki • cewek':'Miki • girl','Miko • cowok':'Miko • boy',
 'Mode tampilan':'Display mode','Gradient':'Gradient','On':'On','Off':'Off',
 'Notifikasi mati. Izin browser hanya diminta setelah kamu menekan tombol ini.':'Notifications are off. Browser permission is requested only when you press this button.',
 'Tutup':'Close','Sembunyikan Miki':'Hide Miki','Ngobrol dengan Miki, kucing teman belajar':'Chat with Miki, your learning companion cat',
 'Jaringan itu':'Networking is','seru.':'fun.','naik level.':'level up.',
 'Masuk ke ruang belajar interaktif Kelompok 1. Jelajahi simulasi jaringan, tantangan subnetting, diagnosis gangguan, dan arena game dalam satu pengalaman.':'Join Group 1’s interactive learning space. Explore network simulations, subnetting challenges, troubleshooting, and games in one place.',
 'Menyiapkan ruang belajar…':'Preparing the learning space…',
 'Akun disimpan di perangkat ini. Login tidak memerlukan internet.':'Accounts are stored on this device. Sign-in works offline.',
 'Username harus unik. PIN berupa 6–12 angka.':'Usernames must be unique. PINs use 6–12 digits.',
 'Akun Neko':'Neko Account','Masuk atau daftar':'Sign in or create an account','Nama tampilan':'Display name','PIN (6–12 angka)':'PIN (6–12 digits)','Buat akun':'Create account',
 'Masuk':'Sign in','Username 3–24 karakter: huruf, angka, titik, garis, atau garis bawah.':'Username must be 3–24 characters: letters, numbers, dots, hyphens, or underscores.',
 'PIN harus terdiri dari 6–12 angka.':'PIN must contain 6–12 digits.','Nama tampilan minimal 2 karakter.':'Display name must be at least 2 characters.',
 'Username sudah digunakan. Pilih username lain.':'That username is already taken. Choose another.',
 'Username atau PIN tidak cocok.':'Username or PIN is incorrect.',
 'Penyimpanan PIN aman tidak tersedia. Buka Neko melalui HTTPS atau aplikasi.':'Secure PIN storage is unavailable. Open Neko over HTTPS or in the app.',
 'Data akun lokal tidak dapat dibaca. Coba muat ulang aplikasi.':'Local account data could not be read. Reload the app and try again.',
 'Akun tidak dapat disimpan di perangkat ini. Periksa ruang penyimpanan browser.':'The account could not be saved on this device. Check browser storage.',
 'Sesi tidak dapat disimpan. Izinkan penyimpanan lokal lalu coba lagi.':'The session could not be saved. Allow local storage and try again.',
 'Progres belajar personal':'Personal learning progress','MISI SELESAI':'MISSIONS COMPLETED','misi utama':'main missions',
 'Klaim XP gratis setiap hari. Jaga streak untuk mendapat hadiah terbesar pada hari ke-7.':'Claim free XP every day. Keep your streak going for the biggest reward on day 7.',
 'Hari ke-1 dari 7 • Hadiah hari ini +10 XP':'Day 1 of 7 • Today’s reward: +10 XP',
 'Jadilah teknisi jaringan sekolah. Analisis tiket, temukan akar masalah, dan buktikan solusi lewat simulasi.':'Become a school network technician. Analyze tickets, find root causes, and prove your solutions in simulations.',
 'Uji koneksi antarperangkat, kirim paket simulasi, dan pahami alur komunikasi jaringan.':'Test connections between devices, send simulated packets, and learn how network communication works.',
 'Pelajari jaringan, Cisco, desain visual, pemrograman web, dan keterampilan TJKT lainnya.':'Explore networking, Cisco, visual design, web development, and other TJKT skills.',
 'Selesai':'Completed','Misi 1: VLAN':'Mission 1: VLAN','Pisahkan jaringan guru, siswa, dan server.':'Separate the teacher, student, and server networks.',
 'Misi 2: Subnet':'Mission 2: Subnetting','Bagi alamat IP menjadi blok yang pas.':'Divide IP addresses into suitable blocks.',
 'Misi 3: Diagnosa':'Mission 3: Troubleshooting','Cari akar masalah dari bukti, bukan tebakan.':'Find the root cause from evidence, not guesses.',
 'Misi 4: Kuis':'Mission 4: Quiz','35 soal cepat untuk menguji pemahaman jaringan.':'35 quick questions to test your networking knowledge.',
 'Sembilan game interaktif: kabel, kartu port, subnet, OSI, diagnosis, rute paket, port, Wi-Fi, dan Spy.':'Nine interactive games: cables, port cards, subnetting, OSI, troubleshooting, packet routing, ports, Wi-Fi, and Spy.',
 'Neko adalah media pembelajaran interaktif yang dirancang untuk membantu siswa memahami dasar jaringan komputer lewat penjelasan, simulasi, kuis, dan permainan edukatif.':'Neko is an interactive learning app that helps students understand computer networking through explanations, simulations, quizzes, and educational games.',
 'Kontak Guru Pembimbing':'Contact the Teacher','Pelajari konsep, coba simulasi, lalu evaluasi pemahaman melalui kuis dan permainan.':'Learn the concepts, try a simulation, then check your understanding with quizzes and games.',
 'Membuat pembelajaran TJKT lebih menarik, mudah dipahami, dan mendekati praktik nyata.':'Making TJKT learning more engaging, easier to understand, and closer to real-world practice.',
 'Simulasi VLAN, kalkulator subnet, diagnosis gangguan, kuis, arena permainan, serta materi dasar jaringan.':'VLAN simulations, a subnet calculator, troubleshooting, quizzes, games, and networking fundamentals.',
 'Siswa Teknik Jaringan Komputer dan Telekomunikasi yang ingin mengasah keterampilan jaringan.':'Computer and Telecommunications Network Engineering students who want to build networking skills.',
 'Kelompok 1 — Ivander, Muh. Hadit Rafanizam, Muh. Fikron Ainun Najib, dan teman-teman.':'Group 1 — Ivander, Muh. Hadit Rafanizam, Muh. Fikron Ainun Najib, and teammates.',
 'Telusuri 500 materi TJKT':'Browse 500 TJKT lessons','Cari dengan kata kunci atau pertanyaan. Pencarian mencocokkan semua kata, judul, isi, dan kata kunci terkait.':'Search with keywords or a question. Results match every word in titles, content, and related keywords.',
 'Bahasa Indonesia':'Indonesian','Pilih salah satu':'Choose one','Tampilkan semua':'Show all','Menampilkan':'Showing','dari':'of',
 'Belum dipilih':'Not selected','Tidak ada hasil':'No results','Tidak ditemukan':'Not found','Memuat…':'Loading…',
 'Baca soalnya baik-baik, kamu pasti bisa.':'Read the question carefully—you can do it.',
 'Login':'Sign in','Logout':'Sign out','Nama minimal 2 karakter ya.':'Name must be at least 2 characters.',
 'Selamat belajar di Neko TJKT.':'Enjoy learning with Neko TJKT.','Berhasil masuk,':'Signed in successfully,',
 'STATUS TEKNISI':'TECHNICIAN RANK','Teknisi Pemula':'Beginner Technician','poin pengalaman':'experience points',
 'STATUS LAB':'LAB STATUS','siap disimulasikan':'Ready to simulate','Check-in 7 hari':'7-day check-in',
 'Klaim XP hari ini':'Claim today’s XP','Klaim +10 XP':'Claim +10 XP','Hari 1':'Day 1','Hari 2':'Day 2',
 'Hari 3':'Day 3','Hari 4':'Day 4','Hari 5':'Day 5','Hari 6':'Day 6','Hari 7':'Day 7',
 'Jadilah teknisi jaringan sekolah. Analisis tiket, temukan akar masalah, dan pulihkan koneksi lewat keputusanmu.':'Become a school network technician. Analyze tickets, find the root cause, and restore connectivity with your decisions.',
 'Materi':'Lessons','Story Mode':'Story Mode','Permainan':'Games','Arena Game':'Game Arena','Game':'Game',
 'Lihat semua':'View all','Mulai sekarang':'Get started','Pilih game':'Choose a game',
 'Materi jaringan':'Networking lessons','Belajar jaringan':'Learn networking','Simulasi jaringan':'Network simulation',
 'Koneksi jaringan':'Network connection','Pengalaman belajar':'Learning experience','Latihan':'Practice',
 'Baca materi':'Read lesson','Cari materi':'Search lessons','Cari':'Search','Kata kunci':'Keywords',
 'Hasil pencarian':'Search results','Tidak ada materi yang cocok.':'No matching lessons found.',
 'Status teknisi':'Technician status','Progres':'Progress','Pengalaman':'Experience','Hari':'Day',
 'Nama':'Name','Waktu':'Time','Pemain':'Players','Skor':'Score','Poin':'Points',
 'Satu soal per layar. Jawaban benar berturut-turut memberi bonus.':'One question per screen. Consecutive correct answers earn a bonus.',
 'Host beda VLAN perlu berkomunikasi. Yang dibutuhkan...':'Hosts on different VLANs need to communicate. What is required?',
 'A. Hub tambahan':'A. An additional hub','B. Perangkat Layer 3 dengan routing':'B. A Layer 3 device with routing',
 'C. Kabel lebih pendek':'C. A shorter cable','Soal':'Question','dari':'of','Streak':'Streak',
 'Benar':'Correct','Salah':'Incorrect','Coba lagi':'Try again','Jawaban benar':'Correct answer',
 'Waktu habis':'Time is up','Lanjutkan':'Continue','Kirim jawaban':'Submit answer',
 'Tema Network':'Network theme','Warna tema':'Theme color','Bahasa':'Language',
 'Aktifkan efek suara':'Enable sound effects','Matikan efek suara':'Turn off sound effects',
 'Putar musik lembut':'Play soft music','Matikan musik':'Turn off music','Ganti mode gelap atau terang':'Toggle dark or light mode',
 'Tutup pengaturan':'Close settings','Matikan animasi':'Turn off animations','Aktifkan notifikasi':'Enable notifications',
 'Atur volume':'Adjust volume','Nama pengguna':'Username','Masuk ke Neko':'Sign in to Neko',
 'Room':'Room','Buat room':'Create room','Gabung room':'Join room','ID room':'Room ID',
 'Guru':'Teacher','Siswa':'Student','Keluar':'Leave','Salin':'Copy','Bagikan':'Share',
 'Kelas Live membutuhkan server aktif.':'Live Classroom requires an active server.',
 'Periksa koneksi internetmu.':'Check your internet connection.',
 'Kamu belum memiliki materi tersimpan.':'You have no saved lessons yet.',
 'Nama pengguna':'Username','Anggota':'Members','Informasi':'Information','Tentang proyek':'About the project',
 'Identitas Proyek':'Project Identity','Developer':'Developer','Kelas':'Class','Kelompok':'Group',
 'Bantuan':'Help','Informasi aplikasi':'App information','Kebijakan privasi':'Privacy policy',
 'Cari menggunakan suara':'Search by voice','Mulai pencarian suara':'Start voice search',
 'Pencarian suara tidak tersedia di browser ini.':'Voice search is not available in this browser.',
 'Pilih materi untuk membaca ringkasan.':'Choose a lesson to read its summary.',
 'Pilih perangkat sumber dan tujuan untuk memulai uji koneksi.':'Choose source and destination devices to start the connection test.',
 'Pilih game yang ingin kamu mainkan.':'Choose a game to play.',
 'Tidak ada hasil yang cocok.':'No matching results found.',
 'Hari ke-':'Day ','XP gratis':'Free XP','Misi utama':'main missions',
 'Kamu bisa membuka bagian Misi di Neko untuk menyelesaikan kasus jaringan. Perhatikan gejala masalahnya, lalu pilih langkah pemeriksaan yang paling masuk akal. 🐱':'Open Missions in Neko to solve networking cases. Look at the symptoms and choose the most sensible troubleshooting step. 🐱',
 'Ada beberapa permainan belajar di Neko! Coba buka bagian permainan dan pilih tantangan yang ingin kamu selesaikan.':'Neko has several learning games! Open the Games section and choose a challenge to play.',
 'Aku teman belajar TJKT-mu. Yuk kenali Neko!':'I’m your TJKT learning companion. Let’s explore Neko!',
 'Pilih materi yang mau kamu pelajari, ya.':'Choose a lesson you would like to study.',
 'Ikuti panduannya pelan-pelan. Aku temani!':'Follow the guide one step at a time. I’m here to help!',
 'Petualangan jaringan dimulai!':'Your networking adventure begins!',
 'Ayo kirim paket dan lihat jalurnya.':'Send a packet and see where it goes.',
 'Pilih tantangan game, aku siap ikut!':'Choose a game challenge—I’m ready!',
 'Baca soalnya baik-baik, kamu pasti bisa.':'Read the question carefully—you can do it.',
 'Satu misi kecil lagi menuju makin jago!':'One more small mission to level up!',
 'Kumpulkan bukti belajarmu untuk membuka sertifikat.':'Collect learning achievements to unlock certificates.',
 'Buat room kelas atau gabung dengan ID yang diberikan guru.':'Create a classroom or join using the ID from your teacher.',
 'Ayo hubungkan perangkat lewat switch!':'Let’s connect the devices through the switch!',
 'Kita hitung subnet bersama.':'Let’s calculate the subnet together.',
 'Periksa gejalanya, lalu cari penyebabnya.':'Check the symptoms and find the cause.',
 'Ups, warna kabelnya belum pas. Coba lihat urutan T568B, ya.':'Oops, the cable colors are not quite right. Check the T568B order.',
 'Yeay! Kabelmu tersusun rapi, teknisi hebat!':'Great job! Your cable is assembled correctly, technician!',
 'Empat pin beres! Lanjutkan urutannya.':'Four pins done! Keep going.',
 'Hai! Aku Miki 🐱 Tanya apa saja tentang pelajaran TJKT. Kamu juga bisa mencari materi lewat kolom di atas.':'Hi! I’m Miki 🐱 Ask me about TJKT lessons or use the search above.',
 'Hai! Aku Miko 🐱 Tanya apa saja tentang pelajaran TJKT. Kamu juga bisa mencari materi lewat kolom di atas.':'Hi! I’m Miko 🐱 Ask me about TJKT lessons or use the search above.',
 'poin pengalaman':'experience points','Total XP':'Total XP','Progres belajar personal':'Personal learning progress',
 'Klaim XP gratis setiap hari. Jaga streak untuk mendapat hadiah terbesar pada hari ke-7.':'Claim free XP every day. Keep your streak going for the biggest reward on day 7.',
 'Level teknisi':'Technician level','Simulasi selesai':'Simulation complete','Paket terkirim':'Packet delivered',
 'Jaringan siap':'Network ready','Pilih salah satu tantangan.':'Choose a challenge.',
 'Belum ada materi.':'No lessons yet.','Lihat materi':'View lessons','Daftar materi':'Lesson list',
 'Misi jaringan':'Networking mission','Kuis cepat':'Quick quiz','Masuk ke Neko →':'Enter Neko →',
 'Pilih perangkat sumber, lalu perangkat tujuan.':'Choose a source device, then a destination device.',
 'Kirim paket':'Send packet','Konsep singkat':'Quick concept','Tantangan:':'Challenge:',
 'Tentukan jawaban yang benar.':'Choose the correct answer.','Mulai permainan':'Start game',
 'Diskusi':'Discussion','Acak peran & mulai':'Shuffle roles & start',
 'Petunjuk':'Hint','Petunjuk:':'Hint:','Clue':'Clue','Pemain':'Players',
 'Waktu diskusi':'Discussion time','Mulai diskusi':'Start discussion','Peranmu':'Your role',
 'Kamu adalah Spy':'You are the Spy','Kamu bukan Spy':'You are not the Spy',
 'Layar peran':'Role screen','Pilih kategori':'Choose a category','Atur timer':'Set timer',
 'Buka menu Arena Game, lalu pilih salah satu permainan.':'Open the Game Arena menu and choose a game.',
 'Pilih jawaban yang benar.':'Choose the correct answer.','Periksa jawaban':'Check answer',
 'Hasil':'Results','Main lagi':'Play again','Permainan selesai':'Game over',
 'Kembali ke game':'Back to games','Game edukatif':'Educational games',
 'Buka halaman':'Open page','Kembali ke beranda':'Back to Home',
 'Selamat datang di Neko':'Welcome to Neko','Mulai belajar di Neko':'Start learning with Neko',
 'Jaringan komputer':'Computer networking','Dasar jaringan':'Networking fundamentals',
 'Cari dengan suara':'Search by voice','Gunakan mikrofon':'Use microphone',
 'Tanya Miki':'Ask Miki','Bicara denganku':'Talk to me','Suara kucing':'Cat voice',
 'Masukkan nama':'Enter your name','Masukkan jumlah pemain':'Enter the number of players',
 'Waktu tersisa':'Time remaining','Waktu habis':'Time is up','Lanjutkan belajar':'Continue learning',
 'Paket gagal':'Packet failed','Koneksi berhasil':'Connection successful','Koneksi gagal':'Connection failed',
 'Mode gelap':'Dark mode','Mode terang':'Light mode','Aktif':'Active','Nonaktif':'Inactive',
 'Pengaturan bahasa':'Language settings','Tersimpan':'Saved','Simpan perubahan':'Save changes',
 'Tidak ada koneksi':'No connection','Mode offline':'Offline mode','Kamu sedang offline.':'You are offline.',
 'Tautan berhasil disalin.':'Link copied.','Bagikan aplikasi':'Share app',
 'IP belum dipilih':'IP not selected','Belum ada room':'No room yet', 'Ruang kelas':'Classroom','4 MISI • XP REWARD':'4 MISSIONS • XP REWARD',
 'Uji koneksi antarperangkat, kirim paket simulasi, dan pahami alur PC, switch, router, serta server.':'Test connections between devices, send simulated packets, and learn how PCs, switches, routers, and servers communicate.',
 'Pelajari jaringan, Cisco, desain visual, pemrograman web, dan keterampilan praktik dasar.':'Learn networking, Cisco, visual design, web programming, and practical skills.',
 '144 MATERI':'144 LESSONS','INTERACTIVE SIMULATION':'INTERACTIVE SIMULATION',
 'YOUR TRAINING PATH':'YOUR TRAINING PATH','PERSONAL LEARNING CONSOLE':'PERSONAL LEARNING CONSOLE',
 'Hari ke-1 dari 7 • Hadiah hari ini +10 XP':'Day 1 of 7 • Today’s reward: +10 XP',
 'Check-in hari ini sudah diklaim. Kembali besok untuk melanjutkan streak.':'You have claimed today’s check-in. Come back tomorrow to continue your streak.',
 'Sudah check-in hari ini':'Checked in today','0/7 hari':'0/7 days',
 'Hari ke-':'Day ','Materi belum ditemukan':'No lessons found',
 'Kontak Guru Pembimbing':'Contact the Teacher','Tentang proyek':'About the Project',
 'Guru Pembimbing':'Teacher','By. Kelompok 1':'By Group 1',
 'Jaringan komputer, Cisco, desain visual':'Computer networking, Cisco, visual design',
 'Diagnosa':'Troubleshooting','Kuis':'Quiz','Subnet':'Subnetting','Misi':'Mission',
 'Catatan':'Notes','Lihat':'View','Cari tahu':'Find out','Detail':'Details','Ulangi':'Try again',
 'Klaim XP':'Claim XP','Cek koneksi':'Check connection','Pilih perangkat':'Choose a device',
 'Paket data':'Data packet','Alamat IP':'IP address','Subnet mask':'Subnet mask',
 'Bagian network':'Network portion','Bagian host':'Host portion','Periksa hasil':'Check results',
 'Jawabanmu':'Your answer','Penjelasan':'Explanation','Kategori':'Category',
 'Diskusi dimulai':'Discussion started','Mulai ronde':'Start round','Akhiri ronde':'End round',
 'Tebak siapa Spy':'Guess who the Spy is','Tebak peran':'Guess the role',
 'Bermain lagi':'Play again','Permainan baru':'New game','Buat permainan':'Create game',
 'Waktu diskusi':'Discussion time','Jumlah pemain':'Number of players',
 'Tampilkan peran':'Show role','Lanjutkan ke voting':'Continue to voting',
 'Pilih pemain':'Choose a player','Lihat hasil':'View results',
 'Koneksi terputus':'Connection lost','Menghubungkan…':'Connecting…','Terhubung':'Connected',
 'Room berhasil dibuat':'Room created','Room tidak ditemukan':'Room not found',
 'Masukkan kode room':'Enter room code','Kode room':'Room code',
 'Lanjut ke beranda':'Continue to Home','Keluar dari room':'Leave room',
 'Papan peringkat':'Leaderboard','Peringkat':'Rank','Nama pemain':'Player name',
 'Poin pengalaman':'Experience points','XP berikutnya':'Next XP level',
 'Mode pemain':'Player mode','Pilih avatar':'Choose an avatar',
 'Tampilan':'Appearance','Tema':'Theme','Kecerahan':'Brightness',
 'Kembali ke menu':'Back to menu','Buka pengaturan':'Open settings',
 'Game multiplayer':'Multiplayer games','Main multiplayer':'Play multiplayer',
 'Perangkat sumber':'Source device','Perangkat tujuan':'Destination device',
 'Tes koneksi':'Connection test','Berhasil terkirim':'Successfully delivered',
 'Paket ditolak':'Packet rejected','Jaringan sama':'Same network',
 'Jaringan berbeda':'Different networks','Router aktif':'Router enabled',
 'Simpan profil':'Save profile','Profil pengguna':'User profile','pilih alat uji...':'choose a diagnostic tool...',
 '$ pilih alat uji...':'$ choose a diagnostic tool...','$ pilih alat uji...▌':'$ choose a diagnostic tool...▌',
 'Misi 1: Atur VLAN':'Mission 1: Configure VLANs',
 'Ketuk kartu perangkat secara berurutan untuk memilih sumber dan tujuan. Ketuk label VLAN untuk mengubah VLAN, lalu kirim paket.':'Select the source and destination by tapping device cards. Tap a VLAN label to change it, then send a packet.',
 'Router Layer 3':'Layer 3 router','Kirim paket':'Send packet',
 'Pilih perangkat sumber, lalu perangkat tujuan.':'Choose a source device, then a destination device.',
 'Konsep singkat':'Quick concept','Tantangan: buat PC-Siswa mengirim ke Server dan berhasil, lalu jelaskan dua cara yang bisa kamu pakai.':'Challenge: make PC-Student send a packet to the Server successfully, then explain two ways to do it.',
 'Misi 2: Subnet':'Mission 2: Subnetting','Hitung subnet yang tepat untuk kebutuhan jaringan.':'Calculate the right subnet for the network requirements.',
 'Misi 3: Diagnosa gangguan':'Mission 3: Troubleshooting',
 'Jalankan pemeriksaan untuk mengumpulkan bukti, lalu pilih akar masalah.':'Run tests to gather evidence, then identify the root cause.',
 'Tiket gangguan':'Troubleshooting ticket','PC pindah port, ping gateway gagal':'PC moved to another port; gateway ping fails',
 'Ping IP berhasil, nama domain gagal':'IP ping succeeds; domain name fails',
 'Bisa akses lokal, tidak bisa antar-subnet':'Local access works; cross-subnet access fails',
 'Setelah dipindah ke port switch lain, link menyala tetapi gateway tidak terjangkau.':'After moving to another switch port, the link is up but the gateway is unreachable.',
 'Pilih akar masalah':'Choose the root cause','Port masuk VLAN yang salah':'The port is assigned to the wrong VLAN',
 'DNS server mati':'The DNS server is down','Bandwidth penuh':'The bandwidth is saturated',
 'Alat uji':'Diagnostic tools','Cek kabel':'Check cable','Cek IP':'Check IP',
 'Cek DNS':'Check DNS','Pilih alat uji...':'Choose a diagnostic tool...',
 'Jalankan pemeriksaan':'Run diagnostics','Periksa gejala':'Inspect symptoms',
 'Hasil pemeriksaan:':'Diagnostic results:','Penyebab ditemukan':'Cause identified',
 'Misi 4: Kuis kilat':'Mission 4: Quick quiz','Soal 2 dari 35':'Question 2 of 35',
 'Router Layer 3 aktif':'Layer 3 router enabled','Router Layer 3 mati':'Layer 3 router disabled',
 'Pilih pengirim dan tujuan yang berbeda.':'Choose different source and destination devices.',
 'Paket ditolak switch.':'Packet rejected by the switch.',
 'Terkirim lewat router.':'Sent through the router.',
 'Sumber:':'Source:','Tujuan:':'Destination:','Pengirim:':'Sender:',
 'sama-sama di VLAN':'are both in VLAN','broadcast domain berbeda':'different broadcast domains',
 'Samakan VLAN atau aktifkan router Layer 3.':'Use the same VLAN or enable a Layer 3 router.',
 'Pilih jumlah host yang benar sebelum waktu habis.':'Choose the correct number of hosts before time runs out.',
 'Tentukan layer OSI yang sesuai dengan situasi yang ditampilkan.':'Choose the OSI layer that matches the displayed situation.',
 'Baca gejala dan pilih langkah diagnosis yang paling masuk akal.':'Read the symptoms and choose the most reasonable troubleshooting step.',
 'Jawab pertanyaan untuk membantu paket melewati perangkat jaringan.':'Answer questions to help the packet travel through network devices.',
 'Pilih warna kabel sesuai urutan standar T568B dari pin 1 sampai 8.':'Arrange the cable colors in the T568B standard order, from pin 1 to 8.',
 'Buka dua kartu dan cocokkan nomor port dengan layanan jaringan.':'Turn over two cards and match port numbers to network services.',
 'Tekan Mulai, lalu pilih jumlah host yang benar sebelum waktu habis.':'Press Start, then choose the correct number of hosts before time runs out.',
 'Baca gejala masalahnya, lalu pilih langkah pemeriksaan yang paling masuk akal.':'Read the symptoms, then choose the most reasonable diagnostic step.',
 'Akses ditolak':'Access denied','Paket berhasil dikirim':'Packet sent successfully',
 'Berhasil!':'Success!','Belum berhasil':'Not yet','Kabel tersusun benar':'Cable order is correct',
 'Urutan pin':'Pin order','Warna kabel':'Cable color','Jumlah host':'Number of hosts',
 'Alamat jaringan':'Network address','Alamat broadcast':'Broadcast address',
 'Alamat host pertama':'First host address','Alamat host terakhir':'Last host address',
 'Prefix subnet':'Subnet prefix','Panjang prefix':'Prefix length',
 'Hitung subnet':'Calculate subnet','Reset':'Reset','Mulai ulang':'Restart',
 'Lihat petunjuk':'Show hint','Jawaban':'Answer','Pertanyaan':'Question',
 'Pilih jawabanmu':'Choose your answer','Periksa':'Check','Benar!':'Correct!',
 'Kurang tepat':'Not quite','Alasan':'Reason','Poin XP':'XP points',
 'Misi selesai':'Mission complete','Progres misi':'Mission progress',
 'Buka misi':'Open mission','Ulangi misi':'Replay mission',
 'Menunggu perintah ping...':'Waiting for ping command...',
 'Pilih perangkat sumber dan tujuan untuk memulai uji koneksi.':'Choose source and destination devices to start the connection test.',
 'Coba ulang':'Try again','Teruskan':'Continue','Kirim paket →':'Send packet →'
};
const englishReverse=new Map(Object.entries(englishText).map(([indonesian,english])=>[english,indonesian]));
const translationSources=new WeakMap();
const normalizeTranslation=value=>String(value||'').replace(/\s+/g,' ').trim();
function translateEnglish(value){
 const source=normalizeTranslation(value);
 if(englishText[source])return englishText[source];
 let match=source.match(/^telusuri (\d+) materi tjkt$/i);if(match)return `Browse ${match[1]} TJKT lessons`;
 match=source.match(/^menampilkan (\d+) dari (\d+) materi$/i);if(match)return `Showing ${match[1]} of ${match[2]} lessons`;
 match=source.match(/^(\d+\/\d+)\s+hari$/i);if(match)return `${match[1]} days`;
 match=source.match(/^(\d+\/\d+)\s+misi$/i);if(match)return `${match[1]} missions`;
 return '';
}
function translateTextNode(node,language){
 const current=node.nodeValue;
 if(current===null||!current.trim()||node.parentElement?.closest('[data-i18n-en]'))return;
 let original=translationSources.get(node);
 const currentText=normalizeTranslation(current);
 if(!original||currentText!==normalizeTranslation(translateEnglish(original)||original)){
  original=englishReverse.get(currentText)||current;
  translationSources.set(node,original);
 }
 const translated=language==='en'?translateEnglish(original):null;
 const expected=translated||original;
 if(currentText!==normalizeTranslation(expected))node.nodeValue=expected;
}
function translateSubtree(node,language){
 if(node.nodeType===Node.TEXT_NODE){translateTextNode(node,language);return}
 if(node.nodeType!==Node.ELEMENT_NODE)return;
 const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
 while(walker.nextNode())translateTextNode(walker.currentNode,language);
}
function applyLanguage(){
  const language=safeGet('nq_language','id')==='en'?'en':'id';
  root.dataset.language=language;root.lang=language;
  document.title=language==='en'?'Neko — Interactive Network Learning Lab':'Neko — Laboratorium Jaringan Interaktif';
  document.querySelectorAll('[data-i18n-en]').forEach(element=>{
    if(element.childElementCount)return;
    if(!element.dataset.i18nId)element.dataset.i18nId=element.textContent.trim();
    element.textContent=language==='en'?element.dataset.i18nEn:element.dataset.i18nId;
  });
  translateSubtree(document.body,language);
  document.querySelectorAll('input,button,[title],[aria-label]').forEach(element=>{
    ['placeholder','title','aria-label'].forEach(attribute=>{
      if(!element.hasAttribute(attribute))return;
      const key=`i18nOriginal${attribute.replace(/(^|-)([a-z])/g,(_,dash,letter)=>letter.toUpperCase())}`;
      if(!element.dataset[key])element.dataset[key]=element.getAttribute(attribute);
      const original=element.dataset[key],translated=englishText[normalizeTranslation(original)];
      if(language==='en'&&translated)element.setAttribute(attribute,translated);
      else if(language==='id')element.setAttribute(attribute,original);
    });
  });
  const picker=$('#languagePick');if(picker)picker.value=language;
}
new MutationObserver(records=>{
 if(root.dataset.language!=='en')return;
 for(const record of records){
  if(record.type==='characterData')translateTextNode(record.target,'en');
  for(const node of record.addedNodes)translateSubtree(node,'en');
 }
}).observe(document.body,{childList:true,characterData:true,subtree:true});
function applyDesign(){
  const palettes=['default','pink','ocean','red','forest'];
  const savedPalette=safeGet('nq_palette','default');
  const palette=palettes.includes(savedPalette)?savedPalette:'default';
  const mode=safeGet('nq_mode','dark');
  const gradient=safeGet('nq_gradient','on');
  const catGender=safeGet('nq_cat_gender','girl');
  const motion=safeGet('nq_motion',window.matchMedia('(prefers-reduced-motion: reduce)').matches?'off':'on');
  const capyEnabled=safeGet('nq_capy_enabled','on');
  const capySize=Math.max(65,Math.min(145,Number(safeGet('nq_capy_size','100'))||100));
  const capyOpacity=Math.max(15,Math.min(100,Number(safeGet('nq_capy_opacity','100'))||100));
  applyLanguage();
  root.dataset.palette=palette;
  root.dataset.theme=mode;
  root.dataset.gradient=gradient;
  root.dataset.catGender=catGender;
  const mascotName=catGender==='boy'?'Miko':'Miki';
  const english=root.dataset.language==='en';
  $('#capyBuddy')?.setAttribute('aria-label',`${mascotName}, ${english?'learning companion cat':'kucing teman belajar'}`);
  $('#capyMascot')?.setAttribute('aria-label',`${english?'Chat with':'Ngobrol dengan'} ${mascotName}, ${english?'learning companion cat':'kucing teman belajar'}`);
  $('#capySpeech')?.setAttribute('aria-label',`${english?'Close':'Tutup'} ${mascotName}'s message`);
  $('#capyHeadClose')?.setAttribute('aria-label',`${english?'Hide':'Sembunyikan'} ${mascotName}`);
  $('.mascot-chat')?.setAttribute('aria-label',`${english?'Conversation with':'Percakapan dengan'} ${mascotName}`);
  $('label[for="mascotChatInput"]')?.replaceChildren(document.createTextNode(`${english?'Message for':'Pesan untuk'} ${mascotName}`));
  $('#mascotChatInput')?.setAttribute('placeholder',`${english?'Ask':'Tanya'} ${mascotName} ${english?'about a lesson...':'tentang pelajaran...'}`);
  const chatTitle=$('#capySearchTitle');if(chatTitle)chatTitle.textContent=`${english?'Chat with':'Ngobrol dengan'} ${mascotName}`;
  root.dataset.motion=motion;
  root.classList.toggle('capy-off',capyEnabled!=='on');
  if(capyEnabled!=='on'&&$('#capySearch')){$('#capySearch').hidden=true;$('#capyBuddy')?.classList.remove('chat-open');$('#capyBuddy')?.setAttribute('aria-hidden','false')}
  root.style.setProperty('--capy-scale',String(capySize/100));
  root.style.setProperty('--capy-opacity',String(capyOpacity/100));
  const p=$('#palettePick'),m=$('#modePick'),g=$('#gradientToggle'),gs=$('#gradientState'),mt=$('#motionToggle'),ct=$('#capyEnabledToggle'),cs=$('#capySize'),csv=$('#capySizeValue'),co=$('#capyOpacity'),cov=$('#capyOpacityValue');
  if(p)p.value=palette;if(m)m.value=mode;
  document.querySelectorAll('#themePicker [data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===palette)));
  document.querySelectorAll('#modePicker [data-mode-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.modeChoice===mode)));
  if(g){g.classList.toggle('on',gradient==='on');g.setAttribute('aria-pressed',String(gradient==='on'))}
  if(gs)gs.textContent=gradient==='on'?'On':'Off';
  document.querySelectorAll('#catGenderPick [data-miko-style]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mikoStyle===catGender)));
  if(mt){mt.classList.toggle('on',motion==='on');mt.setAttribute('aria-pressed',String(motion==='on'));mt.setAttribute('aria-label',motion==='on'?'Matikan animasi':'Aktifkan animasi')}
  if(ct){ct.classList.toggle('on',capyEnabled==='on');ct.setAttribute('aria-pressed',String(capyEnabled==='on'));ct.setAttribute('aria-label',capyEnabled==='on'?'Matikan maskot kucing':'Aktifkan maskot kucing')}
  if(cs)cs.value=String(capySize);if(csv)csv.value=capySize+'%';if(co)co.value=String(capyOpacity);if(cov)cov.value=capyOpacity+'%';
}
applyDesign();
$('#designPanel')?.classList.remove('open');
$('#openDesign')?.addEventListener('click',()=>{$('#designPanel').classList.add('open');$('#designPanel').setAttribute('aria-hidden','false')});
$('#closeDesign')?.addEventListener('click',()=>{$('#designPanel').classList.remove('open');$('#designPanel').setAttribute('aria-hidden','true')});
$('#palettePick')?.addEventListener('change',e=>{safeSet('nq_palette',e.target.value);applyDesign()});
$('#themePicker')?.addEventListener('click',e=>{const button=e.target.closest('[data-theme-choice]');if(!button)return;safeSet('nq_palette',button.dataset.themeChoice);applyDesign()});
$('#modePick')?.addEventListener('change',e=>{safeSet('nq_mode',e.target.value);applyDesign()});
$('#modePicker')?.addEventListener('click',e=>{const button=e.target.closest('[data-mode-choice]');if(!button)return;safeSet('nq_mode',button.dataset.modeChoice);applyDesign()});
$('#gradientToggle')?.addEventListener('click',()=>{safeSet('nq_gradient',safeGet('nq_gradient','on')==='on'?'off':'on');applyDesign()});
$('#catGenderPick')?.addEventListener('click',e=>{const button=e.target.closest('[data-miko-style]');if(!button)return;safeSet('nq_cat_gender',button.dataset.mikoStyle);applyDesign()});
$('#motionToggle')?.addEventListener('click',()=>{safeSet('nq_motion',safeGet('nq_motion',root.dataset.motion||'on')==='on'?'off':'on');applyDesign()});
$('#capyEnabledToggle')?.addEventListener('click',()=>{safeSet('nq_capy_enabled',safeGet('nq_capy_enabled','on')==='on'?'off':'on');applyDesign()});
$('#capySize')?.addEventListener('input',e=>{const size=Math.max(65,Math.min(145,Number(e.target.value)||100));safeSet('nq_capy_size',String(size));root.style.setProperty('--capy-scale',String(size/100));$('#capySizeValue').value=size+'%'});
$('#capyOpacity')?.addEventListener('input',e=>{const opacity=Math.max(15,Math.min(100,Number(e.target.value)||100));safeSet('nq_capy_opacity',String(opacity));root.style.setProperty('--capy-opacity',String(opacity/100));$('#capyOpacityValue').value=opacity+'%'});
$('#languagePick')?.addEventListener('change',event=>{safeSet('nq_language',event.target.value==='en'?'en':'id');applyDesign();window.nqRefreshSpyLanguage?.()});
$('#theme')?.addEventListener('click',()=>{safeSet('nq_mode',safeGet('nq_mode','dark')==='dark'?'light':'dark');applyDesign()});
function refreshNotificationSetting(){
 const toggle=$('#notificationToggle'),status=$('#notificationStatus');if(!toggle||!status)return;
 const supported='Notification'in window,enabled=supported&&Notification.permission==='granted'&&safeGet('nq_notifications','off')==='on';
 toggle.classList.toggle('on',enabled);toggle.setAttribute('aria-pressed',String(enabled));toggle.setAttribute('aria-label',enabled?'Matikan notifikasi':'Aktifkan notifikasi');
 status.textContent=!supported?'Browser ini tidak mendukung notifikasi.':Notification.permission==='denied'?'Izin notifikasi ditolak. Ubah izin situs lewat pengaturan browser.':enabled?'Notifikasi saat Neko dibuka aktif.':'Notifikasi mati. Izin browser hanya diminta setelah kamu menekan tombol ini.';
}
refreshNotificationSetting();
window.nqNotifyOnOpen=()=>{
 if(!('Notification'in window)||Notification.permission!=='granted'||safeGet('nq_notifications','off')!=='on')return;
 try{new Notification('Neko siap belajar!',{body:'Pilih materi atau lanjutkan misi TJKT-mu hari ini.',icon:'./favicon.svg',tag:'netquest-open'})}
 catch(error){console.warn('Notifikasi pembuka tidak dapat ditampilkan.',error)}
};
$('#notificationToggle')?.addEventListener('click',async()=>{
 if(!('Notification'in window)){refreshNotificationSetting();return}
 if(Notification.permission==='granted'){const enabled=safeGet('nq_notifications','off')!=='on';safeSet('nq_notifications',enabled?'on':'off');refreshNotificationSetting();return}
 if(Notification.permission==='denied'){refreshNotificationSetting();return}
 try{const permission=await Notification.requestPermission();if(permission==='granted')safeSet('nq_notifications','on');else if(permission==='denied')safeSet('nq_notifications','off');refreshNotificationSetting()}
 catch(error){console.warn('Permintaan izin notifikasi gagal.',error);$('#notificationStatus').textContent='Permintaan izin notifikasi gagal. Periksa pengaturan browser.'}
});

// Build a keyword-searchable TJKT knowledge catalogue. Search indexes every paragraph and tag.
const knowledge=window.NETQUEST_MIKO_MATERIALS;;
const materialSection=$('#materials');
const materialFeatureCount=$('.premium-feature[data-v="materials"] .feature-foot span');if(materialFeatureCount)materialFeatureCount.textContent=knowledge.length+' MATERI';
if(materialSection && !$('#materialSearch')){
 const tool=document.createElement('div');tool.className='glass card';tool.innerHTML='<h3>Telusuri seluruh materi TJKT</h3><p>Cari dengan kata kunci atau pertanyaan. Pencarian mencocokkan semua kata, judul, isi, dan kata kunci terkait.</p><div class="material-tools"><input id="materialSearch" type="search" aria-label="Cari materi TJKT" placeholder="Contoh: Cisco, Canva, Figma, VS Code, kabel UTP"><div class="material-tool-actions"><button class="btn" id="materialVoiceSearch" type="button" aria-label="Cari materi dengan suara"><svg class="i" aria-hidden="true"><use href="#i-mic"/></svg> Suara</button><button class="btn p" id="clearMaterialSearch" type="button">Bersihkan</button></div></div><p id="materialVoiceStatus" class="tiny" role="status" aria-live="polite"></p><p id="materialResultCount" class="material-result-count" aria-live="polite"></p><div id="materialResults" class="material-results" aria-live="polite"></div>';
 tool.querySelector('h3').textContent='Telusuri '+knowledge.length+' materi TJKT';
 materialSection.insertBefore(tool,materialSection.children[2]||null);
}
function normalizeMaterialText(value){return value.toLocaleLowerCase('id').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function showMaterials(query=''){
 const host=$('#materialResults');if(!host)return;
 const terms=normalizeMaterialText(query).split(/\s+/).filter(Boolean);
 const found=knowledge.filter(x=>{const indexed=normalizeMaterialText(x.join(' '));return terms.every(term=>indexed.includes(term))});
 const count=$('#materialResultCount');if(count)count.textContent=`Menampilkan ${found.length} dari ${knowledge.length} materi`;
 host.innerHTML=found.length?found.map(x=>`<article class="material-entry"><h3>${x[0]}</h3><p>${x[1]}</p><span class="pill">${x[2]}</span></article>`).join(''):'<div class="msg">Belum ditemukan. Coba kata kunci yang lebih umum, misalnya Ubuntu, kabel, IP, Cisco, Canva, Figma, atau VS Code.</div>';
}
showMaterials();
$('#materialSearch')?.addEventListener('input',e=>showMaterials(e.target.value));
$('#clearMaterialSearch')?.addEventListener('click',()=>{$('#materialSearch').value='';showMaterials();$('#materialSearch').focus()});
$('#materialVoiceSearch')?.addEventListener('click',()=>{
 const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition,status=$('#materialVoiceStatus');
 if(!Recognition){if(status)status.textContent='Browser ini belum mendukung pencarian suara. Gunakan kolom teks.';return}
 try{
  const recognition=new Recognition();recognition.lang=document.documentElement.dataset.language==='en'?'en-US':'id-ID';recognition.interimResults=false;recognition.maxAlternatives=1;
  if(status)status.textContent='Mendengarkan… izinkan akses mikrofon jika diminta.';
  recognition.onresult=event=>{const query=event.results?.[0]?.[0]?.transcript;if(!query){if(status)status.textContent='Suara belum tertangkap. Coba lagi.';return}$('#materialSearch').value=query;showMaterials(query);if(status)status.textContent=`Hasil pencarian untuk: ${query}`};
  recognition.onerror=event=>{if(status)status.textContent=event.error==='not-allowed'?'Akses mikrofon ditolak. Izinkan mikrofon di pengaturan browser.':'Pencarian suara gagal. Coba lagi atau gunakan kolom teks.'};
  recognition.onend=()=>{if(status&&status.textContent.startsWith('Mendengarkan'))status.textContent='Pencarian suara selesai.'};
  recognition.start();
 }catch(error){console.warn('Pencarian suara materi gagal dimulai.',error);if(status)status.textContent='Pencarian suara gagal dimulai. Coba gunakan kolom teks.'}
});
const capy=$('#capyBuddy'),capyButton=$('#capyMascot'),speech=$('#capySpeech'),searchPanel=$('#capySearch'),searchInput=$('#capySearchInput'),searchResults=$('#capySearchResults'),chatLog=$('#mascotChatLog'),chatInput=$('#mascotChatInput');
let speechTimer=null,moodTimer=null,searchCloseTimer=null,dragState=null,suppressMascotClick=false,replyTimer=null,lastBuddyActivity=Date.now();
const mascotSvg=capyButton?.querySelector('svg'),chatAvatar=$('#capyChatAvatar');
if(mascotSvg&&chatAvatar)chatAvatar.replaceChildren(mascotSvg.cloneNode(true));
function capyName(){return document.documentElement.dataset.catGender==='boy'?'Miko':'Miki'}
function mascotWelcome(){return root.dataset.language==='en'?`Hi! I’m ${capyName()} 🐱 Ask me about TJKT lessons or use the search above.`:`Hai! Aku ${capyName()} 🐱 Tanya apa saja tentang pelajaran TJKT. Kamu juga bisa mencari materi lewat kolom di atas.`}
function setCapyMood(mood,duration=3200){
 if(!capy)return;
 const avatar=$('#capyChatAvatar');
 capy.dataset.mood=mood;if(avatar)avatar.dataset.mood=mood;
 const expressions={sad:'M86 94q5-5 10 0',gentle:'M86 94q5-5 10 0',confused:'M86 91q5 2 10-1',angry:'M85 94q6-7 12 0',scared:'M88 94a3 4 0 1 0 6 0a3 4 0 1 0-6 0',surprised:'M88 94a3 4 0 1 0 6 0a3 4 0 1 0-6 0',happy:'M84 90q7 10 14 0',dance:'M84 90q7 10 14 0',excited:'M84 90q7 10 14 0',love:'M84 90q7 10 14 0',playful:'M84 90q7 10 14 0',sleepy:'M86 94q5-3 10 0',worried:'M86 94q5-5 10 0',proud:'M84 90q7 10 14 0',bored:'M86 93q5 0 10 0'};
 const expression=expressions[mood]||'M86 91q5 5 10 0';
 [capy,avatar].forEach(host=>host?.querySelector('.capy-mouth')?.setAttribute('d',expression));
 if(moodTimer)clearTimeout(moodTimer);
 if(mood!=='idle'&&duration>0)moodTimer=setTimeout(()=>{if(capy.dataset.mood===mood)setCapyMood('idle',0)},duration)
}
function hideCapySpeech(){if(!speech)return;if(speechTimer)clearTimeout(speechTimer);speech.classList.add('is-leaving');speechTimer=window.setTimeout(()=>{speech.hidden=true;speech.classList.remove('is-leaving');speechTimer=null},180)}
function capyMessage(message,mood='happy',duration=6200){if(!speech)return;$('#capyMessage').textContent=String(message);speech.hidden=false;speech.classList.remove('is-leaving');setCapyMood(mood);requestAnimationFrame(()=>{if(capy)placeCapyOnSide(capy.getBoundingClientRect().top,false,capy.dataset.side)});if(speechTimer)clearTimeout(speechTimer);speechTimer=setTimeout(hideCapySpeech,duration)}
function appendMascotChat(role,message){if(!chatLog)return;const item=document.createElement('div');item.className='mascot-chat-message '+(role==='user'?'user':'miko');item.textContent=String(message);chatLog.append(item);while(chatLog.children.length>40)chatLog.firstElementChild.remove();chatLog.scrollTop=chatLog.scrollHeight}
function mascotReply(message){return window.NQ_MIKO_REPLY(message,knowledge)}
function sendMascotChat(message){const text=String(message||'').trim().slice(0,400);if(!text)return;if(searchPanel?.hidden)openCapySearch();appendMascotChat('user',text);if(chatInput)chatInput.value='';const reply=mascotReply(text),form=$('#mascotChatForm'),send=form?.querySelector('[type="submit"]');if(replyTimer)clearTimeout(replyTimer);chatLog?.querySelector('.mascot-typing')?.remove();const typing=document.createElement('div');typing.className='mascot-typing';typing.setAttribute('role','status');typing.setAttribute('aria-label',`${capyName()} sedang mengetik`);typing.innerHTML='<i></i><i></i><i></i>';chatLog?.append(typing);if(chatLog)chatLog.scrollTop=chatLog.scrollHeight;if(send)send.disabled=true;setCapyMood('focused',0);replyTimer=setTimeout(()=>{typing.remove();appendMascotChat('miko',reply.text);if(send)send.disabled=false;setCapyMood(reply.mood,0);capyMessage(reply.text,reply.mood,7000)},520)}
if(chatLog&&!chatLog.children.length)appendMascotChat('miko',mascotWelcome());
$('#mascotChatForm')?.addEventListener('submit',event=>{event.preventDefault();sendMascotChat(chatInput?.value)});
chatInput?.addEventListener('focus',()=>{if(!replyTimer)setCapyMood('curious',1800)});
chatInput?.addEventListener('input',()=>{if(chatInput.value.trim()&&!replyTimer)setCapyMood('focused',0)});
window.nqBuddyMood=setCapyMood;window.nqBuddySay=capyMessage;
window.nqBuddyCloseSearch=closeCapySearch;
function buddyNavigation(view){
 const responses={home:['Siap belajar lagi? Komputer kecil kita sudah menyala!','happy'],about:['Aku teman belajar TJKT-mu. Yuk kenali Neko!','curious'],materials:['Pilih materi yang mau kamu pelajari, ya.','curious'],guide:['Ikuti panduannya pelan-pelan. Aku temani!','focused'],story:['Petualangan jaringan dimulai!','excited'],lab:['Ayo kirim paket dan lihat jalurnya.','focused'],game:['Pilih tantangan game, aku siap ikut!','excited'],quiz:['Baca soalnya baik-baik, kamu pasti bisa.','focused'],missions:['Satu misi kecil lagi menuju makin jago!','happy'],certificates:['Kumpulkan bukti belajarmu untuk membuka sertifikat.','curious'],contact:['Di halaman Kontak ada informasi guru pembimbing dan anggota kelompok.','happy'],classroom:['Buat room kelas atau gabung dengan ID yang diberikan guru.','curious'],vlan:['Ayo hubungkan perangkat lewat switch!','focused'],ip:['Kita hitung subnet bersama.','focused'],fix:['Periksa gejalanya, lalu cari penyebabnya.','curious']};
 const response=responses[view];if(response)capyMessage(response[0],response[1],4700);
}
window.nqBuddyNavigate=buddyNavigation;
window.nqBuddyCable=(correct,count)=>{if(!correct){capyMessage('Ups, warna kabelnya belum pas. Coba lihat urutan T568B, ya.','sad',4200);return}if(count===8){capyMessage('Yeay! Kabelmu tersusun rapi, teknisi hebat!','dance',5200);return}if(count===4)capyMessage('Empat pin beres! Lanjutkan urutannya.','focused',3200)};
function positionCapySearch(){if(!searchPanel||searchPanel.hidden)return;const hud=$('.hud')?.getBoundingClientRect(),nav=$('.topnav')?.getBoundingClientRect(),dock=$('#dock')?.getBoundingClientRect(),safeTop=Math.max(12,hud?.bottom||0,nav?.bottom||0)+10,safeBottom=Math.min(innerHeight-12,(dock?.height?dock.top:innerHeight)-12),available=Math.max(180,safeBottom-safeTop);searchPanel.style.maxHeight=available+'px';searchPanel.style.left=capy?.dataset.side==='right'?'12px':'auto';searchPanel.style.right=capy?.dataset.side==='right'?'auto':'12px';searchPanel.style.top=Math.min(safeTop,Math.max(8,innerHeight-100))+'px';searchPanel.style.bottom='auto'}
function openCapySearch(){if(searchCloseTimer)clearTimeout(searchCloseTimer);searchPanel.hidden=false;searchPanel.classList.remove('is-leaving');searchPanel.setAttribute('aria-modal','false');capy?.classList.add('chat-open');capy?.setAttribute('aria-hidden','true');setCapyMood('curious',1600);if(chatLog&&!chatLog.children.length)appendMascotChat('miko',mascotWelcome());requestAnimationFrame(positionCapySearch);chatInput?.focus({preventScroll:true});if(!searchInput.value)renderCapySearch('')}
function closeCapySearch(){if(searchPanel.hidden)return;searchPanel.classList.add('is-leaving');if(searchCloseTimer)clearTimeout(searchCloseTimer);searchCloseTimer=window.setTimeout(()=>{searchPanel.hidden=true;searchPanel.classList.remove('is-leaving');searchCloseTimer=null;capy?.classList.remove('chat-open');capy?.setAttribute('aria-hidden','false');capyButton?.focus({preventScroll:true})},180)}
capyButton?.addEventListener('click',()=>{if(suppressMascotClick){suppressMascotClick=false;return}openCapySearch()});
capyButton?.addEventListener('pointerenter',()=>{if(!replyTimer&&capy.dataset.mood==='idle')setCapyMood('curious',1600)});
capyButton?.addEventListener('pointerleave',()=>{capy.style.setProperty('--look-x','0deg');capy.style.setProperty('--look-y','0deg')});
capyButton?.addEventListener('focus',()=>{if(capy.dataset.mood==='idle')setCapyMood('curious',1600)});
speech?.addEventListener('click',hideCapySpeech);
$('#capyHeadClose')?.addEventListener('click',event=>{event.stopPropagation();hideCapySpeech();if(!searchPanel.hidden)closeCapySearch();$('#capyEnabledToggle')?.click()});
document.addEventListener('pointerdown',()=>{lastBuddyActivity=Date.now()},{passive:true});
document.addEventListener('keydown',()=>{lastBuddyActivity=Date.now()},{passive:true});
window.setInterval(()=>{const page=document.documentElement;if(!capy||capy.dataset.mood!=='idle'||!searchPanel.hidden||page.classList.contains('capy-off')||page.dataset.activeView==='game'||page.dataset.activeView==='classroom'||Date.now()-lastBuddyActivity<22000)return;lastBuddyActivity=Date.now();const idleMoods=['playful','sleepy','curious','proud'];setCapyMood(idleMoods[Math.floor(Math.random()*idleMoods.length)],3200)},16000);
$('#closeCapySearch')?.addEventListener('click',closeCapySearch);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!searchPanel.hidden)closeCapySearch()});
document.addEventListener('click',e=>{if(!searchPanel.hidden&&!e.target.closest('#capySearch,#capyMascot'))closeCapySearch()},true);
capy?.addEventListener('pointerdown',e=>{
 if(e.target.closest('.capy-speech,.capy-head-close'))return;
 const rect=capy.getBoundingClientRect();dragState={id:e.pointerId,x:e.clientX,y:e.clientY,left:rect.left,top:rect.top,moved:false};setCapyMood('curious',0);
 capyButton.setPointerCapture?.(e.pointerId);
});
capy?.addEventListener('pointermove',e=>{
 const lookRect=capyButton.getBoundingClientRect(),lookX=Math.max(-1,Math.min(1,(e.clientX-(lookRect.left+lookRect.width/2))/(lookRect.width/2))),lookY=Math.max(-1,Math.min(1,(e.clientY-(lookRect.top+lookRect.height/2))/(lookRect.height/2)));
 capy.style.setProperty('--look-x',(-lookX*7)+'deg');capy.style.setProperty('--look-y',(lookY*5)+'deg');
 if(!dragState||dragState.id!==e.pointerId)return;
 const dx=e.clientX-dragState.x,dy=e.clientY-dragState.y;
 if(Math.abs(dx)+Math.abs(dy)>7){dragState.moved=true;capy.classList.add('dragging')}
 if(!dragState.moved)return;
 setCapyMood('excited',0); const height=capy.offsetHeight,hud=$('.hud')?.getBoundingClientRect(),nav=$('.topnav')?.getBoundingClientRect(),dock=$('#dock')?.getBoundingClientRect(),safeTop=Math.max(12,hud?.bottom||0,nav?.bottom||0)+10,safeBottom=Math.min(innerHeight-height-8,(dock?.height?dock.top:innerHeight)-height-14),maxTop=Math.max(safeTop,safeBottom),left=Math.max(8,Math.min(innerWidth-capy.offsetWidth-8,dragState.left+dx)),top=Math.max(safeTop,Math.min(maxTop,dragState.top+dy));
 capy.style.left=left+'px';capy.style.top=top+'px';capy.style.right='auto';capy.style.bottom='auto';
});
function capySafeTop(){const hud=$('.hud')?.getBoundingClientRect(),nav=$('.topnav')?.getBoundingClientRect(),bubbleHeight=speech&&!speech.hidden?speech.offsetHeight+12:0;return Math.max(12,hud?.bottom||0,nav?.bottom||0)+10+bubbleHeight}
function capySafeBottom(){const dock=$('#dock')?.getBoundingClientRect();return Math.min(innerHeight-capy.offsetHeight-8,(dock?.height?dock.top:innerHeight)-capy.offsetHeight-14)}
function placeCapyOnSide(top=capy.getBoundingClientRect().top,save=true,preferredSide=null){const leftSide=preferredSide?preferredSide==='left':capy.getBoundingClientRect().left+capy.getBoundingClientRect().width/2<innerWidth/2,left=leftSide?12:innerWidth-capy.offsetWidth-12,safeTop=capySafeTop(),safeBottom=Math.max(safeTop,capySafeBottom()),clampedTop=Math.max(safeTop,Math.min(safeBottom,top));capy.style.left=left+'px';capy.style.top=clampedTop+'px';capy.style.right='auto';capy.style.bottom='auto';capy.dataset.side=leftSide?'left':'right';if(searchPanel&&!searchPanel.hidden)positionCapySearch();if(save){try{localStorage.setItem('nq_capy_position',JSON.stringify({side:capy.dataset.side,top:clampedTop}))}catch(error){console.warn('Posisi maskot tidak dapat disimpan.',error)}}}
function endCapyDrag(e){if(!dragState||dragState.id!==e.pointerId)return;const moved=dragState.moved,top=capy.getBoundingClientRect().top;if(moved){suppressMascotClick=true;placeCapyOnSide(top);setCapyMood('happy',1500)}dragState=null;capy.classList.remove('dragging')}
capy?.addEventListener('pointerup',endCapyDrag);capy?.addEventListener('pointercancel',endCapyDrag);
function safeSearchText(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function renderCapySearch(query){
 const terms=normalizeMaterialText(query).split(/\s+/).filter(Boolean);
 if(!terms.length){searchResults.innerHTML='<p class="capy-search-hint">Cari materi, permainan, halaman, atau tema warna.</p>';return}
 let palette='default',theme='dark';try{palette=localStorage.getItem('nq_palette')||palette;theme=localStorage.getItem('nq_mode')||theme}catch(error){console.warn('Preferensi tampilan tidak dapat dibaca untuk pencarian.',error)}
 const results=[];
 const colors=[
  {label:'Tampilan biru — Ocean',aliases:'biru blue ocean laut tampilan warna theme tema',palette:'ocean'},
  {label:'Tema Pink Candy',aliases:'pink candy merah muda tema tampilan warna',palette:'pink'},
  {label:'Tema merah',aliases:'merah red tema tampilan warna',palette:'red'},
  {label:'Tema hijau hutan sejuk',aliases:'hijau green forest hutan daun pohon sejuk alam tema tampilan warna',palette:'forest'},
  {label:'Tema default gelap',aliases:'default dark gelap malam tema tampilan warna',palette:'default'},
  {label:'Mode terang',aliases:'light terang cerah tema mode tampilan',palette,mode:'light'},
  {label:'Mode gelap',aliases:'dark gelap malam tema mode tampilan',palette,mode:'dark'}
 ];
 colors.forEach(item=>{const haystack=normalizeMaterialText(item.label+' '+item.aliases);if(terms.every(t=>haystack.includes(t)))results.push({title:item.label,detail:'Ubah tampilan sekarang dan buka pengaturan tema.',kind:'theme',palette:item.palette,mode:item.mode||theme,priority:0})});
 knowledge.forEach((entry,index)=>{const title=normalizeMaterialText(entry[0]),haystack=normalizeMaterialText(entry.join(' '));if(terms.every(t=>haystack.includes(t)))results.push({title:entry[0],detail:entry[1],kind:'material',index,priority:terms.every(t=>title.includes(t))?0:terms.some(t=>title.includes(t))?1:2})});
 const navLabels=new Map([...document.querySelectorAll('.topnav [data-v]')].map(button=>[button.dataset.v,button.textContent.trim()]));
 [...document.querySelectorAll('main .view')].forEach(view=>{
  const label=navLabels.get(view.id)||view.querySelector('h1,h2,h3')?.textContent.trim()||view.id;
  const haystack=normalizeMaterialText(label+' '+view.id+' '+view.textContent);
  if(terms.every(t=>haystack.includes(t)))results.push({title:label,detail:'Buka halaman ini di Neko.',kind:'route',route:view.id,priority:terms.every(t=>normalizeMaterialText(label).includes(t))?0:1});
 });
 results.sort((a,b)=>a.priority-b.priority);
 const unique=[],seen=new Set();for(const item of results){const key=item.kind+':'+(item.index??item.route??item.palette+item.mode);if(!seen.has(key)){unique.push(item);seen.add(key)}}
 searchResults.innerHTML=unique.length?unique.slice(0,8).map(item=>`<button class="capy-result" type="button" data-capy-kind="${item.kind}" ${item.kind==='theme'?`data-capy-palette="${item.palette}" data-capy-mode="${item.mode}"`:item.kind==='material'?`data-capy-index="${item.index}"`:`data-capy-route="${safeSearchText(item.route)}"`}><strong>${safeSearchText(item.title)}</strong><small>${safeSearchText(item.detail)}</small></button>`).join(''):'<p class="capy-search-empty">Belum ketemu. Coba kata yang lebih singkat, seperti “Cisco”, “game”, “biru”, atau “kabel”.</p>';
}
searchInput?.addEventListener('input',e=>renderCapySearch(e.target.value));
searchResults?.addEventListener('click',e=>{
 const button=e.target.closest('[data-capy-kind]');if(!button)return;
 const kind=button.dataset.capyKind;searchPanel.hidden=true;
 if(kind==='theme'){
  const palette=button.dataset.capyPalette,mode=button.dataset.capyMode;
  try{localStorage.setItem('nq_palette',palette);localStorage.setItem('nq_mode',mode)}catch(error){console.warn('Preferensi tema tidak dapat disimpan.',error)}
  const palettePick=$('#palettePick'),modePick=$('#modePick');if(palettePick)palettePick.value=palette;if(modePick)modePick.value=mode;
  palettePick?.dispatchEvent(new Event('change',{bubbles:true}));modePick?.dispatchEvent(new Event('change',{bubbles:true}));
  $('#openDesign').click();capyMessage('Sip! Tema '+button.querySelector('strong').textContent+' sudah dipakai.','happy');
 }else if(kind==='material'){
  const query=knowledge[Number(button.dataset.capyIndex)]?.[0]||searchInput.value;
  const nav=document.querySelector('.topnav [data-v="materials"]');nav?.click();
  const materialInput=$('#materialSearch');if(materialInput){materialInput.value=query;showMaterials(query)}
  capyMessage('Ini materi yang kamu cari. Selamat belajar!','happy');
 }else{
  document.querySelector(`.topnav [data-v="${button.dataset.capyRoute}"]`)?.click();
  capyMessage('Halaman sudah kubukakan. Yuk lanjut jelajah!','happy');
 }
});
const mikoTourSteps=[
 {title:'Hai, aku '+capyName()+'!',text:'Aku teman belajarmu. Ketuk maskot untuk membuka chat, cari materi, atau minta bantuan.'},
 {title:'Belajar dengan cara mencoba',text:'Pilih Materi untuk membaca topik, lalu lanjutkan ke simulasi dan Arena Game agar konsepnya lebih mudah diingat.'},
 {title:'Main bersama di satu HP',text:'Who Is the Spy bisa dimainkan bergantian di satu perangkat. Kelas Live dipakai guru dan siswa melalui room online.'},
 {title:'Atur pengalamanmu',text:'Di Pengaturan kamu bisa memilih tema, gaya maskot, ukuran, suara, musik, dan animasi. Tekan X kecil di kepala maskot untuk menyembunyikannya.'}
];
let mikoTourIndex=0;
function renderMikoTour(){
 const step=mikoTourSteps[mikoTourIndex],dialog=$('#mikoTour');if(!step||!dialog)return;
 $('#mikoTourTitle').textContent=step.title;$('#mikoTourText').textContent=step.text;$('#mikoTourProgress').textContent=`LANGKAH ${mikoTourIndex+1}/${mikoTourSteps.length}`;
 $('#mikoTourBack').disabled=mikoTourIndex===0;$('#mikoTourNext').textContent=mikoTourIndex===mikoTourSteps.length-1?'Selesai':'Selanjutnya';dialog.hidden=false;
}
function closeMikoTour(completed=false){
 const dialog=$('#mikoTour');if(dialog)dialog.hidden=true;
 if(completed){try{localStorage.setItem('nq_miko_tour_done','true')}catch(error){console.warn('Status panduan tidak dapat disimpan.',error)}greetCapy()}
 else try{sessionStorage.setItem('nq_miko_tour_dismissed','true')}catch(error){console.warn('Status panduan sementara tidak dapat disimpan.',error)}
}
function openMikoTour(force=false){
 let complete=false,dismissed=false;
 try{complete=localStorage.getItem('nq_miko_tour_done')==='true';dismissed=sessionStorage.getItem('nq_miko_tour_dismissed')==='true'}catch(error){console.warn('Status panduan tidak dapat dibaca.',error)}
 if(!document.body.classList.contains('unlocked'))return;
 if(!force&&(complete||dismissed)){if(complete)greetCapy();return}
 mikoTourIndex=0;const avatar=$('#mikoTourAvatar');if(mascotSvg&&avatar)avatar.replaceChildren(mascotSvg.cloneNode(true));renderMikoTour();$('#mikoTourNext').focus({preventScroll:true});
}
window.nqStartMikoTour=()=>openMikoTour(false);
$('#mikoTourBack')?.addEventListener('click',()=>{mikoTourIndex=Math.max(0,mikoTourIndex-1);renderMikoTour()});
$('#mikoTourNext')?.addEventListener('click',()=>{if(mikoTourIndex===mikoTourSteps.length-1){closeMikoTour(true);return}mikoTourIndex++;renderMikoTour()});
$('#mikoTourSkip')?.addEventListener('click',()=>closeMikoTour(true));
$('#mikoTourStop')?.addEventListener('click',()=>closeMikoTour(false));
$('#replayMikoTour')?.addEventListener('click',()=>openMikoTour(true));
$('#mikoTour')?.addEventListener('keydown',event=>{if(event.key==='Escape')closeMikoTour(false)});
function greetCapy(){let tourComplete=false;try{tourComplete=localStorage.getItem('nq_miko_tour_done')==='true'}catch(error){console.warn('Status panduan tidak dapat dibaca.',error)}if(!tourComplete)return;let greeted=false;try{greeted=sessionStorage.getItem('nq_capy_greeted')==='true'}catch(error){console.warn('Status sapaan maskot tidak dapat dibaca.',error)}if(greeted)return;let name='Ivan';try{name=(localStorage.getItem('nq_demo_user')||'Ivan').trim().split(/[\s_-]+/)[0]||'Ivan'}catch(error){console.warn('Nama pengguna tidak dapat dibaca untuk sapaan.',error)}capyMessage(`Hai, ${name}! Aku ${capyName()}, siap menemanimu belajar.`,'happy',7600);if('Notification'in window&&Notification.permission==='default')setTimeout(()=>{if(speech.hidden)capyMessage('Aktifkan notifikasi lewat Pengaturan kalau mau mendapat pengingat.','curious',5500)},8200);try{sessionStorage.setItem('nq_capy_greeted','true')}catch(error){console.warn('Status sapaan maskot tidak dapat disimpan.',error)}}
if(document.body.classList.contains('unlocked'))setTimeout(()=>window.nqStartMikoTour?.(),900);
$('#gateForm')?.addEventListener('submit',()=>setTimeout(()=>window.nqStartMikoTour?.(),4700));
if(document.body.classList.contains('unlocked'))setTimeout(()=>window.nqNotifyOnOpen?.(),1200);
$('#gateForm')?.addEventListener('submit',()=>setTimeout(()=>window.nqNotifyOnOpen?.(),4700));
document.addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target)return;
 if(target.matches('#nqStartGame,[data-extra-start],.game-start')){capyMessage('Ayo main! Aku siap joget sambil nemenin kamu.','dance',5000);return}
 if(target.matches('.gtabs [data-g]')){const gameName=target.textContent.trim();capyMessage(`${gameName} siap! Ayo kita coba tantangannya.`,'excited',4200);return}
 if(target.matches('#nqGameStage .nq-game-answer,.nq-answer,[data-q],[data-a],[data-extra-answer]')){
  setTimeout(()=>{const feedback=$('#nqAnswerFeedback')?.textContent||$('.nq-feedback')?.textContent||'';const right=target.classList.contains('correct')||target.classList.contains('right')||feedback.includes('Tepat!')||feedback.includes('Benar');const wrong=target.classList.contains('wrong')||feedback.includes('Belum tepat')||feedback.includes('Waktu habis');if(right)capyMessage('Yeay, jawabanmu tepat! Mantap!','dance',4200);else if(wrong)capyMessage('Yah, belum tepat. Tidak apa-apa, coba lagi ya!','sad',4400)},60);
 }
 if(target.matches('#nqEndGame'))capyMessage('Makasih sudah main! Kamu keren sudah berusaha.','happy');
});
searchInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=searchResults.querySelector('[data-capy-kind]');first?.click()}});
if(capy){const saved=(()=>{try{return JSON.parse(localStorage.getItem('nq_capy_position')||'null')}catch(error){console.warn('Posisi maskot tidak dapat dibaca.',error);return null}})();const savedTop=Number.isFinite(saved?.top)?saved.top:innerHeight-capy.offsetHeight-18;const savedSide=saved?.side|| (Number.isFinite(saved?.left)&&saved.left+capy.offsetWidth/2<innerWidth/2?'left':'right');placeCapyOnSide(savedTop,false,savedSide)}
window.addEventListener('resize',()=>{if(!capy)return;placeCapyOnSide(capy.getBoundingClientRect().top,false,capy.dataset.side);if(!searchPanel.hidden)positionCapySearch()});
if(capy){const capyVisibilityObserver=new MutationObserver(()=>{if(!document.body.classList.contains('unlocked'))return;requestAnimationFrame(()=>{if(capy.offsetWidth)placeCapyOnSide(capy.getBoundingClientRect().top,false,capy.dataset.side)})});capyVisibilityObserver.observe(document.body,{attributes:true,attributeFilter:['class']})}
const contactPeople=[
 {name:'Ivander',accounts:[['Google / Gmail','Tambahkan akun Google / Gmail'],['Instagram','@vndee_r','https://www.instagram.com/vndee_r'],['TikTok','@user02_1413','https://www.tiktok.com/@user02_1413'],['ivander1420','https://github.com/ivander1420'],['ivander1412','Tambahkan akun Red Hat']]},
 {name:'Muh. Hadit Rafanizam',accounts:[['Google / Gmail','Tambahkan akun Google / Gmail'],['mhdrafanzm','@mhdrafanzm','https://www.instagram.com/mhdrafanzm'],['rfaanzmm','https://www.tiktok.com/@rfaanzmm'],['rafanizam2010','https://github.com/rafanizam2010'],['Rafa Nizam','Tambahkan akun Red Hat']]},
 {name:'Muh. Fikron Ainun Najib',accounts:[['Google / Gmail','Tambahkan akun Google / Gmail'],['Instagram','@fikronainun','https://www.instagram.com/fikronainun'],['TikTok','@fikronainun','https://www.tiktok.com/@fikronainun'],['GitHub','Tambahkan akun GitHub'],['Red Hat','Tambahkan akun Red Hat']]},
 {name:'Akhsan Jauhar Santoso',accounts:[['Google / Gmail','Tambahkan akun Google / Gmail'],['Instagram','@akhsanzzj','https://www.instagram.com/akhsanzzj'],['TikTok','@akhsanjs','https://www.tiktok.com/@akhsanjs'],['GitHub','Tambahkan akun GitHub'],['Red Hat','Tambahkan akun Red Hat']]}
];
const teacherAccounts=[['Google / Gmail','Tambahkan akun Google / Gmail'],['Instagram','Tambahkan akun Instagram'],['TikTok','Tambahkan akun TikTok'],['GitHub','Tambahkan akun GitHub'],['Red Hat','Tambahkan akun Red Hat']];
function renderSocialRows(accounts){
 return accounts.map(([platform,label,url])=>`<div class="social-row"><b>${platform}</b>${url?`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`:`<span class="muted-link">${label}</span>`}</div>`).join('');
}
function renderContactCards(people){
 return people.map(person=>`<article class="glass card contact-card"><div class="feature-icon">${person.name[0]}</div><h3>${person.name}</h3><div class="social-list">${renderSocialRows(person.accounts)}</div></article>`).join('');
}
const contactSection=$('#contact');
if(contactSection){
 const social=document.createElement('section');social.className='contact-directory';social.innerHTML='<div class="eyebrow">Kelompok 1</div><h3>Kontak Anggota</h3><p>Setiap anggota memiliki satu kartu berisi seluruh akun yang tersedia.</p><div class="contact-grid">'+renderContactCards(contactPeople)+'</div>';
 contactSection.appendChild(social);
 const bug=document.createElement('div');bug.className='glass card';bug.style.marginTop='18px';
 bug.innerHTML='<div class="feature-icon"><svg class="i"><use href="#i-wrench"/></svg></div><h3>Laporkan Bug / Masalah</h3><form class="bug-form" id="bugForm"><label for="bugEmail">Email tujuan</label><input id="bugEmail" type="email" required><label for="bugTitle">Judul laporan</label><input id="bugTitle" required maxlength="100" placeholder="Contoh: Pencarian materi tidak bekerja"><label for="bugDetail">Detail masalah</label><textarea id="bugDetail" required maxlength="3000" placeholder="Ceritakan kendala yang terjadi."></textarea><button class="btn p" type="submit">Siapkan laporan</button><div class="form-error" id="bugStatus" role="status"></div></form>';
 contactSection.appendChild(bug);
 const bugEmailInput=$('#bugEmail');if(bugEmailInput){bugEmailInput.value='ivander1420@gmail.com';bugEmailInput.readOnly=true;}
}
const socialStyle=document.createElement('style');
socialStyle.textContent='.contact-directory{margin-top:18px}.contact-directory>h3{margin-top:5px}.contact-directory>p{margin-top:5px}.contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.contact-card h3{margin-top:10px}.social-list{display:grid;gap:8px;margin-top:14px}.social-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--stroke);border-radius:14px;background:var(--glass)}.social-row a{color:var(--c1);font-weight:700;text-decoration:none;overflow-wrap:anywhere}.social-row a:hover{text-decoration:underline}.muted-link{color:var(--mut);font-size:12px;text-align:right}.bug-form input{width:100%}@media(max-width:700px){.contact-grid{grid-template-columns:1fr}}';
document.head.appendChild(socialStyle);
const teacherContact=$('#teacherContactCard');if(teacherContact)teacherContact.innerHTML='<section class="contact-directory"><div class="eyebrow">Guru Pembimbing</div><article class="glass card contact-card"><div class="teacher-card"><div class="teacher-avatar">AM</div><div><span class="pill">Guru Pembimbing</span><h3>Pak Andy Musly</h3><p>Pembimbing proyek Neko TJKT — media pembelajaran interaktif untuk siswa Teknik Jaringan Komputer dan Telekomunikasi. Guru KKJ 1.</p><div class="pills"><span class="pill">Pembelajaran TJKT</span><span class="pill">Jaringan Komputer</span><span class="pill">Proyek Kelompok</span></div></div></div><div class="social-list">'+renderSocialRows(teacherAccounts)+'</div></article></section>';
$('#bugForm')?.addEventListener('submit',e=>{
 e.preventDefault();
 const to='ivander1420@gmail.com',subject=$('#bugTitle').value.trim();
 const body='Laporan Bug Neko TJKT\n\nJudul: '+subject+'\nDetail:\n'+$('#bugDetail').value.trim()+'\n\nBrowser: '+navigator.userAgent+'\nWaktu: '+new Date().toLocaleString('id-ID');
 const url='mailto:'+to+'?subject='+encodeURIComponent('[Neko Bug] '+subject)+'&body='+encodeURIComponent(body);
 $('#bugStatus').textContent='Aplikasi email akan dibuka. Periksa penerima dan tekan Kirim untuk mengirim laporan.';
 location.href=url;
});
})();

;


(()=>{
'use strict';
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const safeRead=(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(_){return d}};
const safeWrite=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// 10 misi, masing-masing tiga soal pilihan ganda. Dua jawaban benar dari tiga diperlukan.
const missions=[
{t:'Penjelajah TJKT',tag:'Orientasi bidang',m:'TJKT mempelajari komputer, jaringan, telekomunikasi, layanan digital, dan dukungan teknis. Teknisi harus menggabungkan teori, praktik, dokumentasi, serta keselamatan kerja.',task:'Baca pengantar TJKT dan tulis tiga bidang pekerjaan yang menarik bagimu.',qs:[['Kepanjangan TJKT adalah…',['Teknik Jaringan Komputer dan Telekomunikasi','Teknologi Jasa Komputer Terpadu','Teknik Java Komputer Terapan','Teknologi Jaringan Kabel Terpadu'],0,'TJKT adalah Teknik Jaringan Komputer dan Telekomunikasi.'],['Sikap kerja teknisi yang baik adalah…',['Mengabaikan dokumentasi','Mencatat perubahan dan hasil pemeriksaan','Mencabut kabel saat perangkat aktif tanpa prosedur','Membagikan kata sandi'],1,'Dokumentasi membantu pekerjaan dapat ditelusuri dan diperiksa.'],['Sebelum praktik, hal penting yang perlu dilakukan adalah…',['Membaca instruksi dan menyiapkan keselamatan','Menebak fungsi alat','Mengabaikan risiko','Mengubah semua konfigurasi'],0,'Pahami instruksi, alat, dan risiko sebelum mulai.']]},
{t:'Anatomi Komputer',tag:'Hardware',m:'Komputer tersusun dari CPU, motherboard, RAM, penyimpanan, PSU, pendingin, serta perangkat input/output. Setiap komponen memiliki fungsi dan kompatibilitas tertentu.',task:'Identifikasi minimal lima komponen komputer di materi atau perangkat yang tersedia dan jelaskan fungsinya.',qs:[['Komponen yang mengeksekusi instruksi program adalah…',['RAM','CPU','PSU','Monitor'],1,'CPU menjalankan instruksi dan operasi pemrosesan.'],['RAM berfungsi sebagai…',['Penyimpanan sementara saat sistem bekerja','Sumber listrik utama','Pengolah grafis permanen','Kabel jaringan'],0,'RAM menyimpan data sementara yang sedang digunakan.'],['Komponen yang memasok daya ke perangkat adalah…',['SSD','Motherboard','PSU','NIC'],2,'PSU mengubah dan menyalurkan daya ke komponen.']]},
{t:'Perakitan dan Perawatan',tag:'Praktik hardware',m:'Perakitan harus mengikuti panduan pabrikan. Pastikan perangkat tidak terhubung ke listrik, gunakan prosedur antistatis, cocokkan soket, dan periksa konektor sebelum menyalakan.',task:'Susun urutan perakitan secara tertulis dan sebutkan tiga langkah keselamatan.',qs:[['Sebelum membuka casing PC, sebaiknya…',['Pastikan daya terputus','Jalankan game berat','Lepas RAM saat menyala','Siram casing'],0,'Putuskan sumber daya dan ikuti prosedur keselamatan.'],['CPU dipasang pada…',['Slot RAM','Socket CPU pada motherboard','Port HDMI','Konektor SATA daya'],1,'CPU harus cocok dengan socket motherboard.'],['Tujuan tindakan antistatis adalah…',['Mempercepat internet','Mengurangi risiko kerusakan akibat listrik statis','Menambah kapasitas RAM','Membersihkan layar'],1,'Listrik statis dapat merusak komponen elektronik.']]},
{t:'Sistem Operasi',tag:'Windows dan Linux',m:'Sistem operasi mengelola proses, memori, perangkat, akun, dan file. Pembaruan serta pemasangan aplikasi sebaiknya dilakukan dari sumber tepercaya.',task:'Bandingkan satu fungsi Windows dan Linux, lalu catat cara mematikan komputer dengan benar.',qs:[['Sistem operasi bertugas untuk…',['Mengelola sumber daya komputer','Mengubah monitor menjadi router','Menyediakan listrik rumah','Mengganti fungsi CPU'],0,'OS menjadi pengelola perangkat keras dan aplikasi.'],['Perintah Linux untuk melihat lokasi direktori aktif adalah…',['pwd','mkdir','clear','exit'],0,'pwd menampilkan working directory.'],['Sumber aplikasi yang paling aman adalah…',['Lampiran acak','Situs tidak dikenal','Repositori atau toko aplikasi tepercaya','Tautan pop-up'],2,'Gunakan sumber resmi/tepercaya dan periksa izin aplikasi.']]},
{t:'Dasar Jaringan',tag:'LAN, WAN, topologi',m:'Jaringan menghubungkan perangkat untuk bertukar data. LAN mencakup area lokal, WAN menjangkau area luas. Topologi star sering memakai switch pusat.',task:'Gambar topologi star sederhana dengan tiga PC, satu switch, dan satu router.',qs:[['LAN biasanya digunakan untuk…',['Area lokal seperti lab sekolah','Seluruh dunia tanpa perangkat penghubung','Satu aplikasi saja','Mengganti sistem operasi'],0,'LAN melayani area terbatas seperti rumah, kantor, atau laboratorium.'],['Perangkat yang menghubungkan banyak host dalam LAN adalah…',['Switch','Keyboard','Printer saja','Speaker'],0,'Switch meneruskan frame di jaringan lokal.'],['Pada topologi star, perangkat ujung terhubung ke…',['Satu titik pusat','Lingkaran tertutup saja','Kabel tanpa perangkat','Satelit wajib'],0,'Topologi star menggunakan perangkat pusat seperti switch.']]},
{t:'Kabel dan Media Transmisi',tag:'UTP dan fiber',m:'Kabel UTP membawa sinyal Ethernet melalui pasangan kabel terpilin. RJ45 umum dipakai pada Ethernet tembaga. Fiber optik mengirim data menggunakan cahaya.',task:'Pelajari urutan T568B dan jelaskan perbedaan dasar kabel tembaga dengan fiber optik.',qs:[['Konektor Ethernet tembaga yang umum adalah…',['RJ45','USB-C','HDMI','VGA'],0,'RJ45 (8P8C) umum digunakan pada kabel Ethernet.'],['Standar urutan T568B pin 1 dimulai dengan…',['Putih-oranye','Putih-hijau','Biru','Cokelat'],0,'Pin pertama T568B adalah putih-oranye.'],['Fiber optik mengirimkan data dengan…',['Cahaya','Gelombang suara','Air bertekanan','Arus mekanis'],0,'Fiber menggunakan cahaya di dalam serat optik.']]},
{t:'IP Address dan Subnet',tag:'IPv4',m:'IPv4 memiliki panjang 32 bit. Subnet mask atau prefix memisahkan bagian network dan host. Default gateway menjadi jalur menuju jaringan lain.',task:'Catat contoh alamat IP privat, subnet mask, dan default gateway untuk sebuah PC simulasi.',qs:[['Panjang alamat IPv4 adalah…',['16 bit','32 bit','64 bit','128 bit'],1,'IPv4 menggunakan 32 bit.'],['Contoh alamat privat IPv4 adalah…',['192.168.1.10','8.8.8.8','1.1.1.1','203.0.113.8'],0,'192.168.0.0/16 termasuk ruang alamat privat.'],['Default gateway digunakan untuk…',['Keluar menuju jaringan lain','Mengubah resolusi layar','Menyimpan file','Menambah RAM'],0,'Gateway mengarahkan trafik ke jaringan di luar subnet lokal.']]},
{t:'Switching dan Routing',tag:'VLAN',m:'Switch meneruskan frame dalam LAN. VLAN memisahkan broadcast domain secara logis. Router atau switch Layer 3 dapat melakukan routing antarjaringan.',task:'Buat rancangan tiga VLAN: Guru, Siswa, dan Server. Jelaskan mengapa segmentasi berguna.',qs:[['VLAN digunakan untuk…',['Segmentasi jaringan secara logis','Meningkatkan kapasitas SSD','Mengganti kabel listrik','Menyimpan kata sandi'],0,'VLAN memisahkan broadcast domain secara logis.'],['Port trunk umumnya membawa…',['Beberapa VLAN','Satu alamat MAC saja','Daya listrik utama','Sinyal monitor'],0,'Trunk membawa trafik beberapa VLAN dengan tagging.'],['Routing diperlukan untuk…',['Meneruskan paket antarjaringan','Mengubah nama file','Menyusun kabel keyboard','Mengatur kecerahan'],0,'Router meneruskan paket antar jaringan IP.']]},
{t:'Layanan dan Troubleshooting',tag:'DHCP, DNS, diagnosis',m:'DHCP memberikan konfigurasi IP secara otomatis. DNS menerjemahkan nama domain ke alamat IP. Troubleshooting dilakukan bertahap berdasarkan bukti.',task:'Buat checklist diagnosis saat komputer tidak dapat membuka situs web.',qs:[['DNS berfungsi untuk…',['Menerjemahkan nama domain ke alamat IP','Memberi daya ke switch','Membuat kabel UTP','Menyimpan video'],0,'DNS membantu menemukan alamat IP dari nama domain.'],['DHCP membantu perangkat memperoleh…',['Konfigurasi IP otomatis','Kartu grafis','Kabel fiber','Akun media sosial'],0,'DHCP dapat memberikan IP, gateway, dan DNS secara otomatis.'],['Langkah troubleshooting yang baik adalah…',['Identifikasi gejala lalu uji dari yang sederhana','Ubah semua konfigurasi sekaligus','Hapus semua file','Langsung mengganti router'],0,'Gunakan urutan sistematis dan verifikasi hasil.']]},
{t:'Proyek Akhir Teknisi',tag:'Integrasi keterampilan',m:'Gabungkan konsep perangkat, topologi, IP, layanan, keamanan, dan dokumentasi untuk merancang jaringan kecil yang sesuai kebutuhan.',task:'Buat proyek mini jaringan laboratorium: diagram, daftar perangkat, rencana IP, pengujian koneksi, dan catatan keamanan. Simpan ringkasan di menu Sertifikat.',qs:[['Dokumen proyek jaringan sebaiknya memuat…',['Topologi, IP, perangkat, dan hasil pengujian','Hanya nama pembuat','Kata sandi semua pengguna','Data pribadi yang tidak relevan'],0,'Dokumentasi teknis memuat rancangan dan bukti pengujian.'],['Setelah konfigurasi jaringan diubah, teknisi perlu…',['Memverifikasi konektivitas dan mencatat hasil','Menganggap pasti berhasil','Mematikan semua firewall tanpa alasan','Menghapus dokumentasi'],0,'Verifikasi memastikan perubahan memberi hasil yang diharapkan.'],['Prinsip keamanan yang baik adalah…',['Hak akses minimum dan kata sandi kuat','Satu kata sandi untuk semua','Membagikan kredensial','Menonaktifkan pembaruan'],0,'Batasi hak akses sesuai kebutuhan dan jaga kredensial.']]}
];
let missionState=safeRead('nq_academy_missions',{done:{},scores:{}}),activeMission=0,missionAnswers={};
let projectSaved=safeRead('nq_academy_project',{text:'',checks:[],teacherApproved:false,teacherName:''});
let projectReady=projectSaved.checks?.length===5&&String(projectSaved.text||'').trim().length>=80;
q('#nqSaveProject')?.addEventListener('click',()=>{projectReady=q('#nqProjectText').value.trim().length>=80&&qa('#nqRubric input:checked').length===5},true);
function renderMissionList(){const host=q('#nqMissionList');if(!host)return;host.innerHTML=missions.map((m,i)=>`<button class="nq-mission-item ${i===activeMission?'active':''} ${missionState.done[i]?'done':''}" data-mission="${i}"><span class="nq-mission-num">${missionState.done[i]?'✓':String(i+1).padStart(2,'0')}</span><span><b>${esc(m.t)}</b><small>${esc(m.tag)} • ${missionState.done[i]?'Selesai':'Belum selesai'}</small></span></button>`).join('');const n=Object.keys(missionState.done).filter(k=>missionState.done[k]).length;q('#nqMissionCount').textContent=n+'/10';q('#nqMissionBar').style.width=(n*10)+'%';q('#nqMissionHint').textContent=n===10?'Semua misi selesai. Sertifikat penyelesaian terbuka.':`Selesaikan ${10-n} misi lagi untuk membuka sertifikat penyelesaian.`;updateCertificateUI();}
function renderMissionList(){const host=q('#nqMissionList');if(!host)return;host.innerHTML=missions.map((m,i)=>`<button class="nq-mission-item ${i===activeMission?'active':''} ${missionState.done[i]?'done':''}" data-mission="${i}"><span class="nq-mission-num">${missionState.done[i]?'✓':String(i+1).padStart(2,'0')}</span><span><b>${esc(m.t)}</b><small>${esc(m.tag)} • ${missionState.done[i]?'Selesai':'Belum selesai'}</small></span></button>`).join('');const n=Object.keys(missionState.done).filter(k=>missionState.done[k]).length;q('#nqMissionCount').textContent=n+'/10';q('#nqMissionBar').style.width=(n*10)+'%';q('#nqMissionHint').textContent=n===10?'Semua misi selesai. Sertifikat penyelesaian terbuka.':`Selesaikan ${10-n} misi lagi untuk membuka sertifikat penyelesaian.`;updateCertificateUI();}
function openMission(i){if(!Number.isInteger(i)||i<0||i>=missions.length)return;activeMission=i;missionAnswers={};renderMissionList();const m=missions[i],host=q('#nqMissionWork');host.innerHTML=`<span class="pill">MISI ${i+1} / 10 • ${esc(m.tag)}</span><h2 class="nq-mission-title">${esc(m.t)}</h2><p class="nq-mission-intro">${esc(m.m)}</p><div class="nq-question nq-mission-activity"><b>Aktivitas praktik</b><p>${esc(m.task)}</p><label class="nq-task-check"><input type="checkbox" id="nqTaskRead"> <span>Saya sudah membaca materi dan melakukan aktivitas / mencatat hasilnya.</span></label></div><h3 class="nq-mission-quiz-title">Uji pemahaman <small>Minimal 2 dari 3 benar</small></h3><div id="nqMissionQuestions"></div><div class="nq-mission-actions"><button class="btn p" id="nqSubmitMission" type="button">Periksa jawaban</button><button class="btn" id="nqClearMission" type="button">Ulangi soal</button></div><div id="nqMissionFeedback" class="nq-feedback" role="status" aria-live="polite"></div>`;const qs=q('#nqMissionQuestions');qs.innerHTML=m.qs.map((item,j)=>`<div class="nq-question" data-mission-question="${j}"><b class="nq-question-title">${j+1}. ${esc(item[0])}</b><div class="nq-mission-options">${item[1].map((a,k)=>`<button type="button" class="nq-answer" data-answer="${k}" aria-pressed="false"><span class="nq-answer-key">${String.fromCharCode(65+k)}</span><span>${esc(a)}</span></button>`).join('')}</div><div class="nq-feedback" id="nqFeedback${j}" aria-live="polite"></div></div>`).join('');}
q('#nqMissionList')?.addEventListener('click',e=>{const b=e.target.closest('[data-mission]');if(!b)return;const i=Number(b.dataset.mission);if(!Number.isInteger(i)||i<0||i>=missions.length)return;openMission(i);q('#missionBreadcrumb').textContent='MISI '+String(i+1).padStart(2,'0')+' / 10';qa('.view').forEach(view=>view.classList.toggle('on',view.id==='missionDetail'));qa('.topnav [data-v]').forEach(button=>button.classList.toggle('active',button.dataset.v==='missions'));qa('#dock button').forEach(button=>button.classList.toggle('on',button.dataset.v==='missions'));window.scrollTo({top:0,behavior:'smooth'})});
q('#nqMissionWork')?.addEventListener('click',e=>{const b=e.target.closest('[data-answer]');if(!b)return;const card=b.closest('[data-mission-question]');if(!card||b.disabled)return;const j=Number(card.dataset.missionQuestion),answer=Number(b.dataset.answer);if(!Number.isInteger(j)||!Number.isInteger(answer))return;missionAnswers[j]=answer;card.querySelectorAll('button[data-answer]').forEach(x=>{const selected=x===b;x.classList.toggle('selected',selected);x.setAttribute('aria-pressed',String(selected))});q('#nqMissionFeedback').textContent='';});
q('#nqMissionWork')?.addEventListener('click',e=>{if(e.target.closest('#nqClearMission')){openMission(activeMission);return}if(!e.target.closest('#nqSubmitMission'))return;const m=missions[activeMission],feedback=q('#nqMissionFeedback');if(!q('#nqTaskRead')?.checked){feedback.textContent='Centang konfirmasi setelah membaca materi dan melakukan aktivitas.';return;}if(m.qs.some((_,i)=>missionAnswers[i]===undefined)){feedback.textContent='Pilih satu jawaban pada setiap soal terlebih dahulu.';qa('#nqMissionQuestions [data-mission-question]').find(card=>!card.querySelector('.nq-answer.selected'))?.querySelector('.nq-answer')?.focus();return;}let score=0;m.qs.forEach((item,i)=>{const card=q(`[data-mission-question="${i}"]`),ok=missionAnswers[i]===item[2];if(ok)score++;card.querySelectorAll('button[data-answer]').forEach(button=>{button.disabled=true;if(Number(button.dataset.answer)===item[2])button.classList.add('correct');else if(Number(button.dataset.answer)===missionAnswers[i])button.classList.add('wrong')});q('#nqFeedback'+i).textContent=(ok?'Benar. ':'Belum tepat. ')+item[3];});if(score>=2){const isNew=!missionState.done[activeMission];missionState.done[activeMission]=true;missionState.scores[activeMission]=score;safeWrite('nq_academy_missions',missionState);feedback.textContent=`Bagus! Nilai ${score}/3. Misi berhasil diselesaikan.${isNew?' Progres tersimpan.':''}`;renderMissionList();if(isNew)window.nqAwardXP?.('mission_'+activeMission,25)}else{feedback.textContent=`Nilai ${score}/3. Kamu perlu minimal 2 jawaban benar. Pelajari pembahasan, lalu tekan “Ulangi soal” untuk mencoba lagi.`;}}); 
renderMissionList();openMission(0);

if(false){
// Classroom game: host-led turn-taking on one screen; no remote synchronization without a server.
const quizBank=[
['Perangkat yang meneruskan frame dalam LAN adalah…',['Switch','Monitor','Keyboard','Speaker'],0,'Switch meneruskan frame berdasarkan MAC address.'],
['Port default HTTPS adalah…',['21','53','443','8080'],2,'HTTPS umumnya menggunakan TCP port 443.'],
['DNS menerjemahkan…',['Nama domain ke alamat IP','IP ke tegangan listrik','Kabel ke sinyal radio','File ke folder'],0,'DNS menyelesaikan nama domain menjadi alamat IP.'],
['Perangkat yang menghubungkan jaringan berbeda adalah…',['Router','Mouse','RAM','Repeater USB'],0,'Router meneruskan paket antarjaringan.'],
['Berapa layer pada model OSI?',['4','5','6','7'],3,'Model OSI memiliki tujuh layer.'],
['Kabel fiber optik mengirim data menggunakan…',['Cahaya','Suara','Air','Gelombang panas'],0,'Informasi dikirim dalam bentuk pulsa cahaya.'],
['DHCP digunakan untuk…',['Memberikan konfigurasi IP otomatis','Mengenkripsi file','Mengukur suhu CPU','Mengganti nama host'],0,'DHCP mengalokasikan konfigurasi jaringan secara otomatis.'],
['Subnet mask /24 setara dengan…',['255.255.0.0','255.255.255.0','255.0.0.0','255.255.255.255'],1,'Prefix /24 memiliki 24 bit network mask.'],
['VLAN berfungsi untuk…',['Segmentasi jaringan logis','Menambah RAM','Menyimpan backup','Mengganti DNS publik'],0,'VLAN membagi broadcast domain secara logis.'],
['Perintah untuk menguji konektivitas IP adalah…',['ping','mkdir','copy','format'],0,'ping menguji jangkauan host melalui ICMP.'],
['Port SSH adalah…',['20','22','25','110'],1,'SSH umumnya menggunakan TCP port 22.'],
['Alamat IPv4 memiliki panjang…',['16 bit','32 bit','64 bit','128 bit'],1,'IPv4 terdiri dari 32 bit.']
];
let room=null,players=[],selectedAvatar='◆',turn=0,questionIndex=0,gameActive=false,mode='classic',questionTimer=null,secondsLeft=15;
const randCode=()=>String(Math.floor(100000+Math.random()*900000));
function updatePlayers(){const el=q('#nqPlayerList');if(!el)return;el.innerHTML=players.length?players.map((p,i)=>`<span class="nq-player-chip">${esc(p.avatar)} ${esc(p.name)} <button type="button" data-remove-player="${i}" aria-label="Hapus ${esc(p.name)}" style="border:0;background:none;color:var(--bad);cursor:pointer">×</button></span>`).join(''):'<p class="tiny">Belum ada peserta.</p>';q('#nqStartGame').disabled=!room||players.length<1||gameActive;}
q('#nqAvatarPicks')?.addEventListener('click',e=>{const b=e.target.closest('[data-avatar]');if(!b)return;selectedAvatar=b.dataset.avatar;qa('.nq-avatar').forEach(x=>x.classList.toggle('selected',x===b));});
q('#nqAddPlayer')?.addEventListener('click',()=>{const name=q('#nqPlayerName').value.trim();if(name.length<2){alert('Nama pemain minimal 2 karakter.');return;}if(players.some(p=>p.name.toLowerCase()===name.toLowerCase())){alert('Nama pemain tersebut sudah digunakan di room ini.');return;}players.push({name,avatar:selectedAvatar,score:0});q('#nqPlayerName').value='';updatePlayers();});
q('#nqPlayerName')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();q('#nqAddPlayer').click();}});
q('#nqPlayerList')?.addEventListener('click',e=>{const b=e.target.closest('[data-remove-player]');if(!b||gameActive)return;players.splice(Number(b.dataset.removePlayer),1);updatePlayers();});
q('#nqCreateRoom')?.addEventListener('click',()=>{room={code:randCode(),title:q('#nqRoomTitle').value.trim()||'TJKT Challenge Class'};mode=q('#nqGameMode').value;q('#nqRoomCode').textContent=room.code;q('#nqRoomNameDisplay').textContent=room.title;q('#nqRoomPanel').hidden=false;q('#nqBoardTitle').textContent=room.title;updatePlayers();q('#nqGameStage').innerHTML='<div class="nq-stage-empty"><h3>Room dibuat!</h3><p>Tambahkan nama peserta pada panel lobby. Host dapat menampilkan layar ini di proyektor atau smartboard.</p></div>';});
q('#nqCopyRoom')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('Neko Class Arena — Room '+(room?.code||''));q('#nqCopyRoom').textContent='Kode disalin!';}catch(_){q('#nqCopyRoom').textContent='Kode: '+(room?.code||'');}});
function renderScores(){const el=q('#nqLeaderboard');if(!el)return;const sorted=[...players].sort((a,b)=>b.score-a.score);el.innerHTML=sorted.length?'<h3>Leaderboard kelas</h3>'+sorted.map((p,i)=>`<div class="nq-score-row"><span>${i+1}. ${esc(p.avatar)} ${esc(p.name)}</span><strong>${p.score} poin</strong></div>`).join(''):'';}
function startQuestionTimer(){if(questionTimer)clearInterval(questionTimer);secondsLeft=15;const clock=q('#nqCountdown');if(clock)clock.textContent=secondsLeft;questionTimer=setInterval(()=>{secondsLeft--;const node=q('#nqCountdown');if(node)node.textContent=secondsLeft;if(secondsLeft<=0){clearInterval(questionTimer);questionTimer=null;const feedback=q('#nqAnswerFeedback');if(feedback)feedback.textContent='Waktu habis! Tidak ada poin untuk soal ini.';q('#nqGameStage')?.querySelectorAll('button').forEach(b=>b.disabled=true);advance();}},1000);}
function nextQuestion(){if(questionIndex>=8){finishGame();return;}const player=players[turn];const data=quizBank[(questionIndex*5+1)%quizBank.length];let choices=data[1].map((x,i)=>({x,i}));if(mode==='truefalse'){const isTrue=(questionIndex%2===0);const prompt=isTrue?data[0]:data[1][(data[2]+1)%data[1].length]+' — apakah ini jawaban yang tepat?';q('#nqGameStage').innerHTML=`<div class="nq-current-player">GILIRAN ${esc(player.avatar)} ${esc(player.name)} • SOAL ${questionIndex+1}/8 • WAKTU <span id="nqCountdown">15</span>s</div><div class="nq-stage-question">${esc(prompt)}</div><div class="nq-game-answers"><button class="nq-game-answer" data-tf="true">BENAR</button><button class="nq-game-answer" data-tf="false">SALAH</button></div><div class="nq-feedback" id="nqAnswerFeedback">Pilih jawabanmu.</div>`;q('#nqGameStage').dataset.answer=String(isTrue);}
else{if(mode==='speed')choices=choices.sort(()=>Math.random()-.5);q('#nqGameStage').innerHTML=`<div class="nq-current-player">GILIRAN ${esc(player.avatar)} ${esc(player.name)} • SOAL ${questionIndex+1}/8 • WAKTU <span id="nqCountdown">15</span>s</div><div class="nq-stage-question">${esc(data[0])}</div><div class="nq-game-answers">${choices.map((c,i)=>`<button class="nq-game-answer" data-choice="${c.i}">${String.fromCharCode(65+i)}. ${esc(c.x)}</button>`).join('')}</div><div class="nq-feedback" id="nqAnswerFeedback">Pilih satu jawaban.</div>`;q('#nqGameStage').dataset.answer=String(data[2]);}q('#nqNextTurn').hidden=true;q('#nqEndGame').hidden=false;startQuestionTimer();}
function advance(){if(questionTimer){clearInterval(questionTimer);questionTimer=null;}questionIndex++;turn=(turn+1)%players.length;if(questionIndex>=8){finishGame();return;}q('#nqNextTurn').hidden=false;q('#nqNextTurn').textContent='Lanjut ke pemain berikutnya';q('#nqGameStage').querySelectorAll('button').forEach(b=>b.disabled=true);}
q('#nqGameStage')?.addEventListener('click',e=>{const b=e.target.closest('[data-choice],[data-tf]');if(!b||!gameActive||b.disabled)return;const expected=q('#nqGameStage').dataset.answer;let correct;if(b.hasAttribute('data-choice'))correct=String(b.dataset.choice)===expected;else correct=b.dataset.tf===expected;if(correct){players[turn].score+=mode==='speed'?120:100;q('#nqAnswerFeedback').textContent='Tepat! +'+(mode==='speed'?120:100)+' poin.';}else{q('#nqAnswerFeedback').textContent='Belum tepat. Tetap semangat, lanjut ke soal berikutnya.';}q('#nqGameStage').querySelectorAll('button').forEach(x=>{x.disabled=true;if((x.dataset.choice!==undefined&&x.dataset.choice===expected)||(x.dataset.tf!==undefined&&x.dataset.tf===expected))x.style.outline='3px solid #7bf0ba';});renderScores();advance();});
q('#nqStartGame')?.addEventListener('click',()=>{if(!room||!players.length)return;players.forEach(p=>p.score=0);turn=0;questionIndex=0;gameActive=true;q('#nqStartGame').hidden=true;q('#nqEndGame').hidden=false;nextQuestion();renderScores();});
q('#nqNextTurn')?.addEventListener('click',()=>{if(gameActive)nextQuestion();});
function finishGame(){if(questionTimer){clearInterval(questionTimer);questionTimer=null;}gameActive=false;q('#nqGameStage').innerHTML='<div class="nq-stage-empty"><h2>Ronde selesai!</h2><p>Terima kasih sudah bermain. Periksa peringkat kelas di bawah.</p></div>';q('#nqNextTurn').hidden=true;q('#nqEndGame').hidden=true;q('#nqStartGame').hidden=false;q('#nqStartGame').textContent='Main lagi';renderScores();}
q('#nqEndGame')?.addEventListener('click',finishGame);
q('#nqFullscreen')?.addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch(_){q('#nqFullscreen').textContent='Mode layar penuh tidak didukung';}});
q('#nqResetGame')?.addEventListener('click',()=>{if(questionTimer){clearInterval(questionTimer);questionTimer=null;}room=null;players=[];gameActive=false;turn=0;questionIndex=0;q('#nqRoomPanel').hidden=true;q('#nqGameStage').innerHTML='<div class="nq-stage-empty"><h3>Room direset</h3><p>Buat room baru untuk memulai sesi selanjutnya.</p></div>';q('#nqStartGame').hidden=false;q('#nqStartGame').textContent='Mulai permainan';q('#nqEndGame').hidden=true;q('#nqNextTurn').hidden=true;q('#nqLeaderboard').innerHTML='';updatePlayers();});

}

// Certificate rendering, PNG download and print-to-PDF via browser print dialog.
function allMissionsDone(){return Object.keys(missionState.done).filter(k=>missionState.done[k]).length===10}
function updateCertificateUI(){const done=allMissionsDone(),skill=done&&Object.keys(missionState.scores).filter(k=>missionState.scores[k]>=3).length>=8&&projectSaved.checks?.length===5&&String(projectSaved.text||'').trim().length>=80;const n=q('#nqCertName')?.value.trim()||safeRead('nq_academy_cert_name','');q('#nqCertStatus').textContent=done?'Sertifikat penyelesaian terbuka. Jalur keterampilan memerlukan hasil teori yang kuat dan proyek akhir lengkap.':'Selesaikan '+Object.keys(missionState.done).filter(k=>missionState.done[k]).length+'/10 misi untuk membuka sertifikat penyelesaian.';qa('[data-cert-name]').forEach(el=>el.textContent=n||'Nama Peserta');['nqDownloadCompletion','nqCompletionPrint'].forEach(id=>{const b=q('#'+id);if(b)b.disabled=!done||!n;});q('#nqDownloadCompletion').disabled=!done||!n;qa('[data-print="completion"]').forEach(b=>b.disabled=!done||!n);q('#nqDownloadSkill').disabled=!skill||!n;qa('[data-print="skill"]').forEach(b=>b.disabled=!skill||!n);q('#nqCompletionLock').textContent=done?'Terbuka — siap dicetak atau diunduh.':'Belum terbuka — selesaikan 10 misi.';q('#nqSkillLock').textContent=skill?'Terbuka — diverifikasi oleh '+projectSaved.teacherName+'.':'Butuh 10 misi, minimal 8 misi bernilai 3/3, ringkasan proyek minimal 80 karakter, lima bukti rubrik, dan konfirmasi guru.';if(q('#nqTeacherApprove'))q('#nqTeacherApprove').disabled=!projectReady||projectSaved.teacherApproved===true;}
q('#nqCertName')?.addEventListener('input',()=>{safeWrite('nq_academy_cert_name',q('#nqCertName').value.trim());updateCertificateUI();});
q('#nqCertName').value=safeRead('nq_academy_cert_name','');
q('#nqProjectText').value=projectSaved.text||'';qa('#nqRubric input').forEach(c=>c.checked=(projectSaved.checks||[]).includes(c.value));
q('#nqSaveProject')?.addEventListener('click',()=>{const text=q('#nqProjectText').value.trim(),checks=qa('#nqRubric input:checked').map(c=>c.value);if(text.length<80||checks.length!==5){q('#nqProjectStatus').textContent='Lengkapi ringkasan minimal 80 karakter dan centang kelima bukti proyek.';return;}projectSaved={text,checks,teacherApproved:false,teacherName:''};safeWrite('nq_academy_project',projectSaved);q('#nqProjectStatus').textContent='Bukti proyek tersimpan pada browser ini. Guru perlu memeriksa hasil praktik sebelum memberi verifikasi.';updateCertificateUI();});
q('#nqTeacherApprove')?.addEventListener('click',()=>{if(projectSaved.checks?.length!==5||String(projectSaved.text||'').trim().length<80){q('#nqProjectStatus').textContent='Simpan proyek lengkap terlebih dahulu.';return;}const teacher=window.prompt('Nama guru yang telah memeriksa proyek secara langsung:');if(!teacher||teacher.trim().length<2)return;if(!window.confirm('Konfirmasi: '+teacher.trim()+' sudah memeriksa bukti praktik peserta secara langsung?'))return;projectSaved.teacherApproved=true;projectSaved.teacherName=teacher.trim();safeWrite('nq_academy_project',projectSaved);q('#nqProjectStatus').textContent='Verifikasi guru dicatat pada browser ini. Catatan ini tidak memakai tanda tangan digital atau autentikasi server.';updateCertificateUI();});
function certificateSVG(kind,name){const skill=kind==='skill',title=skill?'CERTIFICATE OF SKILL ACHIEVEMENT':'CERTIFICATE OF COMPLETION',sub=skill?'Atas pencapaian evaluasi teori dan proyek keterampilan TJKT':'Atas penyelesaian 10 misi pembelajaran TJKT';const safeName=esc(name);return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1131" viewBox="0 0 1600 1131"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${skill?'#1b102d':'#0d2038'}"/><stop offset="1" stop-color="${skill?'#243d66':'#1b3d5c'}"/></linearGradient></defs><rect width="1600" height="1131" fill="url(#bg)"/><rect x="28" y="28" width="1544" height="1075" rx="16" fill="none" stroke="#d9bd72" stroke-width="12"/><rect x="55" y="55" width="1490" height="1021" rx="8" fill="none" stroke="#d9bd72" stroke-width="2"/><text x="800" y="205" text-anchor="middle" font-family="Arial" font-size="44" font-weight="bold" letter-spacing="8" fill="#f2d98d">NEKO ACADEMY</text><text x="800" y="255" text-anchor="middle" font-family="Arial" font-size="24" letter-spacing="6" fill="#d9e8f7">TJKT SKILL MASTERY</text><text x="800" y="420" text-anchor="middle" font-family="Georgia" font-size="76" fill="#ffffff">${title}</text><text x="800" y="520" text-anchor="middle" font-family="Arial" font-size="28" fill="#dbe7f4">Diberikan kepada</text><text x="800" y="630" text-anchor="middle" font-family="Georgia" font-size="68" font-style="italic" fill="#f6d98a">${safeName}</text><path d="M360 655H1240" stroke="#d9bd72" stroke-width="2"/><text x="800" y="735" text-anchor="middle" font-family="Arial" font-size="27" fill="#dbe7f4">${sub}</text><circle cx="800" cy="860" r="55" fill="none" stroke="#d9bd72" stroke-width="4"/><text x="800" y="878" text-anchor="middle" font-family="Georgia" font-size="42" fill="#f2d98d">${skill?'★':'NQ'}</text><text x="800" y="1010" text-anchor="middle" font-family="Arial" font-size="20" letter-spacing="4" fill="#c4d1df">NEKO ACADEMY • NON-FORMAL LEARNING AWARD</text></svg>`;}
async function downloadCertificate(kind){const name=q('#nqCertName').value.trim();if(!name)return;const svg=certificateSVG(kind,name),blob=new Blob([svg],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1131;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);URL.revokeObjectURL(url);canvas.toBlob(png=>{if(!png)return;const a=document.createElement('a');a.href=URL.createObjectURL(png);a.download=(kind==='skill'?'Neko-Skill-Achievement-':'Neko-Completion-')+name.trim().replace(/[^a-z0-9]+/gi,'-')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);},'image/png');};img.onerror=()=>{URL.revokeObjectURL(url);alert('Browser tidak dapat membuat gambar sertifikat. Coba fitur Cetak / Simpan PDF.');};img.src=url;}
q('#nqDownloadCompletion')?.addEventListener('click',()=>downloadCertificate('completion'));q('#nqDownloadSkill')?.addEventListener('click',()=>downloadCertificate('skill'));
qa('[data-print]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.print,name=q('#nqCertName').value.trim();if(!name)return;const sheet=q('#nqPrintSheet');sheet.innerHTML=`<div class="nq-cert-preview ${kind==='skill'?'nq-cert-skill':''}"><div class="nq-cert-brand">NEKO ACADEMY</div><div class="nq-cert-sub">TJKT SKILL MASTERY</div><div class="nq-cert-title">${kind==='skill'?'CERTIFICATE OF<br>SKILL ACHIEVEMENT':'CERTIFICATE<br>OF COMPLETION'}</div><div class="nq-cert-line">Diberikan kepada</div><div class="nq-cert-person">${esc(name)}</div><div class="nq-cert-line">${kind==='skill'?'Atas pencapaian evaluasi teori dan proyek keterampilan TJKT':'Atas penyelesaian 10 misi pembelajaran TJKT'}</div><div class="nq-cert-seal">${kind==='skill'?'★':'NQ'}</div><div class="nq-cert-foot">NEKO ACADEMY • NON-FORMAL LEARNING AWARD</div></div>`;window.print();}));
certificateSVG=function(kind,name){
 const skill=kind==='skill';
 const title=skill?'SERTIFIKAT PENCAPAIAN KETERAMPILAN':'SERTIFIKAT PENYELESAIAN';
 const description=skill?'Atas pencapaian evaluasi teori dan proyek keterampilan TJKT':'Atas penyelesaian 10 misi pembelajaran TJKT';
 const safeName=esc(name),date=new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
 return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1131" viewBox="0 0 1600 1131"><rect width="1600" height="1131" fill="#f5faff"/><rect x="28" y="28" width="1544" height="1075" rx="8" fill="#fff" stroke="#173e5c" stroke-width="12"/><rect x="54" y="54" width="1492" height="1023" rx="4" fill="none" stroke="#b99546" stroke-width="3"/><path d="M80 130h180M1340 130h180M80 1000h180M1340 1000h180" stroke="#173e5c" stroke-width="5"/><text x="800" y="155" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" letter-spacing="7" fill="#47677e">SMKN 3 KENDARI</text><text x="800" y="220" text-anchor="middle" font-family="Arial,sans-serif" font-size="35" font-weight="800" letter-spacing="5" fill="#173e5c">NEKO TJKT</text><path d="M420 255h760" stroke="#b99546" stroke-width="3"/><text x="800" y="340" text-anchor="middle" font-family="Arial,sans-serif" font-size="25" letter-spacing="4" fill="#47677e">PENGHARGAAN PEMBELAJARAN</text><text x="800" y="445" text-anchor="middle" font-family="Georgia,serif" font-size="58" font-weight="700" fill="#173e5c">${title}</text><text x="800" y="545" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#47677e">Diberikan kepada</text><text x="800" y="665" text-anchor="middle" font-family="Georgia,serif" font-size="68" font-style="italic" fill="#173e5c">${safeName}</text><path d="M380 692h840" stroke="#b99546" stroke-width="2"/><text x="800" y="770" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" fill="#38566e">${description}</text><text x="800" y="835" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#62798a">Diterbitkan ${date}</text><path d="M330 940h300M970 940h300" stroke="#173e5c" stroke-width="2"/><text x="480" y="980" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#38566e">Guru Pembimbing</text><text x="1120" y="980" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#38566e">Neko TJKT</text><text x="800" y="1040" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" letter-spacing="1" fill="#718596">PENGHARGAAN NONFORMAL • BUKAN SERTIFIKASI KOMPETENSI PROFESI</text></svg>`;
};
updateCertificateUI();
})();

;


(()=>{
const loader=document.querySelector('#networkLoader');
function finishLoading(){window.setTimeout(()=>loader?.classList.add('done'),260)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',finishLoading,{once:true});else finishLoading();
let installPrompt=null;
window.addEventListener('beforeinstallprompt',event=>{if(!window.matchMedia('(pointer:coarse)').matches)return;event.preventDefault();installPrompt=event;const button=document.querySelector('#installApp');if(button)button.hidden=false});
document.querySelector('#installApp')?.addEventListener('click',async()=>{if(!installPrompt)return;installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;document.querySelector('#installApp').hidden=true});
window.addEventListener('appinstalled',()=>{const button=document.querySelector('#installApp');if(button)button.hidden=true});
if('serviceWorker' in navigator&&location.protocol!=='file:'){
 let refreshing=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;location.reload()});
 window.addEventListener('load',async()=>{try{const registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});await registration.update()}catch(e){}},{once:true});
}
})();
