const CACHE='todaycock-shell-20261104';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('todaycock-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 if(!/\\.(?:html|js|css)$/.test(new URL(req.url).pathname)&&req.mode!=='navigate')return;
 event.respondWith(fetch(new Request(req,{cache:'no-store'})).then(response=>{
   if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
   return response;
 }).catch(()=>caches.match(req)));
});
