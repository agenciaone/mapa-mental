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
    const image = n.image && map.assets && map.assets[n.image.id] ? n.image : null;
    const key = [n.text, t.shape, t.fontSize, t.bold, t.italic, t.depth === 0, icons, element, n.emoji,
      image ? image.size + ':' + image.ratio.toFixed(3) : ''].join('\u0001');
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

    const rowW = textW + elW + iconW;
    let w, h, imgW = 0, imgH = 0, contentH = textH;
    const rowEmpty = !!image && !n.text.trim() && !element && !icons;
    if (image) {
      // foto em cima; texto/elemento embaixo, se houver
      imgW = M.IMAGE_SIZES[image.size] || M.IMAGE_SIZES.M;
      imgH = Math.round(Math.min(imgW * image.ratio, imgW * 1.6));
      padX = Math.max(padX, 8); padY = Math.max(padY, 8);
      contentH = imgH + (rowEmpty ? 0 : 8 + textH);
      w = Math.ceil(Math.max(rowEmpty ? 0 : rowW, imgW) + padX * 2);
    } else {
      w = Math.ceil(rowW + padX * 2);
    }
    h = Math.ceil(contentH + padY * 2);
    if (t.shape === 'ellipse') { w = Math.ceil(w * 1.22); h = Math.ceil(h * 1.32); }
    if (t.shape === 'hexagon') w = Math.ceil(w + h * 0.5);
    w = Math.max(w, 36);
    const imgY = (h - contentH) / 2;
    const rowCY = image ? imgY + imgH + 8 + textH / 2 : h / 2;

    g = { w, h, lines, lineH, fontSize: fs, bold: t.bold, italic: t.italic, shape: t.shape, depth: t.depth, iconSize, iconW, textW, icons, element, elementOnly, elSize, elW,
      image: !!image, imgW, imgH, imgX: (w - imgW) / 2, imgY, rowCY };
    if (cache.size > 4000) cache.clear();
    cache.set(key, g);
    return g;
  };

  L.LABEL_FONT = `600 12px ${L.FONT}`;
  L.textWidth = function (text, font) {
    ctx.font = font;
    return ctx.measureText(text).width;
  };
  L.labelWidth = function (text) {
    ctx.font = L.LABEL_FONT;
    return ctx.measureText(text).width;
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
  // Eixo principal (m): direção pai → filho. Eixo cruzado (c): onde os irmãos se empilham.
  // Mapa mental e fluxo: principal = x. Organograma: principal = y.
  const AX_H = { m: 'x', c: 'y', ms: 'w', cs: 'h' };
  const AX_V = { m: 'y', c: 'x', ms: 'h', cs: 'w' };
  L.axis = (map) => (M.structure(map) === 'org' ? AX_V : AX_H);
  /** Fluxo e organograma crescem para um lado só. */
  L.oneSided = (map) => M.structure(map) !== 'mind';

  /** Lado do tópico em relação ao pai no eixo principal: 1 ou -1. */
  L.side = function (map, id) {
    const A = L.axis(map);
    const n = map.nodes[id];
    if (!n) return 1;
    if (!n.parent) {
      const f = map.nodes[n.children[0]];
      if (f && Math.abs(f[A.m] - n[A.m]) > 1) return f[A.m] > n[A.m] ? 1 : -1;
      return 1;
    }
    const p = map.nodes[n.parent];
    if (Math.abs(n[A.m] - p[A.m]) < 1) return L.side(map, p.id);
    return n[A.m] >= p[A.m] ? 1 : -1;
  };

  /** Distância entre pai e filho no eixo principal; cresce quando a seta tem rótulo. */
  L.edgeGap = function (map, id) {
    const e = map.nodes[id].edge;
    if (L.axis(map) === AX_V) return e && e.label ? 78 : 48;
    return e && e.label ? Math.max(L.HGAP, L.labelWidth(e.label) * 1.2 + 70) : L.HGAP;
  };

  /** Espaço entre irmãos no eixo cruzado. */
  function vgap(map, id) {
    const n = map.nodes[id];
    if (L.axis(map) === AX_V) return M.isRoot(map, n.parent) ? 34 : 20;
    const base = M.isRoot(map, n.parent) ? L.ROOT_VGAP : L.VGAP;
    return n.edge && n.edge.label ? base + 16 : base; // espaço para o rótulo da seta
  }
  L.crossGap = vgap;

  /** Tamanho do próprio tópico no eixo cruzado (no organograma, o rótulo da seta também ocupa). */
  function selfCross(map, id, A) {
    const b = L.box(map, id);
    const e = map.nodes[id].edge;
    if (A === AX_V && e && e.label) return Math.max(b.w, L.labelWidth(e.label) + 24);
    return b[A.cs];
  }

  // Organograma compacto: quando todos os filhos são finais, eles ficam numa lista
  // vertical sob o pai, ligados por um tronco à esquerda (evita organogramas larguíssimos).
  const LIST_INDENT = 30, LIST_GAP = 10, LIST_TOP = 16;
  L.isList = function (map, id) {
    if (L.axis(map) !== AX_V || M.isRoot(map, id)) return false;
    const n = map.nodes[id];
    if (!n || n.collapsed || !n.children.length) return false;
    return n.children.every((c) => { const k = map.nodes[c]; return k.collapsed || !k.children.length; });
  };
  function listWidth(map, id) {
    let w = L.box(map, id).w;
    for (const c of map.nodes[id].children) w = Math.max(w, LIST_INDENT + selfCross(map, c, AX_V));
    return w;
  }
  /** Deslocamento do pai dentro da sua faixa (a lista fica alinhada à esquerda do pai). */
  function crossOffset(map, id, A) {
    return L.isList(map, id) ? (L.box(map, id).w - listWidth(map, id)) / 2 : 0;
  }
  function placeList(map, id) {
    const n = map.nodes[id];
    const b = L.box(map, id);
    const left = n.x - b.w / 2;
    let y = n.y + b.h / 2 + LIST_TOP;
    for (const c of n.children) {
      const k = map.nodes[c];
      const kb = L.box(map, c);
      const nx = left + LIST_INDENT + kb.w / 2, ny = y + kb.h / 2;
      M.moveSubtree(map, c, nx - k.x, ny - k.y);
      y += kb.h + LIST_GAP;
    }
  }

  function block(map, id, A) {
    const n = map.nodes[id];
    const own = selfCross(map, id, A);
    if (L.isList(map, id)) return listWidth(map, id);
    if (n.collapsed || !n.children.length) return own;
    let sum = 0;
    n.children.forEach((c, i) => { sum += block(map, c, A) + (i ? vgap(map, c) : 0); });
    return Math.max(own, sum);
  }

  function place(map, id, m, c, side, A) {
    const n = map.nodes[id];
    const dm = m - n[A.m], dc = c - n[A.c];
    n[A.m] = m; n[A.c] = c;
    if (n.collapsed) {
      // descendentes escondidos acompanham o pai
      for (const sid of M.subtreeIds(map, id)) if (sid !== id) { map.nodes[sid][A.m] += dm; map.nodes[sid][A.c] += dc; }
      return;
    }
    if (!n.children.length) return;
    if (L.isList(map, id)) {
      n.children.sort((a, b) => map.nodes[a].y - map.nodes[b].y);
      placeList(map, id);
      return;
    }
    n.children.sort((a, b) => map.nodes[a][A.c] - map.nodes[b][A.c]);
    stack(map, id, n.children, m, c, side, A);
  }

  function stack(map, parentId, kids, m, c, side, A) {
    const pm = L.box(map, parentId)[A.ms];
    const sizes = kids.map((k) => block(map, k, A));
    const gaps = kids.map((k, i) => (i ? vgap(map, k) : 0));
    const total = sizes.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
    let cur = c - total / 2;
    kids.forEach((k, i) => {
      cur += gaps[i];
      const km = L.box(map, k)[A.ms];
      place(map, k, m + side * (pm / 2 + L.edgeGap(map, k) + km / 2), cur + sizes[i] / 2 + crossOffset(map, k, A), side, A);
      cur += sizes[i];
    });
  }

  /** Reorganiza uma ramificação mantendo a posição do próprio tópico. */
  L.layoutSubtree = function (map, id, rebalance) {
    const A = L.axis(map);
    const n = map.nodes[id];
    if (!M.isRoot(map, id)) {
      place(map, id, n[A.m], n[A.c], L.oneSided(map) && !n.parent ? 1 : L.side(map, id), A);
      return;
    }
    if (n.collapsed) n.collapsed = false;
    if (L.oneSided(map)) {
      n.children.sort((a, b) => map.nodes[a][A.c] - map.nodes[b][A.c]);
      stack(map, id, n.children, n[A.m], n[A.c], 1, A);
      return;
    }
    let right = [], left = [];
    const allCentered = n.children.every((c) => Math.abs(map.nodes[c].x - n.x) < 1);
    if (rebalance || allCentered) {
      let hr = 0, hl = 0;
      for (const c of n.children) {
        const h = block(map, c, A);
        if (hr <= hl) { right.push(c); hr += h; } else { left.push(c); hl += h; }
      }
    } else {
      for (const c of n.children) (map.nodes[c].x >= n.x ? right : left).push(c);
      const byY = (a, b) => map.nodes[a].y - map.nodes[b].y;
      right.sort(byY); left.sort(byY);
    }
    stack(map, id, right, n.x, n.y, 1, A);
    stack(map, id, left, n.x, n.y, -1, A);
    n.children = right.concat(left);
  };

  /** Reorganiza o tópico central e cada tópico solto (que ficam onde estão). */
  L.layoutAll = function (map, rebalance) {
    for (const r of M.roots(map)) L.layoutSubtree(map, r, rebalance);
  };

  /** Posiciona um novo filho próximo dos irmãos, sem reorganizar o resto. */
  L.placeNewChild = function (map, id) {
    const A = L.axis(map);
    const n = map.nodes[id];
    const p = map.nodes[n.parent];
    const pb = L.box(map, p.id);
    const b = L.box(map, id);
    let side;
    const sibs = p.children.filter((c) => c !== id);
    if (M.isRoot(map, p.id) && !L.oneSided(map)) {
      let hr = 0, hl = 0;
      for (const c of sibs) { if (map.nodes[c].x >= p.x) hr += block(map, c, A); else hl += block(map, c, A); }
      side = hr <= hl ? 1 : -1;
    } else if (!p.parent) {
      side = L.oneSided(map) ? 1 : L.side(map, p.id);
    } else {
      side = L.side(map, p.id);
    }
    if (L.isList(map, p.id)) {
      // entra no fim da lista do pai
      const pl = p.x - pb.w / 2;
      let bottom = p.y + pb.h / 2 + LIST_TOP - LIST_GAP;
      for (const c of sibs) { const r = L.subtreeBBox(map, c); bottom = Math.max(bottom, r.y + r.h); }
      n.x = pl + LIST_INDENT + b.w / 2;
      n.y = bottom + LIST_GAP + b.h / 2;
      return;
    }
    const same = sibs.filter((c) => (map.nodes[c][A.m] >= p[A.m] ? 1 : -1) === side);
    n[A.m] = p[A.m] + side * (pb[A.ms] / 2 + L.edgeGap(map, id) + b[A.ms] / 2);
    if (!same.length) {
      n[A.c] = p[A.c];
    } else {
      let end = -Infinity;
      for (const c of same) { const r = L.subtreeBBox(map, c); end = Math.max(end, r[A.c] + r[A.cs]); }
      n[A.c] = end + vgap(map, id) + selfCross(map, id, A) / 2;
    }
  };

  /** Insere logo depois de um irmão de referência. */
  L.placeAfterSibling = function (map, id, refId) {
    const A = L.axis(map);
    const n = map.nodes[id];
    const p = map.nodes[n.parent];
    const side = L.side(map, refId);
    const pb = L.box(map, p.id);
    const b = L.box(map, id);
    const r = L.subtreeBBox(map, refId);
    if (L.isList(map, p.id)) {
      // abre espaço na lista logo abaixo do irmão de referência
      const ny = r.y + r.h + LIST_GAP + b.h / 2;
      for (const c of p.children) if (c !== id && c !== refId && map.nodes[c].y > map.nodes[refId].y) M.moveSubtree(map, c, 0, b.h + LIST_GAP);
      n.x = p.x - pb.w / 2 + LIST_INDENT + b.w / 2;
      n.y = ny;
      return;
    }
    n[A.m] = p[A.m] + side * (pb[A.ms] / 2 + L.edgeGap(map, id) + b[A.ms] / 2);
    n[A.c] = r[A.c] + r[A.cs] + vgap(map, id) + selfCross(map, id, A) / 2;
  };

  /** Empurra (para baixo, ou para a direita no organograma) ramificações vizinhas que ficariam sobrepostas. */
  L.makeRoom = function (map, id) {
    const A = L.axis(map);
    const m = A.m, c = A.c, ms = A.ms, cs = A.cs;
    let cur = id;
    while (map.nodes[cur] && map.nodes[cur].parent) {
      const p = map.nodes[map.nodes[cur].parent];
      if (L.isList(map, p.id)) {
        // lista do organograma: só reempilha os itens, sem mexer no resto
        p.children.sort((a, b) => map.nodes[a].y - map.nodes[b].y);
        placeList(map, p.id);
        cur = p.id;
        continue;
      }
      const side = L.side(map, cur);
      let box = L.subtreeBBox(map, cur);
      const after = p.children
        .filter((k) => k !== cur && L.side(map, k) === side && L.rect(map, k)[c] > L.rect(map, cur)[c])
        .sort((a, b) => map.nodes[a][c] - map.nodes[b][c]);
      for (const s of after) {
        const sb = L.subtreeBBox(map, s);
        const overlap = sb[m] < box[m] + box[ms] && sb[m] + sb[ms] > box[m];
        const need = box[c] + box[cs] + vgap(map, s) - sb[c];
        if (overlap && need > 0) {
          M.moveSubtree(map, s, c === 'x' ? need : 0, c === 'y' ? need : 0);
          sb[c] += need;
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
