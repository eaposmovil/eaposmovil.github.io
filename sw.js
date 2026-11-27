// =========================================================================
// EAPOS PWA — SERVICE WORKER NETWORK-FIRST BLINDADO PARA WEBAPK Y CLOUD OTA
// Design by EA Perez Corp.
// =========================================================================
const EAPOS_PWA_CACHE = 'eapos-pwa-v5.2.0';
const EAPOS_FOTOS_CACHE_PROTEGIDO = 'eapos-fotos-validas-v1';

// Sin cache.addAll en install para evitar bloqueos o fallos en el WebAPK Minting Server
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== EAPOS_PWA_CACHE && k !== EAPOS_FOTOS_CACHE_PROTEGIDO).map((k) => caches.delete(k))))
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
    // Bypass obligatorio para APIs en tiempo real (Supabase/OTA, Cloudflare R2, DolarAPI)
    if (
        hrefLower.includes('supabase.co') ||
        hrefLower.includes('r2.dev') ||
        hrefLower.includes('dolarapi.com')
    ) {
        return true;
    }
    // Bypass obligatorio para manifest.json, sw.js e íconos PNG (evita interferencias con WebAPK)
    const pathLower = urlObj.pathname.toLowerCase();
    if (
        pathLower.endsWith('/manifest.json') ||
        pathLower.endsWith('/sw.js') ||
        /\.(png|jpg|jpeg|webp|svg|ico)$/i.test(pathLower)
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
        return /\.(html|js|css)$/i.test(path);
    } catch (e) {
        return false;
    }
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (esRecursoExcluidoRedDirecta(req)) return;
    if (!esArchivoAppCacheable(req)) return;

    // ESTRATEGIA NETWORK-FIRST: siempre trae la versión fresca de internet; fallback solo offline
    event.respondWith(
        fetch(req)
            .then((networkRes) => {
                if (networkRes && networkRes.ok && networkRes.status === 200) {
                    const copia = networkRes.clone();
                    caches.open(EAPOS_PWA_CACHE).then((cache) => cache.put(req, copia)).catch(() => {});
                }
                return networkRes;
            })
            .catch(() =>
                caches.match(req).then((cached) => {
                    if (cached) return cached;
                    if (req.mode === 'navigate') return caches.match('/index.html');
                    return new Response('', { status: 503, statusText: 'Offline' });
                })
            )
    );
});
