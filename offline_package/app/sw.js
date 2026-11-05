/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "097670b497362c183fab780924dae9ef"
  }, {
    "url": "pwa-512x512.png",
    "revision": "c18ed8adb9f398c8209c71582d8d513a"
  }, {
    "url": "pwa-192x192.png",
    "revision": "76f14a790545e02e694aa00a8e3914b3"
  }, {
    "url": "index.html",
    "revision": "9c80e1f7b6b449a7c63e36df3011230b"
  }, {
    "url": "icon.svg",
    "revision": "431acfd8fe1d905b8e8ad7b7ae488baf"
  }, {
    "url": "icon-maskable.svg",
    "revision": "674df38ecbdfea57f064c387fa7ec2eb"
  }, {
    "url": "favicon.png",
    "revision": "4625d0cad1c25f0de810fd3506c8f081"
  }, {
    "url": "favicon.ico",
    "revision": "c1839f4fdeb65382d6d94dff9beb4683"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "f7fa1ddf9c23e60875eba6dfb0463a86"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/index-Cd492XYs.js",
    "revision": null
  }, {
    "url": "assets/index-CAfYitNV.css",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "f7fa1ddf9c23e60875eba6dfb0463a86"
  }, {
    "url": "favicon.ico",
    "revision": "c1839f4fdeb65382d6d94dff9beb4683"
  }, {
    "url": "favicon.png",
    "revision": "4625d0cad1c25f0de810fd3506c8f081"
  }, {
    "url": "icon-maskable.svg",
    "revision": "674df38ecbdfea57f064c387fa7ec2eb"
  }, {
    "url": "icon.svg",
    "revision": "431acfd8fe1d905b8e8ad7b7ae488baf"
  }, {
    "url": "manifest.json",
    "revision": "dfb2a2e5dacb968a8dc7c4d037a28a36"
  }, {
    "url": "pwa-192x192.png",
    "revision": "76f14a790545e02e694aa00a8e3914b3"
  }, {
    "url": "pwa-512x512.png",
    "revision": "c18ed8adb9f398c8209c71582d8d513a"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "097670b497362c183fab780924dae9ef"
  }, {
    "url": "manifest.webmanifest",
    "revision": "7b23b18f08cf7f45ef5c0876d40bb788"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 20,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
