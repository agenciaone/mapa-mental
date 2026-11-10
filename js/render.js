'use strict';
(function (MM) {
  const { U, M, L } = MM;
  const R = {};

  R.PALETTE = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#e67700', '#d6336c', '#0c8599', '#6741d9'];

  R.THEMES = {
    light: {
      name: 'light', bg: '#f5f6f8', text: '#1f2630', muted: '#8a94a3',
      rootFill: '#253041', rootText: '#ffffff', accent: '#0e8a7e', drop: '#f08c00',
      toggleBg: '#ffffff', toggleText: '#253041', tint: 0.84,
    },
    dark: {
      name: 'dark', bg: '#14171c', text: '#e5e8ec', muted: '#7d8794',
      rootFill: '#e5e8ec', rootText: '#14171c', accent: '#34d1bf', drop: '#ffc53d',
      toggleBg: '#232830', toggleText: '#e5e8ec', tint: 0.74,
    },
  };

  const ICONS = {
    note: 'M3.5 2h6.5l3 3v9h-9.5z M10 2v3h3 M6 8h4.5 M6 11h4.5',
    link: 'M6.6 9.4l2.8-2.8 M7.2 4.6l1.1-1.1a2.7 2.7 0 013.9 3.9L11.1 8.5 M8.8 11.4l-1.1 1.1a2.7 2.7 0 01-3.9-3.9L4.9 7.5',
  };

  R.branchColor = function (map, id, theme) {
    let n = map.nodes[id];
    while (n) {
      if (n.style && n.style.branch) return n.style.branch;
      if (!n.parent) return n.id === map.rootId ? theme.rootFill : '#495057';
      const p = map.nodes[n.parent];
      if (!p.parent && p.id === map.rootId) {
        const i = Math.max(0, p.children.indexOf(n.id));
        return R.PALETTE[i % R.PALETTE.length];
      }
      n = p;
    }
    return theme.text;
  };

  R.nextBranchColor = function (map) {
    const used = new Map(R.PALETTE.map((c) => [c, 0]));
    for (const c of map.nodes[map.rootId].children) {
      const b = map.nodes[c].style.branch;
      if (used.has(b)) used.set(b, used.get(b) + 1);
    }
    let best = R.PALETTE[0], min = Infinity;
    for (const [c, k] of used) if (k < min) { min = k; best = c; }
    return best;
  };

  /** Cores efetivas de um tópico conforme tema e estilo do usuário. */
  R.colors = function (map, id, theme, box) {
    const n = map.nodes[id];
    const s = n.style || {};
    const branch = R.branchColor(map, id, theme);
    const flat = box.shape === 'underline' || box.shape === 'none';
    let fill;
    if (s.fill) fill = s.fill;
    else if (flat) fill = 'none';
    else if (box.depth === 0) fill = theme.rootFill;
    else fill = U.mix(branch, theme.bg, Math.min(0.92, theme.tint + (box.depth > 1 ? 0.06 : 0)));
    const text = s.textColor || (s.fill ? U.contrastText(s.fill) : box.depth === 0 ? theme.rootText : theme.text);
    const border = s.border || (box.depth === 0 ? 'none' : box.shape === 'none' ? 'none' : 'solid');
    const stroke = box.depth === 0 ? (s.branch || theme.text) : branch;
    const strokeW = box.shape === 'underline' ? (box.depth <= 1 ? 3 : 2.2) : 2;
    return { fill, text, border, stroke, strokeW, branch };
  };

  const dash = (b, w) => (b === 'dashed' ? `${w * 3},${w * 2.2}` : b === 'dotted' ? `0.1,${w * 2.2}` : null);

  function edgeWidth(depth) { return depth <= 1 ? 3.2 : depth === 2 ? 2.2 : 1.6; }

  const flat = (b) => b.shape === 'underline' || b.shape === 'none';

  /**
   * Linha em cotovelo (fluxo e organograma): sai do pai, desce/segue pelo tronco
   * comum dos irmãos e entra reto no filho. Cantos arredondados.
   */
  function elbowPath(map, pid, cid) {
    const A = L.axis(map);
    const p = map.nodes[pid], c = map.nodes[cid];
    const pb = L.box(map, pid), cb = L.box(map, cid);
    if (A.m === 'y' && L.isList(map, pid)) {
      // lista do organograma: tronco descendo pela esquerda do pai e entrando de lado no item
      const tx = p.x - pb.w / 2 + 14, ty = p.y + pb.h / 2;
      const ex = c.x - cb.w / 2, ey = flat(cb) ? c.y + cb.h / 2 : c.y;
      const r = Math.min(8, Math.max(0, ey - ty) / 2, Math.max(0, ex - tx));
      const d = `M${f(tx)} ${f(ty)}L${f(tx)} ${f(ey - r)}Q${f(tx)} ${f(ey)} ${f(tx + r)} ${f(ey)}L${f(ex)} ${f(ey)}`;
      return { d, s: [tx, ty], e: [ex, ey], c1: [tx, ty + 12], c2: [ex - 12, ey], mid: [tx, (ty + ey) / 2] };
    }
    const P = A.m === 'x' ? (m, k) => [m, k] : (m, k) => [k, m];
    const side = c[A.m] >= p[A.m] ? 1 : -1;
    let sm = p[A.m] + side * pb[A.ms] / 2, sc = p[A.c];
    if (A.m === 'x' && flat(pb)) sc = p.y + pb.h / 2;
    if (A.m === 'x' && pb.depth === 0) sm = p.x + side * Math.max(0, pb.w / 2 - Math.min(pb.h / 2, 18));
    const em = c[A.m] - side * cb[A.ms] / 2;
    const ec = A.m === 'x' && flat(cb) ? c.y + cb.h / 2 : c[A.c];
    const mm = sm + side * Math.min(A.m === 'x' ? 28 : 22, Math.abs(em - sm) / 2);
    const dc = Math.sign(ec - sc);
    const r = Math.min(10, Math.abs(ec - sc) / 2, Math.abs(mm - sm), Math.abs(em - mm));
    const pt = (a) => `${f(a[0])} ${f(a[1])}`;
    let d;
    if (Math.abs(ec - sc) < 1 || r < 0.5) {
      d = `M${pt(P(sm, sc))}L${pt(P(mm, sc))}L${pt(P(mm, ec))}L${pt(P(em, ec))}`;
    } else {
      d = `M${pt(P(sm, sc))}L${pt(P(mm - side * r, sc))}Q${pt(P(mm, sc))} ${pt(P(mm, sc + dc * r))}`
        + `L${pt(P(mm, ec - dc * r))}Q${pt(P(mm, ec))} ${pt(P(mm + side * r, ec))}L${pt(P(em, ec))}`;
    }
    const g = { d, s: P(sm, sc), e: P(em, ec), c1: P(mm, sc), c2: P(em - side * 12, ec) };
    if (Math.abs(ec - sc) < 1) g.c1 = P(sm + side * 12, sc);
    // rótulo no trecho final, que é exclusivo deste filho
    g.mid = P((mm + em) / 2, ec);
    return g;
  }

  function edgePath(map, pid, cid) {
    if (M.structure(map) !== 'mind') return elbowPath(map, pid, cid);
    const p = map.nodes[pid], c = map.nodes[cid];
    const pb = L.box(map, pid), cb = L.box(map, cid);
    const side = c.x >= p.x ? 1 : -1;
    let sx = p.x + side * pb.w / 2, sy = p.y;
    if (pb.depth === 0) sx = p.x + side * Math.max(0, pb.w / 2 - Math.min(pb.h / 2, 18));
    else if (pb.shape === 'underline' || pb.shape === 'none') sy = p.y + pb.h / 2;
    const ex = c.x - side * cb.w / 2;
    const ey = (cb.shape === 'underline' || cb.shape === 'none') ? c.y + cb.h / 2 : c.y;
    const dx = (ex - sx) * 0.55;
    const g = { s: [sx, sy], c1: [sx + dx, sy], c2: [ex - dx, ey], e: [ex, ey] };
    g.d = `M${f(sx)} ${f(sy)}C${f(sx + dx)} ${f(sy)} ${f(ex - dx)} ${f(ey)} ${f(ex)} ${f(ey)}`;
    // rótulo um pouco depois do meio, para separar setas que saem do mesmo ponto
    const t = 0.6, u = 1 - t, k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
    g.mid = [k0 * sx + k1 * g.c1[0] + k2 * g.c2[0] + k3 * ex, k0 * sy + k1 * g.c1[1] + k2 * g.c2[1] + k3 * ey];
    return g;
  }

  const f = (v) => v.toFixed(1);

  /** Ponta de seta (triângulo) em `tip`, apontando na direção from→tip. */
  function arrowHead(tip, from, size) {
    let dx = tip[0] - from[0], dy = tip[1] - from[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const bx = tip[0] - dx * size, by = tip[1] - dy * size;
    const w = size * 0.55;
    return `M${f(tip[0])} ${f(tip[1])}L${f(bx - dy * w)} ${f(by + dx * w)}L${f(bx + dy * w)} ${f(by - dx * w)}Z`;
  }

  R.edgeArrow = (map, id) => {
    const e = map.nodes[id].edge || {};
    return e.arrow || (map.arrows ? 'end' : 'none');
  };

  function lineDash(line, w) {
    return line === 'dashed' ? `${w * 3.2},${w * 2.4}` : line === 'dotted' ? `0.1,${w * 2.6}` : null;
  }

  function drawLabel(layer, text, pt, color, theme, attrs) {
    const w = L.labelWidth(text) + 14, h = 20;
    const g = U.s('g', Object.assign({ class: 'edge-label' }, attrs || {}));
    g.appendChild(U.s('rect', { x: f(pt[0] - w / 2), y: f(pt[1] - h / 2), width: f(w), height: h, rx: 10, fill: theme.bg, stroke: color, 'stroke-width': 1.2 }));
    const t = U.s('text', { x: f(pt[0]), y: f(pt[1] + 4.2), 'text-anchor': 'middle', 'font-family': L.FONT, 'font-size': 12, 'font-weight': 600, fill: color });
    t.textContent = text;
    g.appendChild(t);
    layer.appendChild(g);
  }

  /** Ponto na borda do retângulo do tópico, na direção de (tx, ty). */
  function boundary(map, id, tx, ty) {
    const n = map.nodes[id];
    const b = L.box(map, id);
    const dx = tx - n.x, dy = ty - n.y;
    const k = 1 / Math.max(Math.abs(dx) / (b.w / 2 + 7), Math.abs(dy) / (b.h / 2 + 7), 1e-6);
    return [n.x + dx * k, n.y + dy * k];
  }

  R.linkGeom = function (map, l) {
    const a = map.nodes[l.from], b = map.nodes[l.to];
    const s = boundary(map, l.from, b.x, b.y);
    const e = boundary(map, l.to, a.x, a.y);
    const dx = e[0] - s[0], dy = e[1] - s[1];
    const len = Math.hypot(dx, dy) || 1;
    const k = len * (0.18 + (l.bend || 0) * 0.2);
    const c = [(s[0] + e[0]) / 2 - (dy / len) * k, (s[1] + e[1]) / 2 + (dx / len) * k];
    return {
      s, e, c,
      d: `M${f(s[0])} ${f(s[1])}Q${f(c[0])} ${f(c[1])} ${f(e[0])} ${f(e[1])}`,
      mid: [(s[0] + 2 * c[0] + e[0]) / 4, (s[1] + 2 * c[1] + e[1]) / 4],
    };
  };

  R.linkColor = (l, theme) => l.color || theme.muted;

  function shapeEl(b, col) {
    const { w, h } = b;
    const common = { fill: col.fill === 'none' ? 'transparent' : col.fill, class: 'shape' };
    if (col.border !== 'none' && b.shape !== 'underline') {
      common.stroke = col.stroke;
      common['stroke-width'] = col.strokeW;
      const d = dash(col.border, col.strokeW);
      if (d) { common['stroke-dasharray'] = d; common['stroke-linecap'] = 'round'; }
    }
    switch (b.shape) {
      case 'ellipse': return U.s('ellipse', Object.assign({ cx: w / 2, cy: h / 2, rx: w / 2, ry: h / 2 }, common));
      case 'hexagon': {
        const k = Math.min(h * 0.32, w / 4);
        return U.s('polygon', Object.assign({ points: `${k},0 ${w - k},0 ${w},${h / 2} ${w - k},${h} ${k},${h} 0,${h / 2}` }, common));
      }
      case 'rect': return U.s('rect', Object.assign({ width: w, height: h, rx: 2 }, common));
      case 'pill': return U.s('rect', Object.assign({ width: w, height: h, rx: b.image ? Math.min(h / 2, 18) : h / 2 }, common));
      case 'underline':
      case 'none': return U.s('rect', Object.assign({ width: w, height: h, rx: 4 }, common));
      default: return U.s('rect', Object.assign({ width: w, height: h, rx: Math.min(10, h / 3) }, common));
    }
  }

  const assetUrls = new Map();
  /** URL de blob em cache para a foto (evita repassar o data URL a cada quadro). */
  R.assetUrl = function (map, aid) {
    const data = map.assets && map.assets[aid];
    if (!data) return '';
    let hit = assetUrls.get(aid);
    if (hit && hit.data === data) return hit.url;
    const comma = data.indexOf(',');
    const bin = atob(data.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: data.slice(5, data.indexOf(';')) }));
    assetUrls.set(aid, { data, url });
    return url;
  };

  const EMOJI_FONT = `"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", ${L.FONT}`;

  /** Emoji ou ícone da biblioteca, desenhado num quadrado de lado b.elSize. */
  R.elementEl = function (n, b, col, x, y) {
    const s = b.elSize;
    if (b.element === 'icon') {
      const ic = MM.ICONS[n.icon];
      const color = ic.color || col.text;
      const g = U.s('g', {
        class: 'element', transform: `translate(${f(x)},${f(y)}) scale(${(s / 24).toFixed(3)})`,
        fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      });
      // marcação estática da biblioteca; a cor é um hex validado
      g.innerHTML = ic.svg.replace(/\{c\}/g, color);
      return g;
    }
    const t = U.s('text', { class: 'element', x: f(x + s / 2), y: f(y + s * 0.84), 'text-anchor': 'middle', 'font-size': f(s * 0.9), 'font-family': EMOJI_FONT });
    t.textContent = n.emoji;
    return t;
  };

  function toggleSide(map, id) {
    const n = map.nodes[id];
    const first = map.nodes[n.children[0]];
    if (first && Math.abs(first.x - n.x) > 1) return first.x > n.x ? 1 : -1;
    return L.side(map, id);
  }

  // ---------- funil (forma de fundo com etapas) ----------
  const STAGE_FONT = `700 13px ${L.FONT}`;
  const stageLabelW = (t) => L.textWidth(t.toUpperCase(), STAGE_FONT) + t.length * 13 * 0.06;
  /** Retângulo do funil; com `labels`, inclui os nomes das etapas à esquerda. */
  R.shapeBBox = function (s, labels) {
    const H = M.shapeHeight(s);
    let x1 = s.x - s.w / 2;
    if (labels) {
      s.stages.forEach((st, i) => {
        if (!st.label) return;
        const yc = s.y + (i + 0.5) * s.stageH;
        x1 = Math.min(x1, s.x - M.funnelHalfW(s, yc) - 16 - stageLabelW(st.label));
      });
    }
    return { x: x1, y: s.y, w: s.x + s.w / 2 - x1, h: H };
  };

  function drawFunnel(layer, s, theme, opts) {
    const g = U.s('g', { class: 'shape-funnel', 'data-shape': s.id });
    const gap = 5;
    s.stages.forEach((st, i) => {
      const y0 = s.y + i * s.stageH + (i ? gap / 2 : 0);
      const y1 = s.y + (i + 1) * s.stageH - (i < s.stages.length - 1 ? gap / 2 : 0);
      const a = M.funnelHalfW(s, y0), b = M.funnelHalfW(s, y1);
      const r = Math.min(12, s.stageH / 4);
      const fill = U.mix(st.color, theme.bg, theme.name === 'dark' ? 0.72 : 0.82);
      g.appendChild(U.s('path', {
        d: `M${f(s.x - a + r)} ${f(y0)}H${f(s.x + a - r)}Q${f(s.x + a)} ${f(y0)} ${f(s.x + a - (a - b) * r / (y1 - y0))} ${f(y0 + r)}`
          + `L${f(s.x + b)} ${f(y1)}H${f(s.x - b)}L${f(s.x - a + (a - b) * r / (y1 - y0))} ${f(y0 + r)}Q${f(s.x - a)} ${f(y0)} ${f(s.x - a + r)} ${f(y0)}Z`,
        fill, stroke: st.color, 'stroke-width': 1.5, 'stroke-opacity': 0.55,
      }));
      if (st.label) {
        // nome da etapa do lado de fora, à esquerda: o interior fica livre para os tópicos e setas
        const yc = (y0 + y1) / 2;
        const t = U.s('text', {
          x: f(s.x - M.funnelHalfW(s, yc) - 16), y: f(yc + 4.5), 'text-anchor': 'end', 'font-family': L.FONT, 'font-size': 13,
          'font-weight': 700, 'letter-spacing': '0.06em', fill: U.mix(st.color, theme.text, theme.name === 'dark' ? 0.15 : 0.35),
        });
        t.textContent = st.label.toUpperCase();
        g.appendChild(t);
      }
    });
    if (opts.interactive && opts.selectedShape === s.id) {
      const bb = R.shapeBBox(s);
      g.appendChild(U.s('rect', { x: f(bb.x - 8), y: f(bb.y - 8), width: f(bb.w + 16), height: f(bb.h + 16), rx: 14, fill: 'none', stroke: theme.accent, 'stroke-width': 2, 'stroke-dasharray': '7,5', 'pointer-events': 'none' }));
      const hd = U.s('g', { class: 'resize', 'data-act': 'resize' });
      hd.appendChild(U.s('circle', { cx: f(bb.x + bb.w + 8), cy: f(bb.y + bb.h + 8), r: 9, fill: theme.accent, stroke: theme.bg, 'stroke-width': 2 }));
      hd.appendChild(U.s('path', { d: `M${f(bb.x + bb.w + 4)} ${f(bb.y + bb.h + 12)}L${f(bb.x + bb.w + 12)} ${f(bb.y + bb.h + 4)}`, stroke: theme.bg, 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
      const title = U.s('title');
      title.textContent = 'Arraste para mudar o tamanho';
      hd.appendChild(title);
      g.appendChild(hd);
    }
    layer.appendChild(g);
  }

  /**
   * Desenha o mapa dentro de `target` (um <g>).
   * opts: interactive, selectedId, selectedLink, dropId, draggingId, expandAll
   */
  R.draw = function (target, map, theme, opts) {
    opts = opts || {};
    while (target.firstChild) target.removeChild(target.firstChild);
    const edges = U.s('g', { class: 'edges', fill: 'none', 'stroke-linecap': 'round' });
    const links = U.s('g', { class: 'links', fill: 'none', 'stroke-linecap': 'round' });
    const labels = U.s('g', { class: 'labels' });
    const nodes = U.s('g', { class: 'nodes' });
    const shapes = U.s('g', { class: 'shapes' });
    target.append(shapes, edges, links, labels, nodes);
    for (const s of map.shapes || []) if (s.kind === 'funnel') drawFunnel(shapes, s, theme, opts);
    const ids = M.visibleIds(map, opts.expandAll);
    const visible = new Set(ids);
    const dragSet = opts.draggingId ? new Set(M.subtreeIds(map, opts.draggingId)) : null;

    for (const id of ids) {
      const n = map.nodes[id];
      if (!n.parent) continue;
      const d = M.depth(map, id);
      const color = R.branchColor(map, id, theme);
      const w = edgeWidth(d);
      const geo = edgePath(map, n.parent, id);
      const e = n.edge || {};
      const g = U.s('g', dragSet && dragSet.has(id) ? { opacity: 0.55 } : null);
      g.appendChild(U.s('path', { d: geo.d, stroke: color, 'stroke-width': w, 'stroke-dasharray': lineDash(e.line, w) }));
      const arrow = R.edgeArrow(map, id);
      const size = 7 + w * 2;
      if (arrow === 'end' || arrow === 'both') g.appendChild(U.s('path', { d: arrowHead(geo.e, geo.c2, size), fill: color, stroke: 'none' }));
      if (arrow === 'both') g.appendChild(U.s('path', { d: arrowHead(geo.s, geo.c1, size), fill: color, stroke: 'none' }));
      if (opts.interactive) g.appendChild(U.s('path', { d: geo.d, stroke: 'transparent', 'stroke-width': 14, class: 'edge-hit', 'data-edge': id }));
      edges.appendChild(g);
      if (e.label) drawLabel(labels, e.label, geo.mid, color, theme, opts.interactive ? { 'data-edge': id } : null);
    }

    for (const l of map.links || []) {
      if (!visible.has(l.from) || !visible.has(l.to)) continue;
      const geo = R.linkGeom(map, l);
      const color = R.linkColor(l, theme);
      const w = 2;
      const g = U.s('g', { class: 'link' });
      if (opts.interactive && l.id === opts.selectedLink) {
        g.appendChild(U.s('path', { d: geo.d, stroke: theme.accent, 'stroke-width': 8, opacity: 0.3 }));
      }
      g.appendChild(U.s('path', { d: geo.d, stroke: color, 'stroke-width': w, 'stroke-dasharray': lineDash(l.line, w) }));
      if (l.arrow === 'end' || l.arrow === 'both') g.appendChild(U.s('path', { d: arrowHead(geo.e, geo.c, 11), fill: color, stroke: 'none' }));
      if (l.arrow === 'both') g.appendChild(U.s('path', { d: arrowHead(geo.s, geo.c, 11), fill: color, stroke: 'none' }));
      if (opts.interactive) g.appendChild(U.s('path', { d: geo.d, stroke: 'transparent', 'stroke-width': 14, class: 'link-hit', 'data-link': l.id }));
      links.appendChild(g);
      if (l.label) drawLabel(labels, l.label, geo.mid, color, theme, opts.interactive ? { 'data-link': l.id } : null);
    }

    for (const id of ids) {
      const n = map.nodes[id];
      const b = L.box(map, id);
      const col = R.colors(map, id, theme, b);
      const g = U.s('g', { class: 'node', 'data-id': id, transform: `translate(${(n.x - b.w / 2).toFixed(1)},${(n.y - b.h / 2).toFixed(1)})` });
      if (dragSet && dragSet.has(id)) g.setAttribute('opacity', '0.75');

      if (opts.interactive && (id === opts.selectedId || id === opts.dropId)) {
        const drop = id === opts.dropId;
        g.appendChild(U.s('rect', {
          class: 'sel', x: -5, y: -5, width: b.w + 10, height: b.h + 10, rx: 12,
          fill: drop ? theme.drop : 'none', 'fill-opacity': drop ? 0.15 : null,
          stroke: drop ? theme.drop : theme.accent, 'stroke-width': 2, 'stroke-dasharray': drop ? '5,4' : null,
        }));
      }

      g.appendChild(shapeEl(b, col));
      if (b.shape === 'underline' && col.border !== 'none') {
        const line = U.s('line', { x1: 0, y1: b.h, x2: b.w, y2: b.h, stroke: col.stroke, 'stroke-width': col.strokeW, 'stroke-linecap': 'round' });
        const d = dash(col.border, col.strokeW);
        if (d) line.setAttribute('stroke-dasharray', d);
        g.appendChild(line);
      }

      if (b.image) {
        const cid = 'ci-' + id;
        const cp = U.s('clipPath', { id: cid });
        cp.appendChild(U.s('rect', { x: f(b.imgX), y: f(b.imgY), width: b.imgW, height: b.imgH, rx: 6 }));
        g.appendChild(cp);
        // na tela usa URL de blob (rápido); na exportação, o data URL (autocontido)
        const href = opts.interactive ? R.assetUrl(map, n.image.id) : map.assets[n.image.id];
        g.appendChild(U.s('image', { href, x: f(b.imgX), y: f(b.imgY), width: b.imgW, height: b.imgH, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#${cid})` }));
      }
      const contentW = b.elW + b.textW + b.iconW;
      let left = (b.w - contentW) / 2;
      const top = b.rowCY - (b.lines.length * b.lineH) / 2;
      if (b.element) {
        g.appendChild(R.elementEl(n, b, col, left, b.rowCY - b.elSize / 2));
        left += b.elW;
      }
      const text = U.s('text', {
        'font-family': L.FONT, 'font-size': b.fontSize, fill: col.text, 'text-anchor': 'middle',
        'font-weight': b.bold ? 700 : 400, 'font-style': b.italic ? 'italic' : null,
      });
      b.lines.forEach((line, i) => {
        const t = U.s('tspan', { x: (left + b.textW / 2).toFixed(1), y: (top + i * b.lineH + b.lineH / 2 + b.fontSize * 0.35).toFixed(1) });
        t.textContent = line || ' ';
        text.appendChild(t);
      });
      g.appendChild(text);

      let ix = left + b.textW + 6;
      const iy = b.rowCY - b.iconSize / 2;
      for (const kind of ['note', 'link']) {
        if (kind === 'note' && !n.note) continue;
        if (kind === 'link' && !n.link) continue;
        const ig = U.s('g', { class: 'ico', 'data-act': kind, transform: `translate(${ix.toFixed(1)},${iy.toFixed(1)}) scale(${(b.iconSize / 16).toFixed(3)})` });
        ig.appendChild(U.s('rect', { width: 16, height: 16, fill: 'transparent' }));
        ig.appendChild(U.s('path', { d: ICONS[kind], fill: 'none', stroke: col.text, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
        if (opts.interactive) {
          const title = U.s('title');
          title.textContent = kind === 'note' ? n.note.slice(0, 400) : n.link;
          ig.appendChild(title);
        }
        g.appendChild(ig);
        ix += b.iconSize + 4;
      }

      if (!M.isRoot(map, id) && n.children.length && (opts.interactive || (n.collapsed && !opts.expandAll))) {
        let cx, cy;
        if (M.structure(map) === 'org') { cx = L.isList(map, id) ? 14 : b.w / 2; cy = b.h + 10; }
        else {
          cx = toggleSide(map, id) > 0 ? b.w + 10 : -10;
          cy = (b.shape === 'underline' || b.shape === 'none') ? b.h : b.h / 2;
        }
        const collapsed = n.collapsed && !opts.expandAll;
        const tg = U.s('g', { class: 'toggle' + (collapsed ? '' : ' open'), 'data-act': 'toggle' });
        tg.appendChild(U.s('circle', { cx, cy, r: 9, fill: theme.toggleBg, stroke: col.branch, 'stroke-width': 1.6 }));
        if (collapsed) {
          const count = M.subtreeIds(map, id).length - 1;
          const t = U.s('text', { x: cx, y: cy + 3.6, 'text-anchor': 'middle', 'font-size': count > 99 ? 7.5 : 10, 'font-weight': 700, 'font-family': L.FONT, fill: theme.toggleText });
          t.textContent = count > 999 ? '999+' : String(count);
          tg.appendChild(t);
        } else {
          tg.appendChild(U.s('line', { x1: cx - 4, y1: cy, x2: cx + 4, y2: cy, stroke: theme.toggleText, 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
        }
        g.appendChild(tg);
      }
      nodes.appendChild(g);
    }
    return ids;
  };

  /** Área ocupada pelo desenho (inclui botões de recolher). */
  R.contentBBox = function (map, expandAll) {
    const ids = M.visibleIds(map, expandAll);
    const b = L.bbox(map, ids);
    let x1 = b.x, y1 = b.y, x2 = b.x + b.w, y2 = b.y + b.h;
    const visible = new Set(ids);
    // conexões livres podem fazer curvas para fora dos tópicos
    for (const l of map.links || []) {
      if (!visible.has(l.from) || !visible.has(l.to)) continue;
      const g = R.linkGeom(map, l);
      const hw = l.label ? L.labelWidth(l.label) / 2 + 8 : 0;
      x1 = Math.min(x1, g.mid[0] - hw); x2 = Math.max(x2, g.mid[0] + hw);
      y1 = Math.min(y1, g.mid[1] - 12); y2 = Math.max(y2, g.mid[1] + 12);
    }
    for (const s of map.shapes || []) {
      const r = R.shapeBBox(s, true);
      x1 = Math.min(x1, r.x); y1 = Math.min(y1, r.y);
      x2 = Math.max(x2, r.x + r.w); y2 = Math.max(y2, r.y + r.h);
    }
    const pad = 24;
    return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 };
  };

  R.minFontSize = function (map, expandAll) {
    let min = Infinity;
    for (const id of M.visibleIds(map, expandAll)) min = Math.min(min, L.box(map, id).fontSize);
    return isFinite(min) ? min : 14;
  };

  MM.R = R;
})(window.MM);
