const CACHE_NAME = "cache-v2021.10.21";
const assetToCache = [
    "/index.html",
    "/favicon.png",
    "/",
    "/manifest.json",
    "/examples/lego-art-remix-discount-hogwarts-crest-instructions.pdf",
    "/examples/lego-art-remix-discount-hogwarts-crest.png",
    "/examples/lenna-depth.png",
    "/examples/lenna.png",
    "/models/MODEL_LICENSE",
    "/models/model-small.onnx",
    "/js/algo.js",
    "/js/bricklink-colors.js",
    "/js/depth-map-web-worker.js",
    "/js/index.js",
    "/js/metrics.js",
    "/js/ndarray-browser-min.js",
    "/js/onnx.min.js",
    "/js/pixi.min.js",
    "/js/stud-maps.js",
    "https://cdn.jsdelivr.net/npm/bootstrap@4.6.0/dist/css/bootstrap.min.css",
    "https://www.gstatic.com/firebasejs/7.19.0/firebase-app.js",
    "https://www.gstatic.com/firebasejs/7.19.0/firebase-database.js",
    "https://code.jquery.com/jquery-3.2.1.slim.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js",
    "https://cdn.jsdelivr.net/npm/bootstrap@4.6.0/dist/js/bootstrap.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/1.5.3/jspdf.debug.js",
    "https://d3js.org/d3.v5.js",
    "https://cdn.jsdelivr.net/npm/d3-color-difference"
];
self.addEventListener("install", function(event) {
    event.waitUntil(
        caches
        .open(CACHE_NAME)
        .then(function(cache) {
            return cache.addAll(assetToCache);
        })
        .catch(console.error)
    );
});
self.addEventListener("fetch", function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) {
                return response;
            }
            return fetch(event.request);
        })
    );
});
