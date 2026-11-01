/* Mandarin Garden service worker — precache shell, runtime-cache audio + whisper */
var MG_SW_VERSION = 'home-v1-20261102w-voice-fix2-pinyin-sent';
var SHELL_CACHE = 'mg-shell-' + MG_SW_VERSION;
var AUDIO_CACHE = 'mg-audio-v1';
var AI_CACHE = 'mg-ai-v5';

var SHELL_URLS = [
  './mandarin-garden.html',
  './manifest-mandarin-garden.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL_URLS.map(function (u) {
        return new Request(u, { cache: 'reload' });
      })).catch(function () {
        return Promise.all(SHELL_URLS.map(function (u) {
          return cache.add(u).catch(function () {});
        }));
      });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('mg-shell-') === 0 && k !== SHELL_CACHE) return caches.delete(k);
        /* Drop stale AI caches so bad/partial whisper responses cannot stick */
        if (k.indexOf('mg-ai-') === 0 && k !== AI_CACHE) return caches.delete(k);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isAudioRequest(url) {
  return /\/games\/audio\/.+\.mp3(\?|$)/.test(url.pathname) ||
    /\/audio\/.+\.mp3(\?|$)/.test(url.pathname);
}

function isWhisperAsset(url) {
  return /\/whisper-tiny\//.test(url.pathname) ||
    /\/transformers\//.test(url.pathname) ||
    /\.onnx(\?|$)/.test(url.pathname) ||
    /\.wasm(\?|$)/.test(url.pathname);
}

function isAiCdnRequest(url) {
  var h = url.hostname || '';
  if (h === 'cdn.jsdelivr.net' || h === 'unpkg.com') {
    return /@xenova\/transformers/.test(url.pathname) ||
      /whisper/i.test(url.pathname) ||
      /onnxruntime/i.test(url.pathname);
  }
  if (h === 'huggingface.co' || h.endsWith('.huggingface.co') ||
      h === 'cdn-lfs.huggingface.co' || h.indexOf('hf.co') !== -1 ||
      h === 'hf-mirror.com' || h.endsWith('.hf-mirror.com')) {
    return true;
  }
  return false;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }

  if (isWhisperAsset(url)) {
    var isJson = /\.json(\?|$)/.test(url.pathname);
    event.respondWith(
      caches.open(AI_CACHE).then(function (cache) {
        /* JSON (config/tokenizer): network-first so phones never stick on a bad cached config */
        if (isJson) {
          return fetch(req).then(function (res) {
            if (res && res.ok) {
              try { cache.put(req, res.clone()); } catch (e) {}
            }
            return res;
          }).catch(function () {
            return cache.match(req).then(function (hit) { return hit || Response.error(); });
          });
        }
        /* onnx / large: cache-first */
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && res.ok) {
              try { cache.put(req, res.clone()); } catch (e) {}
            }
            return res;
          }).catch(function () {
            return cache.match(req);
          });
        });
      })
    );
    return;
  }

  if (isAiCdnRequest(url)) {
    event.respondWith(
      caches.open(AI_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) {
              try { cache.put(req, res.clone()); } catch (e) {}
            }
            return res;
          }).catch(function () {
            return cache.match(req);
          });
        });
      })
    );
    return;
  }

  if (isAudioRequest(url)) {
    event.respondWith(
      caches.open(AUDIO_CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && res.ok) {
              try { cache.put(req, res.clone()); } catch (e) {}
            }
            return res;
          }).catch(function () {
            return cache.match(req);
          });
        });
      })
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok && (url.pathname.indexOf('mandarin-garden') !== -1 || url.pathname.indexOf('manifest-mandarin') !== -1)) {
          caches.open(SHELL_CACHE).then(function (cache) {
            try { cache.put(req, res.clone()); } catch (e) {}
          });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./mandarin-garden.html');
        });
      })
    );
  }
});
