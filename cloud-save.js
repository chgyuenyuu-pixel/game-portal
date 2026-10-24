/* cloud-save.js v1 — Firebase Google/匿名 雲端存檔。Firebase 載入失敗時遊戲照常離線運作。 */
(function(){
'use strict';
var CFG={apiKey:"AIzaSyC_Rg1G4B9ub-LGNe7Ehav2M8_R1SeEkAs",authDomain:"game-fcb7b.firebaseapp.com",projectId:"game-fcb7b",storageBucket:"game-fcb7b.firebasestorage.app",messagingSenderId:"1025463195895",appId:"1:1025463195895:web:9ec9f047b8a884df2a9bf2"};
var GAMES={'farm-day':['farm'],'fishing-island':['fishIsland'],'kitchen':['little-wok'],'piano-tiles':['pianoTiles'],'rail-rush-v10':['rail-rush'],'harbour-kart-v12':['hk_'],'english-garden':['eg_']};
var path=location.pathname, m=path.match(/([^\/]+)\.html?$/), GAME=m&&GAMES[m[1]]?m[1]:null, PFX=GAME?GAMES[GAME]:[];
var META='cs_meta_'+(GAME||'portal'), SDK='https://www.gstatic.com/firebasejs/10.12.5/';
var S=window.localStorage, P=Storage.prototype, rawSet=P.setItem, rawGet=P.getItem, rawRem=P.removeItem;
function mine(k){if(!GAME||typeof k!=='string')return false;for(var i=0;i<PFX.length;i++)if(k.indexOf(PFX[i])===0)return true;return false}
function meta(){try{return JSON.parse(rawGet.call(S,META)||'{}')}catch(e){return{}}}
function setMeta(o){try{rawSet.call(S,META,JSON.stringify(o))}catch(e){}}
// ---- gate: buffer game writes until cloud check finishes ----
var gate=!!GAME, buf={}, frozen=false, dirty=false;
P.setItem=function(k,v){if(this===S&&mine(k)){if(frozen)return;if(gate){buf[k]=String(v);return}var o=rawGet.call(S,k);rawSet.call(S,k,v);if(o!==String(v)){dirty=true;var mt=meta();mt.t=Date.now();setMeta(mt)}return}return rawSet.call(this,k,v)};
P.getItem=function(k){if(this===S&&gate&&mine(k)&&Object.prototype.hasOwnProperty.call(buf,k))return buf[k]===null?null:buf[k];return rawGet.call(this,k)};
P.removeItem=function(k){if(this===S&&mine(k)){if(frozen)return;if(gate){buf[k]=null;return}if(rawGet.call(S,k)!==null){dirty=true;var mt=meta();mt.t=Date.now();setMeta(mt)}}return rawRem.call(this,k)};
function openGate(){if(!gate)return;gate=false;var ks=Object.keys(buf);buf2=buf;buf={};ks.forEach(function(k){var v=buf2[k];v===null?S.removeItem(k):S.setItem(k,v)})}
var buf2;
setTimeout(openGate,10000); // 保險：最多等 10 秒
function localData(){var d={};for(var i=0;i<S.length;i++){var k=S.key(i);if(mine(k))d[k]=rawGet.call(S,k)}return d}
// ---- firebase loader ----
function load(src){return new Promise(function(ok,no){var s=document.createElement('script');s.src=src;s.async=true;s.onload=ok;s.onerror=no;(document.head||document.documentElement).appendChild(s)})}
var fb=null, auth=null, db=null, user=null;
function boot(){return load(SDK+'firebase-app-compat.js').then(function(){return Promise.all([load(SDK+'firebase-auth-compat.js'),load(SDK+'firebase-firestore-compat.js')])}).then(function(){fb=window.firebase;fb.initializeApp(CFG);auth=fb.auth();db=fb.firestore();
 return new Promise(function(ok){var done=false;auth.onAuthStateChanged(function(u){user=u;ui();if(!done){done=true;ok()}})})})}
function gdoc(uid,g){return db.collection('users').doc(uid).collection('games').doc(g||GAME)}
function pull(){if(!GAME||!user)return Promise.resolve();return gdoc(user.uid).get().then(function(snap){
 var c=snap.exists?snap.data():null, lt=meta().t||0;
 if(c&&c.data&&(c.t||0)>lt){applyData(c.data,c.t);return 'reload'}
 })}
function applyData(data,t){frozen=true;Object.keys(localData()).forEach(function(k){rawRem.call(S,k)});Object.keys(data).forEach(function(k){if(mine(k))rawSet.call(S,k,data[k])});setMeta({t:t||Date.now()});
 if(!sessionStorage.getItem('cs_reloaded')){sessionStorage.setItem('cs_reloaded','1');location.reload()}}
function push(force){if(!GAME||!user||gate||frozen)return;if(!dirty&&!force)return;dirty=false;var t=meta().t||Date.now(),d=localData();
 gdoc(user.uid).set({data:d,t:t,updated:fb.firestore.FieldValue.serverTimestamp()}).catch(function(){dirty=true});
 var code=rawGet.call(S,'cs_code');if(code)db.collection('codes').doc(code).collection('games').doc(GAME).set({data:d,t:t}).catch(function(){})}
setInterval(function(){push()},15000);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')push()});
window.addEventListener('pagehide',function(){push()});
// ---- UI ----
var btn,panel;
function el(t,css,txt){var e=document.createElement(t);if(css)e.style.cssText=css;if(txt)e.textContent=txt;return e}
function ui(){if(!btn)return;btn.textContent=user?(user.isAnonymous?'☁️🔑':'☁️✓'):'☁️';if(panel&&panel.style.display!=='none')render()}
function mkBtn(){btn=el('button','position:fixed;right:0;top:55%;z-index:2147483000;width:24px;height:30px;border-radius:12px 0 0 12px;border:0;background:rgba(0,0,0,.35);color:#fff;font-size:15px;padding:0;opacity:.75;touch-action:manipulation','☁️');btn.id='cs-btn';btn.setAttribute('aria-label','雲端存檔');
 btn.onclick=function(e){e.stopPropagation();panel.style.display=panel.style.display==='none'?'block':'none';render()};
 panel=el('div','display:none;position:fixed;left:8px;right:8px;top:20%;margin:0 auto;max-width:340px;max-height:70vh;overflow:auto;z-index:2147483001;background:#fff;color:#222;border-radius:12px;padding:12px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.35)');panel.id='cs-panel';
 panel.addEventListener('click',function(e){e.stopPropagation()});document.body.appendChild(panel);document.body.appendChild(btn);ui()}
function b(txt,fn){var x=el('button','margin:4px 4px 0 0;padding:7px 10px;border:0;border-radius:8px;background:#3b7cff;color:#fff;font-size:14px',txt);x.onclick=fn;return x}
function msg(t){var p=panel.querySelector('.cs-msg');if(p)p.textContent=t}
function render(){panel.innerHTML='';panel.appendChild(el('b','','☁️ 雲端存檔'));
 if(!fb){panel.appendChild(el('div','',' 離線模式（連唔到雲端）'))}
 else if(!user){panel.appendChild(el('div','','未登入，進度只存喺呢部機。'));panel.appendChild(b('Google 登入',google));panel.appendChild(b('唔登入，用存檔碼',anon))}
 else{panel.appendChild(el('div','',user.isAnonymous?'匿名帳戶':'已登入：'+(user.email||'')));var c=rawGet.call(S,'cs_code');
  if(c)panel.appendChild(el('div','font-size:20px;font-weight:bold;letter-spacing:2px','存檔碼：'+c));
  panel.appendChild(b(c?'更新存檔碼':'整存檔碼',makeCode));if(GAME)panel.appendChild(b('立即上傳',function(){push(true);msg('已上傳 ✓')}));
  if(user.isAnonymous)panel.appendChild(b('Google 登入',google));panel.appendChild(b('登出',function(){auth.signOut()}))}
 if(fb)panel.appendChild(b('輸入存檔碼',restore));
 if(GAME){panel.appendChild(b('匯出',exp));panel.appendChild(b('匯入',imp))}
 panel.appendChild(b('關閉',function(){panel.style.display='none'}));panel.appendChild(el('div','font-size:12px;color:#c00;margin-top:6px','')).className='cs-msg'}
function google(){var pr=new fb.auth.GoogleAuthProvider();var p=user&&user.isAnonymous?user.linkWithPopup(pr):auth.signInWithPopup(pr);
 p.then(function(){msg('登入成功')}).catch(function(e){msg('Google 登入唔到（'+(e.code||e.message)+'），可以用存檔碼。')})}
function anon(){auth.signInAnonymously().then(function(){push(true);return makeCode()}).catch(function(e){msg('登入失敗：'+(e.code||e.message))})}
var AL='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function genCode(){var a=new Uint32Array(8),s='';crypto.getRandomValues(a);for(var i=0;i<8;i++)s+=AL[a[i]%AL.length];return s}
function makeCode(){var code=rawGet.call(S,'cs_code')||genCode(),ref=db.collection('codes').doc(code);
 return ref.set({uid:user.uid,t:Date.now()}).then(function(){rawSet.call(S,'cs_code',code);
  return db.collection('users').doc(user.uid).collection('games').get()}).then(function(qs){var ps=[];qs.forEach(function(d){ps.push(ref.collection('games').doc(d.id).set(d.data()))});return Promise.all(ps)}).then(function(){render();msg('記低存檔碼，喺另一部機撳「輸入存檔碼」')}).catch(function(e){msg('整唔到存檔碼：'+(e.code||e.message))})}
function restore(){var c=(prompt('輸入存檔碼')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(!c)return;
 var go=user?Promise.resolve():auth.signInAnonymously();
 go.then(function(){return db.collection('codes').doc(c).collection('games').get()}).then(function(qs){if(qs.empty){msg('搵唔到呢個存檔碼');return}
  var ps=[],mineDoc=null,now=Date.now();qs.forEach(function(d){var x=d.data();ps.push(gdoc(user.uid,d.id).set({data:x.data,t:now}));if(d.id===GAME)mineDoc=x});
  return Promise.all(ps).then(function(){rawSet.call(S,'cs_code',c);return db.collection('codes').doc(c).update({uid:user.uid})}).catch(function(){}).then(function(){msg('已還原 ✓');if(mineDoc){sessionStorage.removeItem('cs_reloaded');applyData(mineDoc.data,now)}})
 }).catch(function(e){msg('還原失敗：'+(e.code||e.message))})}
function exp(){var s=btoa(unescape(encodeURIComponent(JSON.stringify({g:GAME,d:localData()}))));
 try{navigator.clipboard.writeText(s);msg('已複製匯出碼（貼去記事簿保存）')}catch(e){}prompt('複製呢段匯出碼：',s)}
function imp(){var s=prompt('貼上匯出碼');if(!s)return;try{var o=JSON.parse(decodeURIComponent(escape(atob(s.trim()))));if(o.g!==GAME)throw 0;dirty=true;sessionStorage.removeItem('cs_reloaded');applyData(o.d,Date.now())}catch(e){msg('匯出碼唔啱')}}
// ---- start ----
function start(){mkBtn();boot().then(pull).then(function(r){if(r!=='reload'){sessionStorage.removeItem('cs_reloaded');openGate();push()}}).catch(function(){fb=null;openGate();ui()})}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
