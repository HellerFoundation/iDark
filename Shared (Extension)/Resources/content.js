(() => {
  "use strict";

  const STORAGE_KEY = "idark";
  const HOST = location.hostname;

  const DEFAULTS = {
    enabled: true,
    brightness: 0.88,
    contrast: 1,
    saturation: 1,
    warmth: 0,
    siteEnabled: {}
  };

  const SKIP_TAGS = new Set([
    "IMG", "PICTURE", "VIDEO", "CANVAS", "IFRAME", "EMBED", "OBJECT",
    "AUDIO", "SOURCE", "SVG", "PATH", "STYLE", "SCRIPT", "LINK", "META",
    "TITLE", "TEMPLATE", "NOSCRIPT", "HEAD", "BR", "WBR", "HR", "COL",
    "COLGROUP", "TRACK", "PARAM", "METER", "PROGRESS"
  ]);

  let settings = Object.assign({}, DEFAULTS);
  let active = false;
  let scanTimer = null;
  let observer = null;
  let modified = new Set();
  let originals = new WeakMap();

  const root = document.documentElement;

  const flashGuard = document.createElement("style");
  flashGuard.id = "idark-flash-guard";
  flashGuard.textContent =
    "html{background-color:#0b0b0d!important;color:#e8e6e3!important}";
  root.appendChild(flashGuard);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function siteEnabled() {
    const map = settings.siteEnabled;
    if (typeof map === "boolean") return map;
    if (map && Object.prototype.hasOwnProperty.call(map, HOST)) {
      return map[HOST] !== false;
    }
    return true;
  }

  function shouldApply() {
    return !!settings.enabled && siteEnabled();
  }

  function luma(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function parseColor(text) {
    if (!text) return null;
    text = text.trim();
    if (!text || text === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
    const match = text.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(",").map((s) => parseFloat(s));
    if (parts.some((n) => isNaN(n))) return null;
    return {
      r: parts[0],
      g: parts[1],
      b: parts[2],
      a: parts.length > 3 ? parts[3] : 1
    };
  }

  function toRGB(c) {
    return c.a >= 1
      ? "rgb(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + ")"
      : "rgba(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + "," + c.a + ")";
  }

  function mix(c1, c2, t) {
    return {
      r: c1.r * (1 - t) + c2.r * t,
      g: c1.g * (1 - t) + c2.g * t,
      b: c1.b * (1 - t) + c2.b * t,
      a: c1.a
    };
  }

  function applySaturation(c, s) {
    if (s === 1) return c;
    const L = luma(c.r, c.g, c.b);
    if (s < 1) {
      const t = 1 - s;
      return { r: c.r + (L - c.r) * t, g: c.g + (L - c.g) * t, b: c.b + (L - c.b) * t, a: c.a };
    }
    const t = clamp(s - 1, 0, 1);
    return {
      r: clamp(c.r + (c.r - L) * t, 0, 255),
      g: clamp(c.g + (c.g - L) * t, 0, 255),
      b: clamp(c.b + (c.b - L) * t, 0, 255),
      a: c.a
    };
  }

  function palette() {
    const brightness = clamp(settings.brightness, 0.5, 1.3);
    const contrast = clamp(settings.contrast, 0.6, 1.4);
    const warm = clamp(settings.warmth, 0, 0.4);
    const sat = clamp(settings.saturation, 0.1, 2);

    const bgGray = clamp(0.05 + (brightness - 0.5) * 0.35, 0.04, 0.5) * 255;
    let bg = { r: bgGray, g: bgGray, b: bgGray, a: 1 };
    bg.r = clamp(bg.r + warm * 90, 0, 255);
    bg.b = clamp(bg.b - warm * 80, 0, 255);

    const fgGray = clamp(0.75 + (contrast - 1) * 0.3, 0.55, 1) * 255;
    let fg = { r: fgGray, g: fgGray, b: fgGray, a: 1 };
    fg.r = clamp(fg.r + warm * 40, 0, 255);
    fg.b = clamp(fg.b - warm * 40, 0, 255);

    const border = mix(bg, fg, 0.35);

    bg = applySaturation(bg, sat);
    fg = applySaturation(fg, sat);
    return { bg: bg, fg: fg, border: border };
  }

  function modifyBackground(c, p) {
    if (c.a === 0) return null;
    const L = luma(c.r, c.g, c.b) / 255;
    const amount = clamp(L, 0, 1) * 0.88;
    const out = mix(c, p.bg, amount);
    out.a = c.a;
    return toRGB(applySaturation(out, clamp(settings.saturation, 0.1, 2)));
  }

  function modifyForeground(c, p) {
    if (c.a === 0) return null;
    const L = luma(c.r, c.g, c.b) / 255;
    const amount = clamp(1 - L, 0, 1) * 0.9;
    const out = mix(c, p.fg, amount);
    out.a = c.a;
    return toRGB(applySaturation(out, clamp(settings.saturation, 0.1, 2)));
  }

  function modifyBorder(c, p) {
    if (c.a === 0) return null;
    const L = luma(c.r, c.g, c.b) / 255;
    const amount = clamp(L, 0, 1) * 0.75;
    const out = mix(c, p.border, amount);
    out.a = c.a;
    return toRGB(out);
  }

  function applyGlobalStyle() {
    let style = document.getElementById("idark-global-style");
    if (!style) {
      style = document.createElement("style");
      style.id = "idark-global-style";
      root.appendChild(style);
    }
    const p = palette();
    style.textContent =
      "html{color-scheme:dark!important;background-color:" + toRGB(p.bg) + "!important;" +
      "color:" + toRGB(p.fg) + "!important;-webkit-text-fill-color:" + toRGB(p.fg) + "!important}";
  }

  function recordOriginal(el, prop) {
    let entries = originals.get(el);
    if (!entries) originals.set(el, (entries = []));
    for (let i = 0; i < entries.length; i++) {
      if (entries[i][0] === prop) return;
    }
    entries.push([
      prop,
      el.style.getPropertyValue(prop),
      el.style.getPropertyPriority(prop)
    ]);
  }

  function processElement(el, p) {
    const tag = el.tagName;
    if (SKIP_TAGS.has(tag)) return;
    if (tag === "HTML") return;
    if (modified.has(el)) return;

    let cs;
    try {
      cs = getComputedStyle(el);
    } catch (e) {
      return;
    }
    if (cs.display === "none" || cs.visibility === "hidden") return;

    let touched = false;

    const bg = parseColor(cs.backgroundColor);
    if (bg) {
      const v = modifyBackground(bg, p);
      if (v) {
        recordOriginal(el, "background-color");
        el.style.setProperty("background-color", v, "important");
        touched = true;
      }
    }

    const col = parseColor(cs.color);
    if (col) {
      const v = modifyForeground(col, p);
      if (v) {
        recordOriginal(el, "color");
        el.style.setProperty("color", v, "important");
        touched = true;
      }
    }

    const borderProps = [
      "border-top-color", "border-right-color",
      "border-bottom-color", "border-left-color"
    ];
    for (const prop of borderProps) {
      const c = parseColor(cs.getPropertyValue(prop));
      if (c) {
        const v = modifyBorder(c, p);
        if (v) {
          recordOriginal(el, prop);
          el.style.setProperty(prop, v, "important");
          touched = true;
        }
      }
    }

    if (touched) modified.add(el);
  }

  function processAll() {
    if (!active) return;
    const p = palette();
    const all = document.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      processElement(all[i], p);
    }
  }

  function restoreAll() {
    for (const el of modified) {
      const entries = originals.get(el);
      if (!entries) continue;
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (e[1]) el.style.setProperty(e[0], e[1], e[2]);
        else el.style.removeProperty(e[0]);
      }
    }
    modified.clear();
    originals = new WeakMap();
  }

  function removeGlobalStyle() {
    const style = document.getElementById("idark-global-style");
    if (style) style.remove();
  }

  function queueScan() {
    if (!active || scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      processAll();
    }, 180);
  }

  function ensureObserver() {
    if (observer || typeof MutationObserver === "undefined") return;
    observer = new MutationObserver((mutations) => {
      if (!active) return;
      let found = false;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) found = true;
        }
      }
      if (found) queueScan();
    });
    observer.observe(root, { childList: true, subtree: true });
  }

  function activate() {
    active = true;
    const guard = document.getElementById("idark-flash-guard");
    if (guard) guard.remove();
    applyGlobalStyle();
    processAll();
    ensureObserver();
  }

  function deactivate() {
    active = false;
    restoreAll();
    removeGlobalStyle();
    const guard = document.getElementById("idark-flash-guard");
    if (guard) guard.remove();
  }

  function sync() {
    if (shouldApply()) {
      if (active) {
        restoreAll();
        applyGlobalStyle();
        processAll();
      } else {
        activate();
      }
    } else {
      deactivate();
    }
  }

  async function load() {
    try {
      const data = await browser.storage.local.get(STORAGE_KEY);
      settings = Object.assign({}, DEFAULTS, data[STORAGE_KEY] || {});
    } catch (e) {
      settings = Object.assign({}, DEFAULTS);
    }
    sync();
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[STORAGE_KEY]) return;
    settings = Object.assign({}, settings, changes[STORAGE_KEY].newValue || {});
    sync();
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === "idark:ping") {
      sendResponse({ host: HOST, applied: shouldApply() });
    }
    return false;
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync, { once: true });
  }

  load();
})();