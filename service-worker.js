const CACHE='ilr-erp-v2.6.4';
const CORE=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.hostname.includes('supabase.co')||u.hostname.includes('esm.sh')) return;
  // Arquivos de lógica devem ser sempre buscados primeiro na rede para evitar JS antigo.
  if(u.origin===self.location.origin && (u.pathname.endsWith('/supabase.js') || u.pathname.endsWith('/service-worker.js'))){
    e.respondWith(fetch(e.request,{cache:'no-store'}).catch(()=>caches.match(e.request)));
    return;
  }
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request,{cache:'no-store'}).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put('./index.html',c));return r;}).catch(()=>caches.match('./index.html')));
    return;
  }
  if(u.origin===self.location.origin)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{const c=n.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return n;})));
});
