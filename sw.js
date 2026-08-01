const CACHE_NAME='todaycock2-final-mobile-v20';
const ASSETS=[
  './','./index.html','./viewer.html','./firebase-config.js',
  './style.css','./app.js','./schedule.js','./firebase.js','./manifest.json'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request))));
