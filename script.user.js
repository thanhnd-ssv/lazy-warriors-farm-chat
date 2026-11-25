// ==UserScript==
// @name         Lazy Warriors Farm Chat
// @namespace    local.lazy-warriors-farm-chat
// @version      1.0
// @description  Guild Chat userscript for SSV Farm.
// @match        https://at-sp.ssvhue.work/*
// @require      https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm-chat/refs/heads/main/guild-chat.js?v=1.0
// @updateURL    https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm-chat/refs/heads/main/script.meta.js
// @downloadURL  https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm-chat/refs/heads/main/script.user.js
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      gstatic.com
// @connect      server.wallpaperalchemy.com
// @connect      cdn-media.sforum.vn
// @connect      raw.githubusercontent.com
// @connect      firebaseio.com
// @connect      firebasedatabase.app
// @connect      identitytoolkit.googleapis.com
// @connect      securetoken.googleapis.com
// ==/UserScript==

(function () {
  "use strict";

  if (window.top !== window.self) return;

  const gmGetValue =
    typeof globalThis.GM_getValue === "function"
      ? globalThis.GM_getValue.bind(globalThis)
      : typeof globalThis.GM?.getValue === "function"
        ? (key, fallback) => globalThis.GM.getValue(key, fallback)
        : (key, fallback) => {
            try {
              const raw = localStorage.getItem(String(key));
              return raw === null ? fallback : JSON.parse(raw);
            } catch (_error) {
              return fallback;
            }
          };

  const gmSetValue =
    typeof globalThis.GM_setValue === "function"
      ? globalThis.GM_setValue.bind(globalThis)
      : typeof globalThis.GM?.setValue === "function"
        ? (key, value) => globalThis.GM.setValue(key, value)
        : (key, value) => {
            try {
              localStorage.setItem(String(key), JSON.stringify(value));
            } catch (_error) {}
          };

  function createGmRequestFallback() {
    if (typeof globalThis.fetch !== "function") return null;
    return (details = {}) => {
      const controller =
        typeof globalThis.AbortController === "function"
          ? new globalThis.AbortController()
          : null;
      let timedOut = false;
      let timeoutId = null;
      const timeoutMs = Number(details.timeout);

      if (controller && Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timeoutId = globalThis.setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);
      }

      const run = async () => {
        const init = {
          method: details.method || "GET",
          headers: details.headers || undefined,
        };
        if (controller) init.signal = controller.signal;
        if (details.data !== undefined && init.method !== "GET" && init.method !== "HEAD") {
          init.body = details.data;
        }

        const response = await globalThis.fetch(details.url, init);
        const status = response.status;
        let responseText = "";
        let responseData;

        if (details.responseType === "arraybuffer") {
          responseData = await response.arrayBuffer();
          responseText = "";
        } else {
          responseText = await response.text();
          responseData = responseText;
        }

        if (typeof details.onload === "function") {
          details.onload({
            status,
            statusText: response.statusText || "",
            responseText,
            response: responseData,
            readyState: 4,
            finalUrl: response.url || details.url,
          });
        }
      };

      Promise.resolve()
        .then(run)
        .catch((error) => {
          if (timedOut) {
            if (typeof details.ontimeout === "function") details.ontimeout(error);
            return;
          }
          if (typeof details.onerror === "function") details.onerror(error);
        })
        .finally(() => {
          if (timeoutId != null) globalThis.clearTimeout(timeoutId);
        });
    };
  }

  const gmRequest = (() => {
    const gmObject = typeof GM !== "undefined" ? GM : globalThis.GM;
    const native =
      typeof globalThis.GM_xmlhttpRequest === "function"
        ? globalThis.GM_xmlhttpRequest.bind(globalThis)
        : typeof globalThis.GM_xmlHttpRequest === "function"
          ? globalThis.GM_xmlHttpRequest.bind(globalThis)
          : gmObject && typeof gmObject.xmlHttpRequest === "function"
            ? (details) => gmObject.xmlHttpRequest(details)
            : gmObject && typeof gmObject.GM_xmlhttpRequest === "function"
              ? (details) => gmObject.GM_xmlhttpRequest(details)
              : null;
    return native || createGmRequestFallback();
  })();

  if (!globalThis.GuildChatModule) {
    console.error("[Lazy Warriors Farm Chat] Guild Chat module did not load.");
    return;
  }

  if (typeof gmRequest !== "function") {
    console.error("[Lazy Warriors Farm Chat] GM_xmlhttpRequest is unavailable.");
    return;
  }

  try {
    globalThis.GuildChatModule.mount({
      getValue: (key, fallback) => gmGetValue(key, fallback),
      setValue: (key, value) => gmSetValue(key, value),
      request: (options) => gmRequest(options),
      updateUrl:
        "https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm-chat/refs/heads/main/script.user.js",
    });
  } catch (error) {
    console.error(
      "[Lazy Warriors Farm Chat] Guild Chat module initialization failed.",
      error,
    );
  }
})();
