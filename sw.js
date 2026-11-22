// =========================================================================
// EAPOS PWA — SERVICE WORKER NETWORK-FIRST BLINDADO PARA CLOUD OTA (v4.9.2)
// Design by EA Perez Corp.
// =========================================================================
const EAPOS_PWA_CACHE = 'eapos-pwa-v4.9.2';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== EAPOS_PWA_CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

function esRecursoExcluidoRedDirecta(request) {
    if (!request || request.method !== 'GET') return true;
    let urlObj;
    try {
        urlObj = new URL(request.url);
    } catch (e) {
        return true;
    }
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return true;
    const hrefLower = urlObj.href.toLowerCase();
    if (
        hrefLower.includes('supabase.co') ||
        hrefLower.includes('imgbb.com') ||
        hrefLower.includes('dolarapi.com')
    ) {
        return true;
    }
    return false;
}

function esArchivoAppCacheable(request) {
    try {
        const urlObj = new URL(request.url);
        if (urlObj.origin !== self.location.origin) return false;
        const path = urlObj.pathname.toLowerCase();
        if (request.mode === 'navigate' || path === '/' || path.endsWith('/')) return true;
        return /\.(html|js|css|json|png|jpg|jpeg|webp|svg|ico)$/i.test(path);
    } catch (e) {
        return false;
    }
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    // EXCLUSIÓN OBLIGATORIA: Bypass directo a la red sin interceptar ni cachear
    if (esRecursoExcluidoRedDirecta(req)) return;
    if (!esArchivoAppCacheable(req)) return;

    // ESTRATEGIA NETWORK-FIRST: siempre intenta traer la versión fresca de internet
    event.respondWith(
        fetch(req)
            .then((networkRes) => {
                if (networkRes && networkRes.ok && networkRes.status === 200) {
                    const copia = networkRes.clone();
                    caches.open(EAPOS_PWA_CACHE).then((cache) => cache.put(req, copia)).catch(() => {});
                }
                return networkRes;
            })
            .catch(() => caches.match(req).then((cached) => cached || caches.match('./index.html')))
    );
});
