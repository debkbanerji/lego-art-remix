// IMPORTANT: Run rebuild steps when making logic changes
const VERSION_NUMBER = "v2022.12.11";

// Rebuild steps
// TODO: add a package.json and script to run all deployment steps
// 1. Update VERSION_NUMBER in this file
// 2. Update VERSION_NUMBER in `app/js/index.js`
// 3. Run `npm install workbox-build` if it hasn't been run
// 4. Run `node build-service-worker.js`
// 5. Copy files from `app` into the static deployment thingy

const workboxBuild = require("workbox-build");
const buildSW = () => {
    return workboxBuild.generateSW({
        globDirectory: "app",
        globPatterns: ["**/*.{html,json,js,css,pdf,png,onnx}"],
        swDest: "app/service-worker.js",
        sourcemap: false,
        cacheId: VERSION_NUMBER,
        cleanupOutdatedCaches: true,
    });
};

buildSW();
