const CACHE_NAME='ilr-erp-280-static';
self.addEventListener('install',event=>{self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(req.mode==='navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/supabase.js') || url.pathname.endsWith('/service-worker.js')){
    event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(req)));
    return;
  }
  event.respondWith(fetch(req).then(res=>{if(res&&res.ok&&url.origin===self.location.origin){const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy));}return res;}).catch(()=>caches.match(req)));
});
