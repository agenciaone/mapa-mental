'use strict';
window.MM = window.MM || {};

(function (MM) {
  const U = {};

  U.uid = function () {
    if (window.crypto && crypto.getRandomValues) {
      const b = crypto.getRandomValues(new Uint8Array(10));
      return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  };

  U.clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  U.debounce = function (fn, ms) {
    let t = null;
    const d = function (...args) {
      clearTimeout(t);
      t = setTimeout(() => { t = null; fn.apply(this, args); }, ms);
    };
    d.flush = function () { if (t) { clearTimeout(t); t = null; fn(); } };
    d.pending = () => t !== null;
    return d;
  };

  U.downloadBlob = function (blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  U.safeFilename = function (name) {
    const s = String(name || 'mapa').normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_ ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
    return s || 'mapa';
  };

  U.formatDate = function (ts) {
    try {
      return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (e) {
      return new Date(ts).toISOString();
    }
  };

  /** Normaliza um link digitado. Retorna null se o esquema não for seguro. */
  U.safeUrl = function (raw) {
    let s = String(raw || '').trim();
    if (!s) return null;
    if (/^[a-z][a-z0-9+.-]*:/i.test(s) === false) {
      s = (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? 'mailto:' : 'https://') + s;
    }
    let u;
    try { u = new URL(s); } catch (e) { return null; }
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol)) return null;
    return u.href.slice(0, 2000);
  };

  U.readFileAsText = function (file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  };

  U.pickFile = function (accept) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept;
      inp.style.display = 'none';
      inp.addEventListener('change', () => { resolve(inp.files[0] || null); inp.remove(); });
      document.body.appendChild(inp);
      inp.click();
    });
  };

  /** Cria elemento HTML. Textos sempre via textContent (seguro contra injeção). */
  U.h = function (tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  };

  U.SVGNS = 'http://www.w3.org/2000/svg';
  U.s = function (tag, attrs) {
    const el = document.createElementNS(U.SVGNS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
    return el;
  };

  U.icon = function (name, cls) {
    const svg = U.s('svg', { class: 'ic' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
    svg.appendChild(U.s('use', { href: '#i-' + name }));
    return svg;
  };

  // ---------- cores ----------
  U.isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

  U.hexToRgb = function (hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(U.clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');

  U.mix = function (a, b, t) {
    const x = U.hexToRgb(a), y = U.hexToRgb(b);
    return U.rgbToHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
  };

  U.luminance = function (hex) {
    const c = U.hexToRgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };

  U.contrastText = (hex) => (U.luminance(hex) > 0.4 ? '#1b2027' : '#ffffff');

  U.clone = (o) => (typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)));

  MM.U = U;
})(window.MM);
