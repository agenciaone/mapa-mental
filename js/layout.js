'use strict';
(function (MM) {
  const M = MM.M;
  const L = {};

  L.FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  L.HGAP = 56;
  L.VGAP = 14;
  L.ROOT_VGAP = 26;

  const ctx = document.createElement('canvas').getContext('2d');
  const cache = new Map();

  /** Estilo tipográfico/forma efetivo (sem cores). */
  L.typo = function (map, id) {
    const n = map.nodes[id];
    const d = M.depth(map, id);
    const s = n.style || {};
    const def = d === 0 ? { shape: 'pill', fontSize: 22, bold: true }
      : d === 1 ? { shape: 'rounded', fontSize: 16, bold: true }
        : { shape: 'underline', fontSize: 14, bold: false };
    return {
      depth: d,
      shape: s.shape || def.shape,
      fontSize: s.fontSize || def.fontSize,
      bold: s.bold != null ? s.bold : def.bold,
      italic: !!s.italic,
    };
  };

  L.fontString = (t) => `${t.italic ? 'italic ' : ''}${t.bold ? '700' : '400'} ${t.fontSize}px ${L.FONT}`;

  function wrap(text, maxW) {
    const lines = [];
    let widest = 0;
    const paras = String(text).split('\n');
    for (const para of paras) {
      const words = para.split(/(\s+)/).filter((w) => w.length);
      let line = '';
      const pushLine = (l) => {
        const t = l.replace(/\s+$/, '');
        lines.push(t);
        widest = Math.max(widest, ctx.measureText(t).width);
      };
      for (const w of words) {
        const test = line + w;
        if (ctx.measureText(test.replace(/\s+$/, '')).width <= maxW || !line.trim()) {
          // palavra maior que a largura: quebra por caracteres
          if (!line.trim() && ctx.measureText(w).width > maxW) {
            let chunk = '';
            for (const ch of w) {
              if (ctx.measureText(chunk + ch).width > maxW && chunk) { pushLine(chunk); chunk = ''; }
              chunk += ch;
            }
            line = chunk;
          } else {
            line = test;
          }
        } else {
          pushLine(line);
          line = /^\s+$/.test(w) ? '' : w;
        }
      }
      pushLine(line);
    }
    return { lines, widest };
  }

  /** Geometria de um tópico: largura, altura, linhas de texto. */
  L.box = function (map, id) {
    const n = map.nodes[id];
    const t = L.typo(map, id);
    const icons = (n.note ? 1 : 0) + (n.link ? 1 : 0);
    const element = n.icon && MM.ICONS[n.icon] ? 'icon' : n.emoji ? 'emoji' : null;
    const key = [n.text, t.shape, t.fontSize, t.bold, t.italic, t.depth === 0, icons, element, n.emoji].join('\u0001');
    let g = cache.get(key);
    if (g) return g;

    const fs = t.fontSize;
    ctx.font = L.fontString(t);
    const maxW = t.depth === 0 ? 320 : Math.max(160, 230 + (fs - 14) * 8);
    const elementOnly = !!element && !n.text.trim();
    const shown = n.text.trim() ? n.text : ' ';
    const wrapped = elementOnly ? { lines: [], widest: 0 } : wrap(shown, maxW);
    const lines = wrapped.lines;
    const lineH = Math.round(fs * 1.3);
    const iconSize = Math.max(12, Math.round(fs * 0.85));
    const iconW = icons ? icons * (iconSize + 4) + 2 : 0;
    const elSize = element ? Math.round(fs * (elementOnly ? 2.2 : 1.3)) : 0;
    const elW = element ? elSize + (elementOnly ? 0 : 6) : 0;
    const textW = elementOnly ? 0 : Math.max(wrapped.widest, n.text.trim() ? 0 : fs * 3);
    const textH = Math.max(lines.length * lineH, elSize);

    let padX = Math.round(fs * 0.8) + 4;
    let padY = Math.round(fs * 0.4) + 3;
    if (t.depth === 0) { padX = Math.round(padX * 1.5); padY = Math.round(padY * 1.6); }
    if (t.shape === 'underline' || t.shape === 'none') { padX = 6; padY = 5; }
    if (t.shape === 'pill') padX += Math.round(lineH * 0.25);

    let w = Math.ceil(textW + elW + iconW + padX * 2);
    let h = Math.ceil(textH + padY * 2);
    if (t.shape === 'ellipse') { w = Math.ceil(w * 1.22); h = Math.ceil(h * 1.32); }
    if (t.shape === 'hexagon') w = Math.ceil(w + h * 0.5);
    w = Math.max(w, 36);

    g = { w, h, lines, lineH, fontSize: fs, bold: t.bold, italic: t.italic, shape: t.shape, depth: t.depth, iconSize, iconW, textW, icons, element, elementOnly, elSize, elW };
    if (cache.size > 4000) cache.clear();
    cache.set(key, g);
    return g;
  };

  L.LABEL_FONT = `600 12px ${L.FONT}`;
  L.labelWidth = function (text) {
    ctx.font = L.LABEL_FONT;
    return ctx.measureText(text).width;
  };

  /** Distância horizontal entre pai e filho; cresce quando a seta tem rótulo. */
  L.edgeGap = function (map, id) {
    const e = map.nodes[id].edge;
    return e && e.label ? Math.max(L.HGAP, L.labelWidth(e.label) * 1.2 + 70) : L.HGAP;
  };

  L.rect = function (map, id) {
    const n = map.nodes[id];
    const b = L.box(map, id);
    return { x: n.x - b.w / 2, y: n.y - b.h / 2, w: b.w, h: b.h };
  };

  L.bbox = function (map, ids) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const id of ids) {
      const r = L.rect(map, id);
      x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
      x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h);
    }
    if (!isFinite(x1)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };

  function visibleSubtree(map, id) {
    const out = [];
    const walk = (cid) => {
      out.push(cid);
      const n = map.nodes[cid];
      if (!n.collapsed) n.children.forEach(walk);
    };
    walk(id);
    return out;
  }
  L.subtreeBBox = (map, id) => L.bbox(map, visibleSubtree(map, id));

  // ---------- organização em árvore ----------
  function vgap(map, id) {
    const n = map.nodes[id];
    const base = M.isRoot(map, n.parent) ? L.ROOT_VGAP : L.VGAP;
    return n.edge && n.edge.label ? base + 16 : base; // espaço para o rótulo da seta
  }

  function blockH(map, id) {
    const n = map.nodes[id];
    const h = L.box(map, id).h;
    if (n.collapsed || !n.children.length) return h;
    let sum = 0;
    n.children.forEach((c, i) => { sum += blockH(map, c) + (i ? vgap(map, c) : 0); });
    return Math.max(h, sum);
  }

  function place(map, id, x, y, side) {
    const n = map.nodes[id];
    const dx = x - n.x, dy = y - n.y;
    n.x = x; n.y = y;
    if (n.collapsed) {
      // descendentes escondidos acompanham o pai
      for (const sid of M.subtreeIds(map, id)) if (sid !== id) { map.nodes[sid].x += dx; map.nodes[sid].y += dy; }
      return;
    }
    if (!n.children.length) return;
    n.children.sort((a, b) => map.nodes[a].y - map.nodes[b].y);
    stack(map, id, n.children, x, y, side);
  }

  function stack(map, parentId, kids, x, y, side) {
    const pw = L.box(map, parentId).w;
    const heights = kids.map((c) => blockH(map, c));
    const gaps = kids.map((c, i) => (i ? vgap(map, c) : 0));
    const total = heights.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
    let cy = y - total / 2;
    kids.forEach((c, i) => {
      cy += gaps[i];
      const cw = L.box(map, c).w;
      place(map, c, x + side * (pw / 2 + L.edgeGap(map, c) + cw / 2), cy + heights[i] / 2, side);
      cy += heights[i];
    });
  }

  /** Reorganiza uma ramificação mantendo a posição do próprio tópico. */
  L.layoutSubtree = function (map, id, rebalance) {
    const n = map.nodes[id];
    if (!M.isRoot(map, id)) {
      place(map, id, n.x, n.y, M.side(map, id));
      return;
    }
    if (n.collapsed) n.collapsed = false;
    let right = [], left = [];
    const allCentered = n.children.every((c) => Math.abs(map.nodes[c].x - n.x) < 1);
    if (rebalance || allCentered) {
      let hr = 0, hl = 0;
      for (const c of n.children) {
        const h = blockH(map, c);
        if (hr <= hl) { right.push(c); hr += h; } else { left.push(c); hl += h; }
      }
    } else {
      for (const c of n.children) (map.nodes[c].x >= n.x ? right : left).push(c);
      const byY = (a, b) => map.nodes[a].y - map.nodes[b].y;
      right.sort(byY); left.sort(byY);
    }
    stack(map, id, right, n.x, n.y, 1);
    stack(map, id, left, n.x, n.y, -1);
    n.children = right.concat(left);
  };

  L.layoutAll = (map, rebalance) => L.layoutSubtree(map, map.rootId, rebalance);

  /** Posiciona um novo filho próximo dos irmãos, sem reorganizar o resto. */
  L.placeNewChild = function (map, id) {
    const n = map.nodes[id];
    const p = map.nodes[n.parent];
    const pb = L.box(map, p.id);
    const b = L.box(map, id);
    let side;
    const sibs = p.children.filter((c) => c !== id);
    if (M.isRoot(map, p.id)) {
      let hr = 0, hl = 0;
      for (const c of sibs) { if (map.nodes[c].x >= p.x) hr += blockH(map, c); else hl += blockH(map, c); }
      side = hr <= hl ? 1 : -1;
    } else {
      side = M.side(map, p.id);
    }
    const same = sibs.filter((c) => (map.nodes[c].x >= p.x ? 1 : -1) === side);
    n.x = p.x + side * (pb.w / 2 + L.edgeGap(map, id) + b.w / 2);
    if (!same.length) {
      n.y = p.y;
    } else {
      let bottom = -Infinity;
      for (const c of same) { const r = L.subtreeBBox(map, c); bottom = Math.max(bottom, r.y + r.h); }
      n.y = bottom + vgap(map, id) + b.h / 2;
    }
  };

  /** Insere logo abaixo de um irmão de referência. */
  L.placeAfterSibling = function (map, id, refId) {
    const n = map.nodes[id];
    const p = map.nodes[n.parent];
    const side = M.side(map, refId);
    const pb = L.box(map, p.id);
    const b = L.box(map, id);
    const r = L.subtreeBBox(map, refId);
    n.x = p.x + side * (pb.w / 2 + L.edgeGap(map, id) + b.w / 2);
    n.y = r.y + r.h + vgap(map, id) + b.h / 2;
  };

  /** Empurra para baixo ramificações vizinhas que ficariam sobrepostas. */
  L.makeRoom = function (map, id) {
    let cur = id;
    while (map.nodes[cur] && map.nodes[cur].parent) {
      const p = map.nodes[map.nodes[cur].parent];
      const side = M.side(map, cur);
      let box = L.subtreeBBox(map, cur);
      const below = p.children
        .filter((c) => c !== cur && M.side(map, c) === side && map.nodes[c].y > map.nodes[cur].y)
        .sort((a, b) => map.nodes[a].y - map.nodes[b].y);
      for (const s of below) {
        const sb = L.subtreeBBox(map, s);
        const hOverlap = sb.x < box.x + box.w && sb.x + sb.w > box.x;
        const need = box.y + box.h + vgap(map, s) - sb.y;
        if (hOverlap && need > 0) {
          M.moveSubtree(map, s, 0, need);
          sb.y += need;
        }
        const x1 = Math.min(box.x, sb.x), y1 = Math.min(box.y, sb.y);
        const x2 = Math.max(box.x + box.w, sb.x + sb.w), y2 = Math.max(box.y + box.h, sb.y + sb.h);
        box = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      }
      cur = p.id;
    }
  };

  L.clearCache = () => cache.clear();

  MM.L = L;
})(window.MM);
