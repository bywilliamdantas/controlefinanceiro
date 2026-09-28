// Service worker simples: cacheia o "app shell" no install e serve
// tudo (cache-first, com fallback pra rede) depois disso, permitindo
// abrir o app offline após a primeira visita.
var CACHE_NAME = "financeiro-v15";
var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/utils.js",
  "./js/icons.js",
  "./js/state.js",
  "./js/charts.js",
  "./js/security.js",
  "./js/notifications.js",
  "./js/backup.js",
  "./js/render.js",
  "./js/sheets.js",
  "./js/main.js",
  "./assets/icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

// Clique numa notificação: foca a janela do app já aberta, ou abre uma nova.
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if ("focus" in clientList[i]) return clientList[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});

// Periodic Background Sync: onde o navegador suportar (poucos suportam hoje),
// permite checar lembretes mesmo com o app fechado. Sem servidor de push,
// isso é o melhor que dá pra fazer nativamente num app estático.
self.addEventListener("periodicsync", function (event) {
  if (event.tag === "checar-lembretes") {
    event.waitUntil(
      self.registration.showNotification("Controle Financeiro", {
        body: "Abra o app para ver suas contas a vencer.",
        icon: "assets/icon.png",
        tag: "lembretes-financeiro"
      })
    );
  }
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
        return resp;
      }).catch(function () {
        if (event.request.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
