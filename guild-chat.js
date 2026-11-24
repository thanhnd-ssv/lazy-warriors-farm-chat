(function (global) {
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBTy82Yu5YLGn8R2Tyufu2CV8E2E0-ze2A",
    databaseURL: "https://web-workflow-utility-chat-default-rtdb.firebaseio.com",
  };
  const CHAT_BACKGROUND_URLS = {
    morning:
      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4EiZLl_gbVaIcNMU4SfslA0wWnTwWujRL6joCZOUb33pJsvNaj_L4n0m0&s=10",
    afternoon:
      "https://server.wallpaperalchemy.com/storage/wallpapers/2487/anime-cat-napping-on-green-grass-wallpaper.jpg",
    evening:
      "https://cdn-media.sforum.vn/storage/app/media/ctvseo_maihue/hinh-nen-ghibli/hinh-nen-ghibli-49.jpg",
  };
  const CHAT_BACKGROUND_CHANGE_MINUTES = [60, 12 * 60, 17 * 60 + 30];
  const AUTH_STORAGE_KEY = "web-workflow-utility.guild-chat.auth";
  const PROFILE_STORAGE_KEY = "web-workflow-utility.guild-chat.profile";
  const CHAT_TITLE = "😴 Lazy Farm 🌾";
  const CHARACTER_AVATARS = [
    "👨‍🌾", "👩‍🌾", "🧑", "👩‍🍳", "👨", "👩", "👴",
    "👵", "👦", "👧", "👶", "🤡", "🧙", "🧛", "🧟", "👽", "🐷",
    "🐶", "🐱", "🐰", "🐟", "🐼", "🦄",
  ];
  const LEGACY_CHARACTER_AVATARS = ["👨‍🍳"];
  const EMOJI_CATEGORIES = [
    {
      label: "Biểu cảm",
      icon: "😀",
      emojis: [
        "😀", "😃", "😄", "😁", "😆", "😂", "🤣", "😊", "😍", "🥰", "😘",
        "😎", "🤔", "😴", "🥱", "😭", "😢", "😡", "🤬", "🤪", "😜", "🥳",
        "🥶", "🥵",
      ],
    },
    {
      label: "Tương tác",
      icon: "👍",
      emojis: [
        "👍", "👎", "👌", "✌️", "🤝", "👏", "🙌", "💪", "🙏", "👀",
        "👉", "👈", "👋", "🤟", "❤️",
      ],
    },
    {
      label: "Cây, trái cây",
      icon: "🌷",
      emojis: [
        "🌷", "🌴", "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🍑", "🥭",
        "🍍", "🥥", "🌽", "🥕", "🍄",
      ],
    },
    {
      label: "Động vật",
      icon: "🐯",
      emojis: [
        "🐯", "🐼", "🦄", "🦚", "🦜", "🦢", "🐟", "🦐", "🦀", "🦈", "🐮",
        "🐄", "🐷", "🐔", "🐑", "🐰", "🦆",
      ],
    },
    {
      label: "Vật phẩm",
      icon: "🎁",
      emojis: [
        "💰", "💵", "💎", "🎁", "🎀", "🏆", "🥇", "⭐", "🔥", "💯", "🎉",
        "🎊", "🎯",
      ],
    },
  ];
  const MAX_HISTORY = 150;
  const MAX_MESSAGE_LENGTH = 500;
  const MIN_NICKNAME_LENGTH = 2;
  const MAX_NICKNAME_LENGTH = 12;
  const MESSAGE_COOLDOWN_MS = 1_500;
  const MESSAGE_POLL_INTERVAL_MS = 3_000;
  const AUTH_TOKEN_REFRESH_BUFFER_MS = 60_000;
  const AUTH_SIGN_UP_URL =
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`;
  const AUTH_REFRESH_URL =
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`;

  function withTimeout(promise, timeoutMs, message) {
    let timeoutId;
    const timeout = new Promise((resolve, reject) => {
      timeoutId = global.setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() => {
      global.clearTimeout(timeoutId);
    });
  }

  function requestJson(request, method, url, data, headers) {
    return withTimeout(new Promise((resolve, reject) => {
      try {
        request({
          method,
          url,
          timeout: 20_000,
          headers:
            headers ||
            (data === undefined ? {} : { "Content-Type": "application/json" }),
          data:
            data === undefined
              ? undefined
              : typeof data === "string"
                ? data
                : JSON.stringify(data),
          onload(response) {
            const status = Number(response.status) || 0;
            const responseText = response.responseText || "";
            let result = null;
            if (responseText) {
              try {
                result = JSON.parse(responseText);
              } catch (error) {
                reject(new Error("Firebase returned an invalid JSON response."));
                return;
              }
            }

            if (status < 200 || status >= 300) {
              const details = result && result.error;
              const message =
                typeof details === "string"
                  ? details
                  : details && (details.message || details.status) ||
                    (typeof result === "string" ? result : null);
              const requestError = new Error(
                message || `Firebase request failed (HTTP ${status}).`,
              );
              requestError.status = status;
              requestError.code =
                details && (details.message || details.status);
              reject(requestError);
              return;
            }

            resolve(result);
          },
          onerror() {
            reject(new Error("Tampermonkey could not reach Firebase."));
          },
          ontimeout() {
            reject(new Error("Firebase request timed out."));
          },
          onabort() {
            reject(new Error("Firebase request was aborted."));
          },
        });
      } catch (error) {
        reject(error);
      }
    }), 25_000, "Firebase request timed out.");
  }

  function getChatBackgroundTheme(date) {
    const minuteOfDay = date.getHours() * 60 + date.getMinutes();
    if (minuteOfDay >= 60 && minuteOfDay < 12 * 60) {
      return "morning";
    }
    if (minuteOfDay >= 12 * 60 && minuteOfDay < 17 * 60 + 30) {
      return "afternoon";
    }
    return "evening";
  }

  function getChatBackgroundUrl(date) {
    return CHAT_BACKGROUND_URLS[getChatBackgroundTheme(date)];
  }

  function millisecondsUntilNextBackgroundChange(date) {
    const minuteOfDay = date.getHours() * 60 + date.getMinutes();
    const nextChange = CHAT_BACKGROUND_CHANGE_MINUTES.find(
      (minute) => minute > minuteOfDay,
    );
    const minutesUntilChange =
      nextChange === undefined
        ? 24 * 60 - minuteOfDay + CHAT_BACKGROUND_CHANGE_MINUTES[0]
        : nextChange - minuteOfDay;
    return (
      minutesUntilChange * 60_000 -
      date.getSeconds() * 1_000 -
      date.getMilliseconds()
    );
  }

  function loadChatBackground(request, url) {
    return new Promise((resolve, reject) => {
      try {
        request({
          method: "GET",
          url,
          timeout: 20_000,
          responseType: "arraybuffer",
          onload(response) {
            const status = Number(response.status) || 0;
            if (status < 200 || status >= 300) {
              reject(new Error(`Chat background request failed (HTTP ${status}).`));
              return;
            }
            if (
              !response.response ||
              typeof response.response.byteLength !== "number"
            ) {
              reject(new Error("Chat background response was not binary."));
              return;
            }

            try {
              const bytes = new Uint8Array(response.response);
              let binary = "";
              const chunkSize = 0x8000;
              for (let offset = 0; offset < bytes.length; offset += chunkSize) {
                binary += String.fromCharCode(
                  ...bytes.subarray(offset, offset + chunkSize),
                );
              }
              resolve(`data:image/jpeg;base64,${global.btoa(binary)}`);
            } catch (error) {
              reject(error);
            }
          },
          onerror() {
            reject(new Error("Unable to download the chat background image."));
          },
          ontimeout() {
            reject(new Error("Chat background image request timed out."));
          },
          onabort() {
            reject(new Error("Chat background image request was aborted."));
          },
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function capitalizeFirstCharacter(value) {
    const firstCharacter = Array.from(value)[0];
    return firstCharacter
      ? firstCharacter.toLocaleUpperCase("vi-VN") + value.slice(firstCharacter.length)
      : value;
  }

  function isCharacterAvatar(value) {
    return (
      typeof value === "string" &&
      (CHARACTER_AVATARS.includes(value) ||
        LEGACY_CHARACTER_AVATARS.includes(value))
    );
  }

  function randomCharacterAvatar() {
    return CHARACTER_AVATARS[Math.floor(Math.random() * CHARACTER_AVATARS.length)];
  }

  function fallbackCharacterAvatar(uid) {
    let hash = 0;
    for (const character of uid) {
      hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
    }
    return CHARACTER_AVATARS[hash % CHARACTER_AVATARS.length];
  }

  function mount({
    getValue,
    setValue,
    request,
    onVisibilityChange,
    updateUrl,
  }) {
    if (typeof request !== "function") {
      throw new Error("Tampermonkey request API chưa được cấu hình.");
    }
    let updateLinkUrl;
    try {
      updateLinkUrl = new global.URL(updateUrl);
    } catch (error) {
      throw new Error("URL cập nhật userscript chưa được cấu hình hợp lệ.");
    }
    if (
      updateLinkUrl.protocol !== "https:" ||
      updateLinkUrl.hostname !== "raw.githubusercontent.com"
    ) {
      throw new Error("URL cập nhật userscript phải dùng raw.githubusercontent.com.");
    }

    const host = document.createElement("div");
    Object.assign(host.style, {
      position: "fixed",
      right: "12px",
      bottom: "12px",
      zIndex: "2147483647",
    });
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { color-scheme: light; font: 13px/1.45 "Trebuchet MS", system-ui, sans-serif; }
        * { box-sizing: border-box; }
        .guild-chat-launch {
          position: relative; display: grid; place-items: center;
          width: 52px; height: 52px; min-height: 52px; padding: 0;
          color: #fff; background: linear-gradient(145deg, #d77b9b, #b84d76);
          border: 2px solid #fff; border-radius: 50%;
          box-shadow: 0 5px 16px #63344c55;
          font-size: 24px; line-height: 1; cursor: pointer;
          touch-action: none; user-select: none; -webkit-user-select: none;
        }
        .guild-chat-launch[hidden] { display: none; }
        .launch-unread {
          position: absolute; top: -3px; right: -4px;
          display: grid; place-items: center; min-width: 20px; height: 20px;
          padding: 0 4px; color: #fff; background: #d94358;
          border: 2px solid #fff; border-radius: 999px;
          font: 700 10px/1 system-ui, sans-serif;
        }
        .launch-unread[hidden] { display: none; }
        .panel {
          --panel-bg: #e6efd9;
          --panel-border: #fffdf4;
          --panel-shadow: #4e694a45;
          --panel-edge: #b5d69e;
          --header-bg: rgba(255, 254, 250, .12);
          --header-border: #dfe9c8;
          --header-text: #5f754f;
          --close-bg: #fffdf4;
          --close-border: #ccdbaa;
          --close-text: #617153;
          --incoming-bg: #fffdf1;
          --incoming-border: #e1dca9;
          --incoming-text: #536148;
          --outgoing-bg: #d7e9af;
          --outgoing-border: #bdd68e;
          --outgoing-text: #536148;
          --meta-text: #859270;
          --time-text: #9aa48e;
          --composer-bg: rgba(255, 253, 242, .42);
          --composer-border: #dde8c2;
          --input-text: #4f6045;
          --placeholder-text: #89957b;
          --send-bg: #b9d98e;
          --send-border: #a7c97c;
          --send-text: #526945;
          position: relative; display: flex; flex-direction: column; width: min(280px, calc(100vw - 24px));
          height: min(370px, calc(100vh - 24px));
          min-height: min(340px, calc(100vh - 24px)); overflow: hidden;
          color: #4d5d43; background-color: var(--panel-bg);
          border: 3px solid var(--panel-border); border-radius: 22px;
          box-shadow: 0 14px 38px var(--panel-shadow), 0 3px 0 var(--panel-edge);
        }
        .panel[data-theme="morning"] {
          --panel-bg: #fae5ed;
          --panel-border: #a94368;
          --panel-shadow: #87304b55;
          --panel-edge: #87304b;
          --header-bg: #c9577e;
          --header-border: #a94368;
          --header-text: #fff8fb;
          --close-bg: #ffeaf1;
          --close-border: #f0bfd0;
          --close-text: #8b3654;
          --incoming-bg: #fff5f8;
          --incoming-border: #e9b9cb;
          --incoming-text: #663449;
          --outgoing-bg: #f2bfd0;
          --outgoing-border: #d790a8;
          --outgoing-text: #663449;
          --meta-text: #86586a;
          --time-text: #966f7e;
          --composer-bg: rgba(255, 246, 250, .95);
          --composer-border: #d58ca7;
          --input-text: #60364a;
          --placeholder-text: #906d7b;
          --send-bg: #c9577e;
          --send-border: #a94368;
          --send-text: #fff8fb;
        }
        .panel[data-theme="afternoon"] {
          --panel-bg: #eaf2e2;
          --panel-border: #527d43;
          --panel-shadow: #385e3155;
          --panel-edge: #3e682f;
          --header-bg: #648d50;
          --header-border: #527d43;
          --header-text: #f7fff2;
          --close-bg: #f2fae9;
          --close-border: #c5dcb3;
          --close-text: #426435;
          --incoming-bg: #f8fff2;
          --incoming-border: #c9dda9;
          --incoming-text: #3f5533;
          --outgoing-bg: #d1e8bd;
          --outgoing-border: #a8cd83;
          --outgoing-text: #3f5533;
          --meta-text: #68805b;
          --time-text: #849679;
          --composer-bg: rgba(247, 253, 240, .95);
          --composer-border: #a8c58b;
          --input-text: #3e5434;
          --placeholder-text: #768a69;
          --send-bg: #729f57;
          --send-border: #527d43;
          --send-text: #fff;
        }
        .panel[data-theme="evening"] {
          --panel-bg: #e4eaf3;
          --panel-border: #284a78;
          --panel-shadow: #19365b66;
          --panel-edge: #1d3c66;
          --header-bg: #284a78;
          --header-border: #1d3c66;
          --header-text: #f5f8ff;
          --close-bg: #edf3fc;
          --close-border: #b4c4db;
          --close-text: #294a73;
          --incoming-bg: #f3f6fd;
          --incoming-border: #c1cde0;
          --incoming-text: #31435d;
          --outgoing-bg: #c9d9f0;
          --outgoing-border: #9db5d7;
          --outgoing-text: #273f61;
          --meta-text: #637791;
          --time-text: #7c8da3;
          --composer-bg: rgba(245, 248, 255, .95);
          --composer-border: #9eb2d0;
          --input-text: #2f4563;
          --placeholder-text: #71839b;
          --send-bg: #3e6397;
          --send-border: #284a78;
          --send-text: #fff;
        }
        .panel[hidden] { display: none; }
        .header {
          display: flex; align-items: center; justify-content: space-between;
          gap: 8px; padding: 2px 10px 2px 10px;
          background: var(--header-bg);
          border-bottom: 2px solid var(--header-border);
        }
        .heading { display: grid; gap: 2px; min-width: 0; }
        .heading strong { color: var(--header-text); font-size: 15px; letter-spacing: .1px; }
        .connection { display: none; }
        .header-actions { display: flex; gap: 5px; }
        .header-actions .header-icon {
          display: grid; place-items: center;
          width: 32px; height: 32px; min-height: 32px; padding: 0;
          color: var(--close-text); background: var(--close-bg);
          border: 1.5px solid var(--close-border); border-radius: 10px;
          font: 18px/1 system-ui, sans-serif;
        }
        .header-actions .header-icon svg { width: 16px; height: 16px; }
        .header-actions a.header-icon { text-decoration: none; }
        .header-actions .header-icon:hover:not(:disabled) { filter: brightness(.97); }
        .header-actions .reload[disabled] svg {
          animation: chat-refresh-spin .8s linear infinite;
        }
        @keyframes chat-refresh-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .header-actions .reload[disabled] svg { animation: none; }
        }
        button, input { font: inherit; }
        button {
          min-height: 32px; padding: 5px 10px; color: #617153;
          background: #fffdf4; border: 1.5px solid #ccdbaa;
          border-radius: 10px; cursor: pointer;
        }
        button:hover:not(:disabled) { background: #f2f8df; }
        button:disabled { opacity: .6; cursor: wait; }
        .header .close {
          color: var(--close-text); background: var(--close-bg);
          border-color: var(--close-border);
        }
        .header .close:hover:not(:disabled) { filter: brightness(.97); }
        .content {
          display: flex; flex: 1; min-height: 0; flex-direction: column;
          background-position: center; background-size: cover; background-repeat: no-repeat;
        }
        .join, .chat { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 9px; padding: 12px; }
        .join[hidden], .chat[hidden] { display: none; }
        .connection-loading {
          display: grid; flex: 1; place-items: center; padding: 24px;
          color: #65745b; background: rgba(255, 253, 244, .88);
          border-radius: 16px; font-size: 12px; text-align: center;
        }
        .connection-loading[hidden] { display: none; }
        .join {
          justify-content: center; overflow-y: auto;
          padding: 18px;
          background:
            radial-gradient(circle at 88% 14%, #fff9c9 0 22px, transparent 23px),
            radial-gradient(ellipse at 12% 100%, #92bd72 0 19%, transparent 20%),
            radial-gradient(ellipse at 92% 104%, #a8cc7f 0 24%, transparent 25%),
            linear-gradient(180deg, #d5edf0 0 38%, #e8f2d1 72%, #d5e7ad 100%);
        }
        .join-card {
          display: flex; flex: 0 0 auto; flex-direction: column; gap: 12px;
          width: 100%; padding: 20px 17px 15px;
          background: #fffdf4ed; border: 1px solid #fff;
          border-radius: 20px; box-shadow: 0 8px 24px #647b4c24;
        }
        .join-intro { display: grid; gap: 3px; margin-bottom: 2px; text-align: center; }
        .join-intro strong { color: #5e754d; font-size: 18px; }
        .join-intro span { color: #89957b; font-size: 11px; }
        .join label {
          display: flex; flex-direction: column; width: 100%; gap: 5px;
          color: #65745b; font-size: 11px; font-weight: 700;
        }
        .avatar-section { display: grid; gap: 5px; }
        .avatar-label { display: flex; justify-content: space-between; gap: 6px; color: #65745b; font-size: 11px; font-weight: 700; }
        .avatar-hint { color: #89957b; font-size: 10px; font-weight: 400; }
        .avatar-trigger {
          display: flex; align-items: center; gap: 8px; width: 100%; min-height: 40px;
          padding: 5px 9px; color: #526148; background: #fffef9;
          border: 1.5px solid #cbdba9; border-radius: 12px; text-align: left;
        }
        .avatar-trigger-preview {
          display: grid; flex: 0 0 27px; place-items: center;
          width: 27px; height: 27px; background: #e6f2d2;
          border-radius: 50%; font-size: 18px; line-height: 1;
        }
        .avatar-trigger-label { flex: 1; font-size: 12px; }
        .avatar-trigger-chevron { color: #89957b; font-size: 12px; }
        .avatar-popover {
          position: absolute; inset: 0; z-index: 4;
          display: grid; place-items: center; padding: 14px;
          background: rgba(32, 43, 34, .42); border-radius: 19px;
        }
        .avatar-popover[hidden] { display: none; }
        .avatar-dialog {
          display: grid; gap: 10px; width: min(270px, 100%);
          max-height: 100%; overflow-y: auto; padding: 12px;
          color: #526148; background: #fffdf4;
          border: 1px solid #e1e9ce; border-radius: 16px;
          box-shadow: 0 10px 28px #26322540;
        }
        .avatar-dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .avatar-dialog-title { font-size: 13px; }
        .avatar-dialog-close { width: 28px; min-width: 28px; min-height: 28px; padding: 0; }
        .avatar-options { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; }
        .avatar-option {
          min-width: 0; min-height: 34px; padding: 0; font-size: 19px; line-height: 1;
        }
        .avatar-option[aria-pressed="true"] {
          background: #e6f2d2; border-color: #85b36c;
          box-shadow: 0 0 0 2px #a4c87535;
        }
        input {
          display: block; width: 100%; min-height: 40px; padding: 8px 11px;
          color: #4f6045; background: #fffef9; border: 1.5px solid #cbdba9;
          border-radius: 12px; outline: none;
        }
        input:focus { border-color: #92b66d; box-shadow: 0 0 0 3px #a4c87525; }
        .primary { color: #526945; background: #dceea7; border-color: #b7d486; font-weight: 800; }
        .join-button { width: 100%; min-height: 38px; }
        .notice { min-height: 18px; color: #a96f58; font-size: 11px; overflow-wrap: anywhere; }
        .chat {
          position: relative;
          isolation: isolate;
          gap: 6px;
          padding: 8px 8px 4px;
          background: transparent;
        }
        .messages {
          display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 7px;
          overflow-y: auto; margin: 0; padding: 5px 5px 12px; list-style: none;
          border-radius: 14px;
          background: transparent;
        }
        .message {
          display: flex; align-items: flex-end; gap: 5px;
          width: 100%; max-width: 100%; align-self: flex-start;
          overflow-wrap: anywhere;
        }
        .message.group-continuation { margin-top: -5px; }
        .message.group-continuation .message-author { display: none; }
        .message.group-continuation .message-meta { display: none; }
        .message.group-continuation:not(.self) .message-bubble {
          border-top-left-radius: 5px;
        }
        .message.self.group-continuation .message-bubble {
          border-top-right-radius: 5px;
        }
        .message-body {
          display: flex; align-items: flex-end; gap: 4px;
          min-width: 0; max-width: calc(100% - 37px);
        }
        .message-bubble {
          min-width: 42px; max-width: 100%; padding: 8px 10px;
          background: var(--incoming-bg); border: 1.5px solid var(--incoming-border);
          border-radius: 13px 13px 13px 4px;
          box-shadow: 0 2px 7px #6f795c18;
          color: var(--incoming-text);
        }
        .message.self { align-self: flex-end; justify-content: flex-end; }
        .message.self .message-bubble {
          background: var(--outgoing-bg); border-color: var(--outgoing-border);
          border-radius: 13px 13px 4px 13px;
          color: var(--outgoing-text);
        }
        .message.self .message-body { justify-content: flex-end; }
        .message-avatar {
          flex: 0 0 auto; width: 32px; height: 32px;
          display: grid; place-items: center;
          background: #fffaf0; border: 2px solid #fff;
          border-radius: 50%; box-shadow: 0 2px 6px #65734f24;
          font-size: 18px;
        }
        .message-avatar.is-hidden { visibility: hidden; }
        .message.self .message-avatar { order: 2; }
        .message-meta { display: flex; min-width: 0; color: var(--meta-text); font-size: 10px; }
        .message-author { overflow: hidden; min-width: 0; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
        .message-time {
          display: block; width: 100%; margin-top: 3px;
          color: var(--time-text); opacity: .8;
          font-size: 8px; line-height: 1; text-align: right; white-space: nowrap;
        }
        .message-text { margin: 2px 0 0; font-size: 14px; white-space: pre-wrap; }
        .unread {
          min-height: 16px; padding: 0 4px;
          color: #6f8b58; font-size: 10px; text-align: center;
        }
        .composer { position: relative; flex: 0 0 auto; margin-top: auto; }
        .emoji-picker {
          position: absolute; right: 0; bottom: calc(100% + 8px); z-index: 3;
          width: min(260px, calc(100vw - 32px));
          padding: 7px; background: #fffdf6; border: 1px solid #e4dcae;
          border-radius: 13px; box-shadow: 0 6px 20px #53614835;
        }
        .emoji-picker[hidden] { display: none; }
        .emoji-tabs {
          display: flex; gap: 3px; overflow-x: auto; padding: 0 0 6px;
          border-bottom: 1px solid #ece7cf;
        }
        .emoji-tab {
          flex: 0 0 29px; width: 29px; min-height: 29px; padding: 0;
          border: 0; background: transparent; font-size: 16px;
        }
        .emoji-tab[aria-selected="true"] { background: #e8f0d2; }
        .emoji-category-title {
          display: block; margin: 6px 2px 3px; color: #788667;
          font-size: 10px; font-weight: 700; white-space: nowrap;
        }
        .emoji-grid {
          display: grid; grid-template-columns: repeat(6, 1fr); gap: 2px;
          max-height: 178px; overflow-y: auto;
        }
        .emoji-option {
          display: grid; place-items: center; width: 100%; min-height: 30px;
          padding: 0; border: 0; background: transparent; font-size: 18px;
        }
        .emoji-option:hover { background: #f3edcf; }
        .send {
          display: flex; gap: 5px; padding: 6px;
          background: var(--composer-bg); border: 2px solid var(--composer-border);
          border-radius: 15px; box-shadow: 0 3px 10px #6c7d5520;
        }
        .chat-notice:empty { display: none; }
        .send input {
          flex: 1; min-width: 0; border: 0; background: transparent;
          min-height: 40px; color: var(--input-text); font-size: 13px;
        }
        .send input:focus { box-shadow: none; }
        .send input::placeholder { color: var(--placeholder-text); opacity: 1; }
        .emoji-button {
          display: grid; place-items: center;
          width: 40px; min-width: 40px; min-height: 40px; padding: 0;
          border-color: transparent; background: transparent; font-size: 20px;
        }
        .send-button {
          display: grid; place-items: center;
          width: 44px; min-width: 44px; min-height: 40px; padding: 5px;
          border-radius: 11px;
          color: var(--send-text); background: var(--send-bg); border-color: var(--send-border);
        }
        .send-button:hover:not(:disabled) { filter: brightness(.96); }
        .send-button svg { width: 18px; height: 18px; }
        .toast {
          position: absolute; right: 0; bottom: calc(100% + 8px);
          max-width: min(340px, calc(100vw - 24px)); padding: 8px 11px;
          color: #617153; background: #fffdf4; border: 1.5px solid #b9d69a;
          border-radius: 12px; box-shadow: 0 6px 18px #0002;
        }
        .toast[hidden] { display: none; }
        @media (max-width: 480px) {
          .guild-chat-launch { width: 45px; height: 45px; min-height: 45px; }
          .guild-chat-launch > span:first-child { font-size: 20px; }
          .panel {
            width: min(345px, calc(100vw - 12px));
            height: min(450px, calc(100vh - 12px));
            min-height: min(340px, calc(100vh - 12px));
          }
        }
      </style>
      <button type="button" class="guild-chat-launch" aria-label="Mở chat" title="Mở chat">
        <span aria-hidden="true">💬</span>
        <span class="launch-unread" hidden></span>
      </button>
      <div class="toast" role="status" hidden></div>
      <section class="panel" aria-label="${CHAT_TITLE}" hidden>
        <header class="header">
          <div class="heading">
            <strong>${CHAT_TITLE}</strong>
            <span class="connection">Chưa kết nối</span>
          </div>
          <div class="header-actions">
            <button type="button" class="header-icon reload" aria-label="Làm mới chat" title="Làm mới chat">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 7v5h-5"></path>
                <path d="M4 17v-5h5"></path>
                <path d="M5.6 9a7 7 0 0 1 11.6-2L20 12M4 12l2.8 5a7 7 0 0 0 11.6-2"></path>
              </svg>
            </button>
            <a class="header-icon update" aria-label="Cập nhật userscript" title="Cập nhật userscript" target="_blank" rel="noopener noreferrer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <path d="m7 10 5 5 5-5"></path>
                <path d="M12 15V3"></path>
              </svg>
            </a>
            <button type="button" class="close" aria-label="Đóng chat">×</button>
          </div>
        </header>
        <div class="content">
          <div class="connection-loading" role="status">Đang khôi phục phiên chat...</div>
          <form class="join" hidden>
            <div class="join-card">
              <label>Nickname
                <input class="nickname" minlength="2" maxlength="12" autocomplete="nickname" required>
              </label>
              <label>Mã mời hội
                <input class="invite-code" maxlength="64" autocomplete="off" required>
              </label>
              <div class="avatar-section">
                <div class="avatar-label">
                  <span>Avatar nhân vật</span>
                  <span class="avatar-hint">Tùy chọn</span>
                </div>
                <button type="button" class="avatar-trigger" aria-haspopup="dialog" aria-expanded="false">
                  <span class="avatar-trigger-preview" aria-hidden="true">🎲</span>
                  <span class="avatar-trigger-label">Ngẫu nhiên</span>
                  <span class="avatar-trigger-chevron" aria-hidden="true">▾</span>
                </button>
              </div>
              <button type="submit" class="primary join-button">Vào hội</button>
              <div class="join-notice notice" role="status"></div>
            </div>
          </form>
          <section class="chat" hidden>
            <ol class="messages" aria-live="polite" aria-label="Tin nhắn"></ol>
            <div class="chat-notice notice" role="status"></div>
            <div class="composer">
              <div class="emoji-picker" role="dialog" aria-label="Chọn emoji" hidden>
                <div class="emoji-tabs" role="tablist" aria-label="Nhóm emoji"></div>
                <strong class="emoji-category-title"></strong>
                <div class="emoji-grid" id="emoji-options" role="tabpanel"></div>
              </div>
              <form class="send">
                <input class="message-input" maxlength="500" autocomplete="off" placeholder="Nhập tin nhắn..." aria-label="Tin nhắn" required>
                <button type="button" class="emoji-button" aria-label="Mở bảng emoji" aria-haspopup="dialog" aria-expanded="false" title="Chọn emoji">🙂</button>
                <button type="submit" class="primary send-button" aria-label="Gửi tin nhắn" title="Gửi tin nhắn">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M22 2 11 13"></path>
                    <path d="m22 2-7 20-4-9-9-4 20-7Z"></path>
                  </svg>
                </button>
              </form>
            </div>
          </section>
        </div>
        <div class="avatar-popover" hidden>
          <section class="avatar-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-dialog-title">
            <div class="avatar-dialog-header">
              <strong class="avatar-dialog-title" id="avatar-dialog-title">Chọn avatar nhân vật</strong>
              <button type="button" class="avatar-dialog-close" aria-label="Đóng chọn avatar">×</button>
            </div>
            <span class="avatar-hint">Bỏ qua để chọn ngẫu nhiên</span>
            <div class="avatar-options" role="group" aria-label="Chọn avatar nhân vật"></div>
          </section>
        </div>
      </section>
    `;
    const inlineStyle = shadow.querySelector("style");
    if (
      typeof global.CSSStyleSheet === "function" &&
      "adoptedStyleSheets" in shadow
    ) {
      const stylesheet = new global.CSSStyleSheet();
      stylesheet.replaceSync(inlineStyle.textContent);
      shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, stylesheet];
      inlineStyle.remove();
    }
    document.body.append(host);

    const panel = shadow.querySelector(".panel");
    const updateLink = shadow.querySelector(".header-actions .update");
    updateLink.href = updateLinkUrl.href;
    updateLink.hidden = false;
    const reloadButton = shadow.querySelector(".header-actions .reload");
    const launchButton = shadow.querySelector(".guild-chat-launch");
    const launchUnread = shadow.querySelector(".launch-unread");
    const content = shadow.querySelector(".content");
    const connectionLoading = shadow.querySelector(".connection-loading");
    const connectionLabel = shadow.querySelector(".connection");
    const joinForm = shadow.querySelector(".join");
    const nicknameInput = shadow.querySelector(".nickname");
    const inviteCodeInput = shadow.querySelector(".invite-code");
    const avatarOptions = shadow.querySelector(".avatar-options");
    const avatarTrigger = shadow.querySelector(".avatar-trigger");
    const avatarTriggerPreview = shadow.querySelector(".avatar-trigger-preview");
    const avatarTriggerLabel = shadow.querySelector(".avatar-trigger-label");
    const avatarPopover = shadow.querySelector(".avatar-popover");
    const avatarDialogClose = shadow.querySelector(".avatar-dialog-close");
    const joinButton = shadow.querySelector(".join-button");
    const joinNotice = shadow.querySelector(".join-notice");
    const chatView = shadow.querySelector(".chat");
    const messagesList = shadow.querySelector(".messages");
    const messageInput = shadow.querySelector(".message-input");
    const emojiButton = shadow.querySelector(".emoji-button");
    const emojiPicker = shadow.querySelector(".emoji-picker");
    const emojiTabs = shadow.querySelector(".emoji-tabs");
    const emojiCategoryTitle = shadow.querySelector(".emoji-category-title");
    const emojiGrid = shadow.querySelector(".emoji-grid");
    const sendButton = shadow.querySelector(".send-button");
    const chatNotice = shadow.querySelector(".chat-notice");
    const toast = shadow.querySelector(".toast");

    const HOST_MARGIN_PX = 6;
    let suppressLauncherClick = false;
    let launcherHostPlacement = null;

    function getViewportSize() {
      const viewport = global.visualViewport;
      return {
        width: viewport ? viewport.width : global.innerWidth,
        height: viewport ? viewport.height : global.innerHeight,
        offsetLeft: viewport ? viewport.offsetLeft : 0,
        offsetTop: viewport ? viewport.offsetTop : 0,
      };
    }

    function setHostPosition(left, top) {
      host.style.left = `${Math.round(left)}px`;
      host.style.top = `${Math.round(top)}px`;
      host.style.right = "auto";
      host.style.bottom = "auto";
    }

    function clampHostToViewport() {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const viewport = getViewportSize();
      const minLeft = viewport.offsetLeft + HOST_MARGIN_PX;
      const minTop = viewport.offsetTop + HOST_MARGIN_PX;
      const maxLeft = Math.max(
        minLeft,
        viewport.offsetLeft + viewport.width - rect.width - HOST_MARGIN_PX,
      );
      const maxTop = Math.max(
        minTop,
        viewport.offsetTop + viewport.height - rect.height - HOST_MARGIN_PX,
      );
      const left = Math.min(Math.max(rect.left, minLeft), maxLeft);
      const top = Math.min(Math.max(rect.top, minTop), maxTop);
      setHostPosition(left, top);
    }

    function saveLauncherPosition() {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      void writeValue(LAUNCHER_POSITION_STORAGE_KEY, {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
      });
    }

    function captureLauncherHostPlacement() {
      return {
        left: host.style.left,
        top: host.style.top,
        right: host.style.right,
        bottom: host.style.bottom,
      };
    }

    function restoreLauncherHostPlacement(placement) {
      if (!placement) return;
      host.style.left = placement.left || "";
      host.style.top = placement.top || "";
      host.style.right = placement.right || "";
      host.style.bottom = placement.bottom || "";
    }

    function moveHostToDefaultPanelPosition() {
      host.style.left = "auto";
      host.style.top = "auto";
      host.style.right = "12px";
      host.style.bottom = "12px";
    }

    void (async () => {
      try {
        const saved = await readValue(LAUNCHER_POSITION_STORAGE_KEY, null);
        if (
          saved &&
          Number.isFinite(saved.left) &&
          Number.isFinite(saved.top)
        ) {
          setHostPosition(saved.left, saved.top);
          global.requestAnimationFrame(() => {
            clampHostToViewport();
          });
        }
      } catch (_error) {
        // Ignore invalid or unavailable stored launcher position.
      }
    })();

    global.addEventListener("resize", () => {
      if (host.style.left !== "auto" || host.style.top !== "auto") {
        clampHostToViewport();
      }
    });
    if (global.visualViewport) {
      global.visualViewport.addEventListener("resize", () => {
        if (host.style.left !== "auto" || host.style.top !== "auto") {
          clampHostToViewport();
        }
      });
    }

    let launcherDragState = null;

    function stopLauncherDrag(event) {
      if (!launcherDragState) return;
      if (
        event &&
        launcherDragState.pointerId != null &&
        event.pointerId !== launcherDragState.pointerId
      ) {
        return;
      }
      const { moved, pointerId } = launcherDragState;
      launcherDragState = null;
      if (launchButton.hasPointerCapture?.(pointerId)) {
        launchButton.releasePointerCapture(pointerId);
      }
      launchButton.style.cursor = "";
      if (moved) {
        suppressLauncherClick = true;
        global.setTimeout(() => {
          suppressLauncherClick = false;
        }, 0);
        clampHostToViewport();
        saveLauncherPosition();
      }
    }

    launchButton.addEventListener("pointerdown", (event) => {
      if (event.button != null && event.button !== 0) return;
      const rect = host.getBoundingClientRect();
      launcherDragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originLeft: rect.left,
        originTop: rect.top,
        moved: false,
      };
      if (launchButton.setPointerCapture) {
        try {
          launchButton.setPointerCapture(event.pointerId);
        } catch (_error) {
          // Ignore pointer capture failures on unsupported platforms.
        }
      }
    });

    launchButton.addEventListener("pointermove", (event) => {
      if (
        !launcherDragState ||
        event.pointerId !== launcherDragState.pointerId
      ) {
        return;
      }
      const deltaX = event.clientX - launcherDragState.startX;
      const deltaY = event.clientY - launcherDragState.startY;
      if (!launcherDragState.moved) {
        if (Math.hypot(deltaX, deltaY) < 6) return;
        launcherDragState.moved = true;
        launchButton.style.cursor = "grabbing";
      }
      setHostPosition(
        launcherDragState.originLeft + deltaX,
        launcherDragState.originTop + deltaY,
      );
      event.preventDefault();
    });

    launchButton.addEventListener("pointerup", stopLauncherDrag);
    launchButton.addEventListener("pointercancel", stopLauncherDrag);

    let selectedAvatar = null;
    function updateAvatarTrigger() {
      avatarTriggerPreview.textContent = selectedAvatar || "🎲";
      avatarTriggerLabel.textContent = selectedAvatar
        ? "Avatar đã chọn"
        : "Chọn avatar";
      avatarTrigger.setAttribute(
        "aria-label",
        selectedAvatar
          ? `Avatar đã chọn: ${selectedAvatar}`
          : "Chọn avatar; bỏ qua để chọn ngẫu nhiên",
      );
      avatarTrigger.title = selectedAvatar
        ? `Avatar đã chọn: ${selectedAvatar}`
        : "Bỏ qua để chọn avatar ngẫu nhiên";
    }

    function closeAvatarPicker(restoreFocus) {
      avatarPopover.hidden = true;
      avatarTrigger.setAttribute("aria-expanded", "false");
      if (restoreFocus) avatarTrigger.focus();
    }

    const randomAvatarButton = createElement("button", "avatar-option", "🎲");
    randomAvatarButton.type = "button";
    randomAvatarButton.setAttribute("aria-label", "Chọn avatar ngẫu nhiên");
    randomAvatarButton.setAttribute("aria-pressed", "true");
    avatarOptions.append(randomAvatarButton);
    for (const avatar of CHARACTER_AVATARS) {
      const option = createElement("button", "avatar-option", avatar);
      option.type = "button";
      option.dataset.avatar = avatar;
      option.setAttribute("aria-label", avatar);
      option.setAttribute("aria-pressed", "false");
      avatarOptions.append(option);
    }
    avatarOptions.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const option = target.closest("button.avatar-option");
      if (!option || !avatarOptions.contains(option)) return;
      selectedAvatar = isCharacterAvatar(option.dataset.avatar)
        ? option.dataset.avatar
        : null;
      for (const button of avatarOptions.children) {
        button.setAttribute("aria-pressed", String(button === option));
      }
      updateAvatarTrigger();
      closeAvatarPicker(true);
    });
    updateAvatarTrigger();
    avatarTrigger.addEventListener("click", () => {
      avatarPopover.hidden = false;
      avatarTrigger.setAttribute("aria-expanded", "true");
      const selectedOption = avatarOptions.querySelector(
        'button[aria-pressed="true"]',
      );
      if (selectedOption) selectedOption.focus();
    });
    avatarDialogClose.addEventListener("click", () => {
      closeAvatarPicker(true);
    });
    avatarPopover.addEventListener("click", (event) => {
      if (event.target === avatarPopover) closeAvatarPicker(true);
    });

    populateEmojiPicker();
    const backgroundCache = new Map();
    let backgroundRequestVersion = 0;
    const backgroundOverlays = {
      morning:
        "linear-gradient(rgba(255, 235, 244, .16), rgba(255, 235, 244, .16))",
      afternoon:
        "linear-gradient(rgba(239, 249, 230, .15), rgba(239, 249, 230, .15))",
      evening:
        "linear-gradient(rgba(19, 39, 68, .18), rgba(19, 39, 68, .18))",
    };
    function updateChatBackground() {
      const theme = getChatBackgroundTheme(new Date());
      const url = CHAT_BACKGROUND_URLS[theme];
      const backgroundOverlay = backgroundOverlays[theme];
      const requestVersion = ++backgroundRequestVersion;
      const cachedImage = backgroundCache.get(url);
      panel.dataset.theme = theme;
      content.style.backgroundImage = backgroundOverlay;

      const imagePromise = cachedImage
        ? Promise.resolve(cachedImage)
        : loadChatBackground(request, url);
      imagePromise
        .then((imageDataUrl) => {
          backgroundCache.set(url, imageDataUrl);
          if (
            requestVersion !== backgroundRequestVersion ||
            getChatBackgroundUrl(new Date()) !== url
          ) {
            return;
          }
          content.style.backgroundImage =
            `${backgroundOverlay}, url("${imageDataUrl}")`;
        })
        .catch((error) => {
          console.error(
            "[Web Workflow Utility] Guild Chat background failed.",
            error,
          );
        });
    }
    function scheduleNextBackgroundChange() {
      const delay = millisecondsUntilNextBackgroundChange(new Date());
      global.setTimeout(() => {
        updateChatBackground();
        scheduleNextBackgroundChange();
      }, delay);
    }
    updateChatBackground();
    scheduleNextBackgroundChange();

    let user = null;
    let membership = null;
    let messagePolling = false;
    let connectionPromise = null;
    let connectionAttempt = 0;
    let authSession = null;
    let currentIdToken = null;
    let idTokenExpiresAt = 0;
    let tokenRefreshPromise = null;
    let initialMessagesLoaded = false;
    let unreadCount = 0;
    let lastSentAt = 0;
    let toastTimer = null;
    const renderedMessageKeys = new Set();

    async function readValue(key, fallback) {
      try {
        const value = await withTimeout(
          Promise.resolve().then(() => getValue(key, fallback)),
          10_000,
          "Đọc phiên chat quá thời gian chờ.",
        );
        return value === undefined ? fallback : value;
      } catch (error) {
        console.error("[Web Workflow Utility] Guild Chat storage read failed.", error);
        throw error;
      }
    }

    async function writeValue(key, value) {
      try {
        await withTimeout(
          Promise.resolve().then(() => setValue(key, value)),
          10_000,
          "Lưu phiên chat quá thời gian chờ.",
        );
      } catch (error) {
        console.error("[Web Workflow Utility] Guild Chat storage write failed.", error);
        throw error;
      }
    }

    async function saveAuthTokens(result, uid) {
      const idToken = result && (result.id_token || result.idToken);
      const refreshToken = result && (result.refresh_token || result.refreshToken);
      const expiresIn = result && (result.expires_in || result.expiresIn);
      if (
        typeof idToken !== "string" ||
        typeof refreshToken !== "string" ||
        !Number.isFinite(Number(expiresIn))
      ) {
        throw new Error("Firebase Authentication returned an incomplete token response.");
      }

      const sessionUid = result.localId || result.user_id || uid;
      if (typeof sessionUid !== "string" || !sessionUid) {
        throw new Error("Firebase Authentication did not return a user ID.");
      }

      authSession = {
        uid: sessionUid,
        refreshToken,
      };
      currentIdToken = idToken;
      idTokenExpiresAt =
        Date.now() + Math.max(Number(expiresIn), 1) * 1000;
      user = { uid: sessionUid };
      await writeValue(AUTH_STORAGE_KEY, authSession);
    }

    async function refreshAuthToken(forceRefresh) {
      if (!authSession || typeof authSession.refreshToken !== "string") {
        throw new Error("Firebase Authentication session is missing its refresh token.");
      }
      if (
        !forceRefresh &&
        currentIdToken &&
        idTokenExpiresAt - Date.now() > AUTH_TOKEN_REFRESH_BUFFER_MS
      ) {
        return currentIdToken;
      }
      if (tokenRefreshPromise) return tokenRefreshPromise;

      const refreshToken = authSession.refreshToken;
      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString();
      tokenRefreshPromise = requestJson(
        request,
        "POST",
        AUTH_REFRESH_URL,
        body,
        { "Content-Type": "application/x-www-form-urlencoded" },
      )
        .then(async (result) => {
          await saveAuthTokens(
            {
              id_token: result && result.id_token,
              refresh_token: result && result.refresh_token,
              expires_in: result && result.expires_in,
              user_id: result && result.user_id,
            },
            authSession.uid,
          );
          return currentIdToken;
        })
        .finally(() => {
          tokenRefreshPromise = null;
        });
      return tokenRefreshPromise;
    }

    async function databaseRequest(method, path, data, query) {
      let idToken = await refreshAuthToken(false);
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const parameters = new URLSearchParams(query || {});
        parameters.set("auth", idToken);
        const encodedPath = path
          .split("/")
          .map((segment) => encodeURIComponent(segment))
          .join("/");
        const url =
          `${FIREBASE_CONFIG.databaseURL}/${encodedPath}.json?${parameters.toString()}`;
        try {
          return await requestJson(request, method, url, data);
        } catch (error) {
          if (
            attempt === 0 &&
            error.status === 401 &&
            /expired/i.test(error.message)
          ) {
            idToken = await refreshAuthToken(true);
            continue;
          }
          throw new Error(
            `${error.message} (lỗi khi ${databaseOperationLabel(method, path)})`,
          );
        }
      }
      throw new Error("Firebase request could not be completed.");
    }

    function databaseGet(path, query) {
      return databaseRequest("GET", path, undefined, query);
    }

    function databaseSet(path, value) {
      return databaseRequest("PUT", path, value);
    }

    function databasePatch(path, value) {
      return databaseRequest("PATCH", path, value);
    }

    function databasePush(path, value) {
      return databaseRequest("POST", path, value);
    }

    function databaseOperationLabel(method, path) {
      const segments = path.split("/");
      if (segments[0] === "guildInvites") return "đọc mã mời";
      if (segments[0] === "guilds" && segments[2] === "members") {
        if (method === "PUT") return "tạo hồ sơ thành viên";
        if (method === "PATCH") return "cập nhật avatar thành viên";
        return "đọc hồ sơ thành viên";
      }
      return "truy cập dữ liệu chat";
    }

    function setNotice(element, message) {
      element.textContent = message;
    }

    function updateUnread() {
      launchUnread.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      launchUnread.hidden = unreadCount === 0;
      const unreadSummary = unreadCount
        ? ` (${unreadCount} tin nhắn chưa đọc)`
        : "";
      launchButton.setAttribute("aria-label", `Mở ${CHAT_TITLE}${unreadSummary}`);
      launchButton.title = `Mở ${CHAT_TITLE}${unreadSummary}`;
    }

    function showToast(message) {
      toast.textContent = message;
      toast.hidden = false;
      if (toastTimer !== null) global.clearTimeout(toastTimer);
      toastTimer = global.setTimeout(() => {
        toast.hidden = true;
        toastTimer = null;
      }, 4_000);
    }

    function isChatVisible() {
      return !panel.hidden;
    }

    function insertEmoji(emoji) {
      const start = Number.isInteger(messageInput.selectionStart)
        ? messageInput.selectionStart
        : messageInput.value.length;
      const end = Number.isInteger(messageInput.selectionEnd)
        ? messageInput.selectionEnd
        : start;
      messageInput.setRangeText(emoji, start, end, "end");
      messageInput.focus();
    }

    function populateEmojiPicker() {
      for (const [index, category] of EMOJI_CATEGORIES.entries()) {
        const tab = createElement("button", "emoji-tab", category.icon);
        tab.type = "button";
        tab.id = `emoji-tab-${index}`;
        tab.dataset.categoryIndex = String(index);
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-label", category.label);
        tab.setAttribute("aria-controls", "emoji-options");
        tab.setAttribute("aria-selected", "false");
        tab.title = category.label;
        tab.tabIndex = index === 0 ? 0 : -1;
        emojiTabs.append(tab);
      }
      selectEmojiCategory(0);
    }

    function selectEmojiCategory(index) {
      const category = EMOJI_CATEGORIES[index];
      if (!category) return;

      emojiCategoryTitle.textContent = category.label;
      emojiGrid.replaceChildren();
      emojiGrid.setAttribute("aria-label", category.label);
      for (const emoji of category.emojis) {
        const option = createElement("button", "emoji-option", emoji);
        option.type = "button";
        option.dataset.emoji = emoji;
        option.setAttribute("aria-label", emoji);
        emojiGrid.append(option);
      }

      for (const [tabIndex, tab] of Array.from(emojiTabs.children).entries()) {
        const selected = tabIndex === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
      }
      emojiGrid.setAttribute("aria-labelledby", `emoji-tab-${index}`);
    }

    function validGuildId(value) {
      return typeof value === "string" && /^[A-Za-z0-9_-]{1,48}$/.test(value);
    }

    function memberPath(guildId, uid) {
      return `guilds/${guildId}/members/${uid}`;
    }

    function showChat(profile) {
      membership = profile;
      connectionLoading.hidden = true;
      joinForm.hidden = true;
      chatView.hidden = false;
      setNotice(joinNotice, "");
      if (isChatVisible()) startMessageListener();
    }

    function appendMessage(key, data) {
      if (
        !data ||
        typeof data.uid !== "string" ||
        typeof data.nickname !== "string" ||
        typeof data.text !== "string" ||
        !Number.isFinite(data.createdAt)
      ) {
        console.warn("[Web Workflow Utility] Ignored malformed Guild Chat message.", key);
        return;
      }

      if (renderedMessageKeys.has(key)) return;
      renderedMessageKeys.add(key);

      const item = createElement("li", "message");
      item.dataset.messageKey = key;
      item.dataset.uid = data.uid;
      const senderName = capitalizeFirstCharacter(data.nickname);
      const senderAvatar = isCharacterAvatar(data.avatar)
        ? data.avatar
        : fallbackCharacterAvatar(data.uid);
      item.dataset.senderIdentity =
        `${senderName.normalize("NFC").toLowerCase()}|${senderAvatar}`;
      if (user && data.uid === user.uid) item.classList.add("self");
      const previousMessage = messagesList.lastElementChild;
      if (
        previousMessage &&
        (previousMessage.dataset.uid === data.uid ||
          previousMessage.dataset.senderIdentity === item.dataset.senderIdentity)
      ) {
        item.classList.add("group-continuation");
        const previousAvatar = previousMessage.querySelector(".message-avatar");
        if (previousAvatar) previousAvatar.classList.add("is-hidden");
      }

      const avatar = createElement(
        "span",
        "message-avatar",
        senderAvatar,
      );
      avatar.setAttribute("aria-hidden", "true");

      const bubble = createElement("div", "message-bubble");
      const meta = createElement("div", "message-meta");
      const identity = createElement(
        "span",
        "message-author",
        senderName,
      );
      const time = createElement(
        "time",
        "message-time",
        new Date(data.createdAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
      meta.append(identity);
      const text = createElement("p", "message-text", data.text);
      bubble.append(meta, text);
      const body = createElement("div", "message-body");
      bubble.append(time);
      body.append(bubble);
      item.append(avatar, body);
      messagesList.append(item);

      while (messagesList.children.length > MAX_HISTORY) {
        const oldestMessage = messagesList.firstElementChild;
        renderedMessageKeys.delete(oldestMessage.dataset.messageKey);
        oldestMessage.remove();
        const firstMessage = messagesList.firstElementChild;
        if (firstMessage) firstMessage.classList.remove("group-continuation");
      }

      if (initialMessagesLoaded && user && data.uid !== user.uid) {
        if (isChatVisible()) {
          messagesList.scrollTop = messagesList.scrollHeight;
        } else {
          unreadCount += 1;
          updateUnread();
          showToast(`Tin nhắn mới từ ${identity.textContent}`);
        }
      } else {
        messagesList.scrollTop = messagesList.scrollHeight;
      }
    }

    let lastMessagePollError = null;

    async function fetchMessages() {
      const messages = await databaseGet(
        `guilds/${membership.guildId}/messages`,
        {
          orderBy: JSON.stringify("createdAt"),
          limitToLast: String(MAX_HISTORY),
        },
      );
      if (messages && typeof messages === "object" && !Array.isArray(messages)) {
        const entries = Object.entries(messages).sort((first, second) => {
          const firstTime = Number(first[1] && first[1].createdAt) || 0;
          const secondTime = Number(second[1] && second[1].createdAt) || 0;
          return firstTime - secondTime || first[0].localeCompare(second[0]);
        });
        for (const [key, message] of entries) {
          appendMessage(key, message);
        }
      }
      if (!initialMessagesLoaded) {
        initialMessagesLoaded = true;
        messagesList.scrollTop = messagesList.scrollHeight;
      }
    }

    async function pollMessages() {
      if (!messagePolling || !membership || !user) return;
      try {
        await fetchMessages();
        connectionLabel.textContent = "Đã kết nối · làm mới mỗi 3 giây";
        if (lastMessagePollError) {
          setNotice(chatNotice, "");
          lastMessagePollError = null;
        }
      } catch (error) {
        connectionLabel.textContent = "Mất kết nối · sẽ thử lại...";
        setNotice(chatNotice, `Không tải được tin nhắn: ${error.message}`);
        if (lastMessagePollError !== error.message) {
          console.error("[Web Workflow Utility] Guild Chat polling failed.", error);
          lastMessagePollError = error.message;
        }
      }

      if (messagePolling) {
        global.setTimeout(() => void pollMessages(), MESSAGE_POLL_INTERVAL_MS);
      }
    }

    async function reloadChat() {
      if (reloadButton.disabled) return;
      reloadButton.disabled = true;
      reloadButton.setAttribute("aria-busy", "true");
      try {
        if (!membership || !user) await requestConnection();
        if (!membership || !user) return;
        await fetchMessages();
        connectionLabel.textContent = "Đã kết nối · làm mới mỗi 3 giây";
        setNotice(chatNotice, "");
        lastMessagePollError = null;
        if (isChatVisible()) startMessageListener();
      } catch (error) {
        if (!chatView.hidden) {
          setNotice(chatNotice, `Làm mới chat thất bại: ${error.message}`);
        }
        console.error("[Web Workflow Utility] Guild Chat refresh failed.", error);
      } finally {
        reloadButton.disabled = false;
        reloadButton.removeAttribute("aria-busy");
      }
    }

    function startMessageListener() {
      if (!membership || !user || messagePolling) return;
      messagePolling = true;
      connectionLabel.textContent = "Đã kết nối · làm mới mỗi 3 giây";
      void pollMessages();
    }

    async function signIn() {
      const savedSession = await readValue(AUTH_STORAGE_KEY, null);
      if (
        savedSession &&
        typeof savedSession.uid === "string" &&
        typeof savedSession.refreshToken === "string"
      ) {
        authSession = savedSession;
        try {
          await refreshAuthToken(true);
          return user;
        } catch (error) {
          if (
            !/INVALID_REFRESH_TOKEN|TOKEN_EXPIRED|USER_NOT_FOUND|USER_DISABLED/i.test(
              `${error.code || ""} ${error.message}`,
            )
          ) {
            throw error;
          }
          authSession = null;
          currentIdToken = null;
          idTokenExpiresAt = 0;
          await writeValue(AUTH_STORAGE_KEY, null);
          await writeValue(PROFILE_STORAGE_KEY, null);
        }
      }

      const result = await requestJson(request, "POST", AUTH_SIGN_UP_URL, {
        returnSecureToken: true,
      });
      await saveAuthTokens(result);
      await writeValue(PROFILE_STORAGE_KEY, null);
      return user;
    }

    async function loadSavedMembership(attempt) {
      const saved = await readValue(PROFILE_STORAGE_KEY, null);
      if (attempt !== connectionAttempt) return false;
      if (
        !saved ||
        typeof saved !== "object" ||
        saved.uid !== user.uid ||
        !validGuildId(saved.guildId)
      ) {
        return false;
      }

      const data = await databaseGet(memberPath(saved.guildId, user.uid));
      if (attempt !== connectionAttempt) return false;
      if (!data || typeof data.nickname !== "string") {
        await writeValue(PROFILE_STORAGE_KEY, null);
        return false;
      }

      const avatar = isCharacterAvatar(data.avatar)
        ? data.avatar
        : isCharacterAvatar(saved.avatar)
          ? saved.avatar
          : randomCharacterAvatar();
      if (!isCharacterAvatar(data.avatar)) {
        await databasePatch(memberPath(saved.guildId, user.uid), { avatar });
        if (attempt !== connectionAttempt) return false;
      }

      const profile = {
        guildId: saved.guildId,
        nickname: data.nickname,
        inviteCode: data.inviteCode,
        avatar,
      };
      await writeValue(PROFILE_STORAGE_KEY, { ...profile, uid: user.uid });
      if (attempt !== connectionAttempt) return false;
      showChat(profile);
      return true;
    }

    async function initializeConnection(attempt) {
      connectionLoading.hidden = false;
      connectionLoading.textContent = "Đang kiểm tra phiên đăng nhập...";
      joinForm.hidden = true;
      chatView.hidden = true;
      connectionLabel.textContent = "Đang kết nối...";
      await signIn();
      if (attempt !== connectionAttempt) return;
      if (!user) throw new Error("Firebase Authentication chưa cấp UID.");
      connectionLabel.textContent = "Đã xác thực";

      connectionLoading.textContent = "Đang khôi phục hồ sơ thành viên...";
      const hasMembership = await loadSavedMembership(attempt);
      if (attempt !== connectionAttempt) return;
      if (!hasMembership) {
        connectionLoading.hidden = true;
        joinForm.hidden = false;
        chatView.hidden = true;
        setNotice(joinNotice, "Nhập nickname và mã hội để tham gia.");
      }
    }

    function requestConnection() {
      if (connectionPromise) return connectionPromise;
      const attempt = ++connectionAttempt;
      connectionPromise = withTimeout(
        initializeConnection(attempt),
        30_000,
        "Khôi phục phiên chat quá thời gian chờ. Mở lại chat để thử lại.",
      ).catch((error) => {
        if (attempt === connectionAttempt) {
          connectionAttempt += 1;
          connectionPromise = null;
          connectionLoading.hidden = true;
          joinForm.hidden = false;
          chatView.hidden = true;
          connectionLabel.textContent = "Lỗi kết nối";
          setNotice(
            joinNotice,
            `Không khôi phục được phiên chat: ${error.message}`,
          );
        }
        console.error("[Web Workflow Utility] Guild Chat connection failed.", error);
        throw error;
      });
      return connectionPromise;
    }

    async function joinGuild(event) {
      event.preventDefault();
      setNotice(joinNotice, "");
      const nickname = nicknameInput.value.trim();
      const inviteCode = inviteCodeInput.value.trim().toUpperCase();

      if (
        nickname.length < MIN_NICKNAME_LENGTH ||
        nickname.length > MAX_NICKNAME_LENGTH
      ) {
        setNotice(
          joinNotice,
          `Nickname cần từ ${MIN_NICKNAME_LENGTH} đến ${MAX_NICKNAME_LENGTH} ký tự.`,
        );
        return;
      }
      if (!/^[A-Z0-9]{16,64}$/.test(inviteCode)) {
        setNotice(joinNotice, "Mã hội phải có từ 16 đến 64 ký tự chữ hoặc số.");
        return;
      }
      if (!user) {
        joinButton.disabled = true;
        setNotice(joinNotice, "Đang xác thực tài khoản...");
        try {
          await requestConnection();
        } catch (error) {
          joinButton.disabled = false;
          setNotice(
            joinNotice,
            `Không xác thực được Firebase: ${error.message}`,
          );
          return;
        }
        joinButton.disabled = false;
        if (joinForm.hidden) return;
      }

      joinButton.disabled = true;
      setNotice(joinNotice, "Đang kiểm tra mã hội...");
      try {
        const invite = await databaseGet(`guildInvites/${inviteCode}`);
        if (
          !invite ||
          invite.enabled !== true ||
          !validGuildId(invite.guildId)
        ) {
          throw new Error("Mã hội không hợp lệ hoặc đã bị thu hồi.");
        }

        const path = memberPath(invite.guildId, user.uid);
        let member = await databaseGet(path);
        let avatar;
        if (!member) {
          avatar = isCharacterAvatar(selectedAvatar)
            ? selectedAvatar
            : randomCharacterAvatar();
          member = {
            nickname,
            inviteCode,
            createdAt: { ".sv": "timestamp" },
            avatar,
          };
          await databaseSet(path, member);
          member.nickname = nickname;
        } else {
          setNotice(joinNotice, `Đã tham gia trước đó với nickname "${member.nickname}".`);
          avatar = isCharacterAvatar(member.avatar)
            ? member.avatar
            : isCharacterAvatar(selectedAvatar)
              ? selectedAvatar
              : randomCharacterAvatar();
          if (!isCharacterAvatar(member.avatar)) {
            await databasePatch(path, { avatar });
          }
        }

        const profile = {
          uid: user.uid,
          guildId: invite.guildId,
          nickname: member.nickname,
          avatar,
        };
        await writeValue(PROFILE_STORAGE_KEY, profile);
        nicknameInput.value = "";
        inviteCodeInput.value = "";
        showChat(profile);
      } catch (error) {
        setNotice(joinNotice, `Không tham gia được: ${error.message}`);
        console.error("[Web Workflow Utility] Guild Chat join failed.", error);
      } finally {
        joinButton.disabled = false;
      }
    }

    async function sendMessage(event) {
      event.preventDefault();
      setNotice(chatNotice, "");
      const text = messageInput.value.trim();
      if (!text) {
        setNotice(chatNotice, "Tin nhắn không được để trống.");
        return;
      }
      if (text.length > MAX_MESSAGE_LENGTH) {
        setNotice(chatNotice, `Tin nhắn tối đa ${MAX_MESSAGE_LENGTH} ký tự.`);
        return;
      }
      if (!membership || !user) {
        setNotice(chatNotice, "Bạn chưa tham gia hội.");
        return;
      }
      const remaining = MESSAGE_COOLDOWN_MS - (Date.now() - lastSentAt);
      if (remaining > 0) {
        setNotice(chatNotice, `Vui lòng đợi ${Math.ceil(remaining / 1000)} giây.`);
        return;
      }

      sendButton.disabled = true;
      lastSentAt = Date.now();
      try {
        await databasePush(`guilds/${membership.guildId}/messages`, {
          uid: user.uid,
          nickname: membership.nickname,
          avatar: membership.avatar,
          text,
          createdAt: { ".sv": "timestamp" },
        });
        messageInput.value = "";
        messageInput.focus();
      } catch (error) {
        setNotice(chatNotice, `Gửi tin nhắn thất bại: ${error.message}`);
        console.error("[Web Workflow Utility] Guild Chat send failed.", error);
      } finally {
        sendButton.disabled = false;
      }
    }

    launchButton.addEventListener("click", () => {
      if (suppressLauncherClick) {
        suppressLauncherClick = false;
        return;
      }

      launcherHostPlacement = captureLauncherHostPlacement();
      moveHostToDefaultPanelPosition();
      panel.hidden = false;
      launchButton.hidden = true;
      unreadCount = 0;
      updateUnread();

      global.requestAnimationFrame(() => {
        clampHostToViewport();
      });

      if (typeof onVisibilityChange === "function") {
        onVisibilityChange(true);
      }
      void reloadChat();
    });
    reloadButton.addEventListener("click", () => {
      void reloadChat();
    });
    shadow.querySelector(".close").addEventListener("click", () => {
      panel.hidden = true;
      launchButton.hidden = false;
      restoreLauncherHostPlacement(launcherHostPlacement);
      launcherHostPlacement = null;
      global.requestAnimationFrame(() => {
        clampHostToViewport();
      });
      if (typeof onVisibilityChange === "function") {
        onVisibilityChange(false);
      }
    });
    joinForm.addEventListener("submit", (event) => {
      void joinGuild(event);
    });
    shadow.querySelector(".send").addEventListener("submit", (event) => {
      void sendMessage(event);
    });
    emojiButton.addEventListener("click", () => {
      emojiPicker.hidden = !emojiPicker.hidden;
      emojiButton.setAttribute("aria-expanded", String(!emojiPicker.hidden));
    });
    emojiTabs.addEventListener("click", (event) => {
      const tab = event.target.closest(".emoji-tab");
      if (tab) selectEmojiCategory(Number(tab.dataset.categoryIndex));
    });
    emojiTabs.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const tab = event.target.closest(".emoji-tab");
      if (!tab) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      const currentIndex = Number(tab.dataset.categoryIndex);
      const nextIndex =
        (currentIndex + direction + EMOJI_CATEGORIES.length) %
        EMOJI_CATEGORIES.length;
      selectEmojiCategory(nextIndex);
      emojiTabs.children[nextIndex].focus();
    });
    emojiPicker.addEventListener("click", (event) => {
      const option = event.target.closest(".emoji-option");
      if (!option) return;
      insertEmoji(option.dataset.emoji);
      emojiPicker.hidden = true;
      emojiButton.setAttribute("aria-expanded", "false");
    });
    shadow.addEventListener("click", (event) => {
      if (
        !emojiPicker.hidden &&
        !emojiPicker.contains(event.target) &&
        event.target !== emojiButton
      ) {
        emojiPicker.hidden = true;
        emojiButton.setAttribute("aria-expanded", "false");
      }
    });
    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !avatarPopover.hidden) {
        event.preventDefault();
        closeAvatarPicker(true);
      }
    });
    updateUnread();
  }

  global.GuildChatModule = Object.freeze({ mount });
})(globalThis);
