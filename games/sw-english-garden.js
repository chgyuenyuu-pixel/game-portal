/* English Garden service worker — precache shell + whisper, runtime-cache audio */
var EG_SW_VERSION = 'wrongbook-20261029a';
var SHELL_CACHE = 'eg-shell-' + EG_SW_VERSION;
var AUDIO_CACHE = 'eg-audio-v1';
var AI_CACHE = 'eg-ai-v2';

var SHELL_URLS = [
  './english-garden.html',
  './manifest-english-garden.webmanifest',
  './eg-icon-192.png',
  './eg-icon-512.png',
  '../cloud-save.js'
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
        if (k.indexOf('eg-shell-') === 0 && k !== SHELL_CACHE) return caches.delete(k);
        if (k === 'eg-ai-v1') return caches.delete(k);
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
  return /\/whisper-tiny-en\//.test(url.pathname) ||
    /\.onnx(\?|$)/.test(url.pathname);
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

  // Same-origin whisper model + onnx: cache-first
  if (isWhisperAsset(url)) {
    event.respondWith(
      caches.open(AI_CACHE).then(function (cache) {
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

  var accept = req.headers.get('accept') || '';
  var isDoc = req.mode === 'navigate' || accept.indexOf('text/html') !== -1 ||
    /english-garden\.html$/.test(url.pathname) ||
    /manifest-english-garden\.webmanifest$/.test(url.pathname) ||
    /cloud-save\.js$/.test(url.pathname);

  if (isDoc) {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(SHELL_CACHE).then(function (c) { try { c.put(req, copy); } catch (e) {} });
        }
        return res;
      }).catch(function () {
        return caches.open(SHELL_CACHE).then(function (c) {
          return c.match(req).then(function (hit) {
            if (hit) return hit;
            return c.match('./english-garden.html').then(function (h2) {
              return h2 || c.match('/game-portal/games/english-garden.html');
            });
          });
        });
      })
    );
  }
});
