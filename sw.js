const CACHE_NAME='todaycock2-final-v20';
const ASSETS=[
  './','./index.html','./viewer.html','./firebase-config.js',
  './css/style.css','./js/app.js','./js/schedule.js','./js/firebase.js','./manifest.json'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request))));
