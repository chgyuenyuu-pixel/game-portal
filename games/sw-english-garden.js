/* English Garden: network-first page updates, persistent speech/model caches. */
var EG_SW_VERSION='news-papers-20261102b-voice-fix2';
var SHELL_CACHE='eg-shell-'+EG_SW_VERSION,AUDIO_CACHE='eg-audio-v1',AI_CACHE='eg-ai-v2';
var SHELL_URLS=['./english-garden.html','./manifest-english-garden.webmanifest','./eg-icon-192.png','./eg-icon-512.png','./mandarin-garden.html','./manifest-mandarin-garden.webmanifest','../cloud-save.js'];
function absolute(path){return new URL(path,self.location.href).href;}
self.addEventListener('install',function(event){
  event.waitUntil(caches.open(SHELL_CACHE).then(function(cache){
    return Promise.all(SHELL_URLS.map(function(path){return cache.add(new Request(absolute(path),{cache:'reload'})).catch(function(){});}));
  }).then(function(){return self.skipWaiting();}));
});
self.addEventListener('activate',function(event){
  event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.map(function(key){if(key.indexOf('eg-shell-')===0&&key!==SHELL_CACHE)return caches.delete(key);}));}).then(function(){return self.clients.claim();}));
});
function isWhisperAsset(url){return /\/whisper-(?:tiny|base)(?:-en)?\//.test(url.pathname)||/\/transformers\//.test(url.pathname)||/\.onnx$/.test(url.pathname);}
function isAiCdnRequest(url){
  var host=url.hostname;
  if(host==='cdn.jsdelivr.net'||host==='unpkg.com')return /@xenova\/transformers|onnxruntime/.test(url.pathname);
  return host==='huggingface.co'||host.endsWith('.huggingface.co')||host.endsWith('.hf.co')||host==='hf.co'||host==='hf-mirror.com'||host.endsWith('.hf-mirror.com');
}
function cachedAsset(event,cacheName,validateAi){
  var request=event.request;
  return caches.open(cacheName).then(function(cache){return cache.match(request).then(function(hit){
    if(hit&&(!validateAi||!/text\/html/i.test(hit.headers.get('content-type')||'')))return hit;
    if(hit)event.waitUntil(cache.delete(request).catch(function(){}));
    return fetch(request).then(function(response){
      if(response&&(response.ok||response.type==='opaque')&&(!validateAi||!/text\/html/i.test(response.headers.get('content-type')||'')))event.waitUntil(cache.put(request,response.clone()).catch(function(){}));
      return response;
    });
  });});
}
self.addEventListener('fetch',function(event){
  var req=event.request;if(req.method!=='GET')return;
  var url=new URL(req.url);
  if(isWhisperAsset(url)||isAiCdnRequest(url)){event.respondWith(cachedAsset(event,AI_CACHE,true));return;}
  if(/\/audio\/.+\.mp3$/.test(url.pathname)){event.respondWith(cachedAsset(event,AUDIO_CACHE,false));return;}
  var isPage=/\/(?:english|mandarin)-garden\.html$/.test(url.pathname);
  var isShell=isPage||/manifest-(?:english|mandarin)-garden\.webmanifest$|cloud-save\.js$/.test(url.pathname);
  if(!isShell)return;
  event.respondWith(fetch(req).then(function(response){
    if(response&&response.ok)event.waitUntil(caches.open(SHELL_CACHE).then(function(cache){return cache.put(req,response.clone());}).catch(function(){}));
    return response;
  }).catch(function(){return caches.open(SHELL_CACHE).then(function(cache){return cache.match(req).then(function(hit){
    if(hit)return hit;
    if(isPage)return cache.match(url.origin+url.pathname).then(function(page){return page||Response.error();});
    return Response.error();
  });});}));
});
