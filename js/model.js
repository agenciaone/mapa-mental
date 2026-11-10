'use strict';
(function (MM) {
  const U = MM.U;
  const M = {};

  M.FORMAT = 'mapa-mental';
  M.BACKUP_FORMAT = 'mapa-mental-backup';
  M.VERSION = 1;
  M.SHAPES = ['rounded', 'rect', 'pill', 'ellipse', 'hexagon', 'underline', 'none'];
  M.BORDERS = ['solid', 'dashed', 'dotted', 'none'];
  M.LIMITS = { text: 2000, note: 20000, name: 120, nodes: 5000, links: 2000, label: 120, emoji: 16, shapes: 200, stages: 12 };
  M.ARROWS = ['end', 'both', 'none'];
  /** mind: mapa mental (dois lados) · flow: fluxo da esquerda para a direita · org: organograma de cima para baixo */
  M.STRUCTURES = ['mind', 'flow', 'org'];
  M.STAGE_COLORS = ['#1c7ed6', '#0c8599', '#2f9e44', '#e67700', '#d6336c', '#6741d9'];

  M.newNode = function (text, parent) {
    return { id: U.uid(), text: text == null ? '' : String(text), parent: parent || null, children: [], x: 0, y: 0, collapsed: false, style: {}, note: '', link: '', emoji: '', icon: '', edge: {}, image: null };
  };

  M.createMap = function (name, rootText, structure) {
    const root = M.newNode(rootText || 'Tópico central', null);
    const now = Date.now();
    return {
      id: U.uid(), name: name || 'Novo mapa', created: now, updated: now,
      rootId: root.id, nodes: { [root.id]: root }, view: null, links: [], arrows: false, assets: {},
      structure: M.STRUCTURES.includes(structure) ? structure : 'mind', shapes: [],
    };
  };

  M.get = (map, id) => map.nodes[id];
  M.isRoot = (map, id) => map.rootId === id;
  /** Tópico solto: sem pai e que não é o tópico central. */
  M.isFree = (map, id) => !!map.nodes[id] && !map.nodes[id].parent && id !== map.rootId;
  M.structure = (map) => (M.STRUCTURES.includes(map.structure) ? map.structure : 'mind');

  /** Tópico central primeiro, depois os tópicos soltos (cada um com sua ramificação). */
  M.roots = function (map) {
    const out = [map.rootId];
    for (const id in map.nodes) if (id !== map.rootId && !map.nodes[id].parent) out.push(id);
    return out;
  };

  /** Profundidade visual: o central é 0; um tópico solto conta como 1 (parece um tópico principal). */
  M.depth = function (map, id) {
    let d = 0, n = map.nodes[id];
    while (n && n.parent) { d++; n = map.nodes[n.parent]; }
    if (n && n.id !== map.rootId) d++;
    return d;
  };

  M.isDescendant = function (map, id, ancestorId) {
    let n = map.nodes[id];
    while (n && n.parent) {
      if (n.parent === ancestorId) return true;
      n = map.nodes[n.parent];
    }
    return false;
  };

  M.subtreeIds = function (map, id) {
    const out = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      const n = map.nodes[cur];
      if (!n) continue;
      out.push(cur);
      for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]);
    }
    return out;
  };

  /** Nós visíveis (pais recolhidos escondem descendentes). Ordem: pré-ordem. */
  M.visibleIds = function (map, expandAll) {
    const out = [];
    const walk = (id) => {
      const n = map.nodes[id];
      if (!n) return;
      out.push(id);
      if (!n.collapsed || expandAll) n.children.forEach(walk);
    };
    for (const r of M.roots(map)) walk(r);
    return out;
  };

  /** Lado de um nó em relação ao pai: 1 = direita, -1 = esquerda. */
  M.side = function (map, id) {
    const n = map.nodes[id];
    if (!n || !n.parent) return 1;
    const p = map.nodes[n.parent];
    if (Math.abs(n.x - p.x) < 1) return M.side(map, p.id);
    return n.x >= p.x ? 1 : -1;
  };

  M.addChild = function (map, parentId, text, index) {
    const p = map.nodes[parentId];
    const n = M.newNode(text, parentId);
    map.nodes[n.id] = n;
    if (index == null || index < 0 || index > p.children.length) p.children.push(n.id);
    else p.children.splice(index, 0, n.id);
    p.collapsed = false;
    return n;
  };

  M.removeNode = function (map, id) {
    if (id === map.rootId) return false;
    const n = map.nodes[id];
    if (!n) return false;
    const p = map.nodes[n.parent];
    if (p) p.children = p.children.filter((c) => c !== id);
    for (const sid of M.subtreeIds(map, id)) delete map.nodes[sid];
    if (map.links) map.links = map.links.filter((l) => map.nodes[l.from] && map.nodes[l.to]);
    return true;
  };

  M.reparent = function (map, id, newParentId, index) {
    if (id === map.rootId || id === newParentId || M.isDescendant(map, newParentId, id)) return false;
    const n = map.nodes[id];
    const old = map.nodes[n.parent];
    if (old) old.children = old.children.filter((c) => c !== id);
    const np = map.nodes[newParentId];
    if (index == null || index < 0 || index > np.children.length) np.children.push(id);
    else np.children.splice(index, 0, id);
    n.parent = newParentId;
    np.collapsed = false;
    return true;
  };

  /** Solta um tópico (com sua ramificação) do pai: vira um tópico solto. */
  M.detach = function (map, id) {
    const n = map.nodes[id];
    if (!n || !n.parent) return false;
    const p = map.nodes[n.parent];
    if (p) p.children = p.children.filter((c) => c !== id);
    n.parent = null;
    n.edge = {};
    return true;
  };

  M.addFree = function (map, text, x, y) {
    const n = M.newNode(text, null);
    n.x = x; n.y = y;
    map.nodes[n.id] = n;
    return n;
  };

  // ---------- formas de fundo (funil) ----------
  M.newFunnel = function (x, y, labels) {
    labels = labels || ['Topo · Atrair', 'Meio · Engajar', 'Fundo · Converter'];
    return {
      id: U.uid(), kind: 'funnel', x, y, w: 620, stageH: 130, taper: 0.32,
      stages: labels.map((label, i) => ({ label, color: M.STAGE_COLORS[i % M.STAGE_COLORS.length] })),
    };
  };
  M.getShape = (map, id) => (map.shapes || []).find((s) => s.id === id);
  M.removeShape = function (map, id) {
    const n = (map.shapes || []).length;
    map.shapes = (map.shapes || []).filter((s) => s.id !== id);
    return map.shapes.length !== n;
  };
  M.shapeHeight = (s) => s.stages.length * s.stageH;
  /** Meia largura do funil na altura y (coordenadas do mapa). */
  M.funnelHalfW = function (s, y) {
    const t = U.clamp((y - s.y) / (M.shapeHeight(s) || 1), 0, 1);
    return s.w / 2 * (1 - (1 - s.taper) * t);
  };
  M.inShape = function (s, x, y) {
    if (y < s.y || y > s.y + M.shapeHeight(s)) return false;
    return Math.abs(x - s.x) <= M.funnelHalfW(s, y);
  };

  M.moveSubtree = function (map, id, dx, dy) {
    for (const sid of M.subtreeIds(map, id)) {
      map.nodes[sid].x += dx;
      map.nodes[sid].y += dy;
    }
  };

  /** Copia profunda de uma ramificação com novos ids. */
  M.cloneSubtree = function (map, id, newParentId) {
    const src = map.nodes[id];
    const copy = U.clone(src);
    copy.id = U.uid();
    copy.parent = newParentId;
    copy.children = [];
    map.nodes[copy.id] = copy;
    for (const c of src.children) copy.children.push(M.cloneSubtree(map, c, copy.id));
    return copy.id;
  };

  // ---------- conexões livres entre tópicos ----------
  M.addLink = function (map, from, to) {
    if (!map.links) map.links = [];
    if (from === to || !map.nodes[from] || !map.nodes[to]) return null;
    if (map.links.some((l) => l.from === from && l.to === to)) return null;
    const l = { id: U.uid(), from, to, label: '', color: '', line: 'dashed', arrow: 'end', bend: 0 };
    map.links.push(l);
    return l;
  };
  // ---------- fotos ----------
  // As imagens ficam em map.assets (fora do histórico de desfazer, que guarda só a referência).
  M.IMAGE_SIZES = { S: 100, M: 170, L: 260 };
  M.IMAGE_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
  M.LIMITS.image = 4 * 1024 * 1024; // caracteres do data URL

  M.addAsset = function (map, dataUrl) {
    if (!map.assets) map.assets = {};
    for (const [id, v] of Object.entries(map.assets)) if (v === dataUrl) return id;
    const id = U.uid();
    map.assets[id] = dataUrl;
    return id;
  };

  /** Remove fotos que nenhum tópico usa (chamar só quando o histórico for limpo). */
  M.gcAssets = function (map) {
    if (!map.assets) { map.assets = {}; return 0; }
    const used = new Set(Object.values(map.nodes).map((n) => n.image && n.image.id).filter(Boolean));
    let removed = 0;
    for (const id of Object.keys(map.assets)) if (!used.has(id)) { delete map.assets[id]; removed++; }
    return removed;
  };

  M.getLink = (map, id) => (map.links || []).find((l) => l.id === id);
  M.removeLink = function (map, id) {
    const n = (map.links || []).length;
    map.links = (map.links || []).filter((l) => l.id !== id);
    return map.links.length !== n;
  };

  // ---------- serialização / histórico ----------
  M.snapshot = (map) => JSON.stringify({ rootId: map.rootId, nodes: map.nodes, links: map.links || [], arrows: !!map.arrows,
    shapes: map.shapes || [], structure: M.structure(map), autoLayout: !!map.autoLayout });
  M.restore = function (map, snap) {
    const o = JSON.parse(snap);
    map.rootId = o.rootId;
    map.nodes = o.nodes;
    map.links = o.links || [];
    map.arrows = !!o.arrows;
    map.shapes = o.shapes || [];
    map.structure = o.structure || 'mind';
    map.autoLayout = !!o.autoLayout;
  };

  M.History = class {
    constructor(limit) { this.limit = limit || 150; this.undoStack = []; this.redoStack = []; }
    push(snap) {
      this.undoStack.push(snap);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
      this.redoStack.length = 0;
    }
    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }
    undo(current) { if (!this.canUndo()) return null; this.redoStack.push(current); return this.undoStack.pop(); }
    redo(current) { if (!this.canRedo()) return null; this.undoStack.push(current); return this.redoStack.pop(); }
    clear() { this.undoStack.length = 0; this.redoStack.length = 0; }
  };

  // ---------- validação de dados importados ----------
  const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
  const num = (v, d) => (typeof v === 'number' && isFinite(v) ? U.clamp(v, -1e6, 1e6) : d);

  function cleanStyle(s) {
    const out = {};
    if (!s || typeof s !== 'object') return out;
    if (M.SHAPES.includes(s.shape)) out.shape = s.shape;
    if (M.BORDERS.includes(s.border)) out.border = s.border;
    for (const k of ['fill', 'textColor', 'branch']) if (U.isHex(s[k])) out[k] = s[k].toLowerCase();
    if (typeof s.fontSize === 'number' && isFinite(s.fontSize)) out.fontSize = U.clamp(Math.round(s.fontSize), 8, 72);
    if (typeof s.bold === 'boolean') out.bold = s.bold;
    if (typeof s.italic === 'boolean') out.italic = s.italic;
    return out;
  }

  function cleanEdge(e) {
    const out = {};
    if (!e || typeof e !== 'object') return out;
    const label = str(e.label, M.LIMITS.label).replace(/[\r\n]+/g, ' ').trim();
    if (label) out.label = label;
    if (M.ARROWS.includes(e.arrow)) out.arrow = e.arrow;
    if (M.BORDERS.includes(e.line) && e.line !== 'none') out.line = e.line;
    return out;
  }

  M.cleanEmoji = (v) => str(v, 64).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, M.LIMITS.emoji);

  /**
   * Recebe um objeto desconhecido e devolve um mapa válido com ids novos.
   * Remove nós órfãos, ciclos, campos desconhecidos e links inseguros.
   */
  M.sanitizeMap = function (raw) {
    if (!raw || typeof raw !== 'object' || !raw.nodes || typeof raw.nodes !== 'object') throw new Error('Arquivo sem tópicos válidos.');
    const src = raw.nodes;
    const rootId = typeof raw.rootId === 'string' && src[raw.rootId] ? raw.rootId : Object.keys(src).find((k) => src[k] && !src[k].parent);
    if (!rootId) throw new Error('Tópico central não encontrado.');

    const idMap = new Map();
    const nodes = {};
    let count = 0;
    // fotos: só data URLs de imagem válidas, com tamanho limitado e ids novos
    const assets = {};
    const assetMap = new Map();
    const rawAssets = raw.assets && typeof raw.assets === 'object' ? raw.assets : {};
    const useAsset = (oldId) => {
      if (typeof oldId !== 'string') return null;
      if (assetMap.has(oldId)) return assetMap.get(oldId);
      const v = rawAssets[oldId];
      if (typeof v !== 'string' || v.length > M.LIMITS.image || !M.IMAGE_RE.test(v)) { assetMap.set(oldId, null); return null; }
      const id = U.uid();
      assets[id] = v;
      assetMap.set(oldId, id);
      return id;
    };
    const walk = (oldId, newParent) => {
      if (idMap.has(oldId) || count >= M.LIMITS.nodes) return null;
      const s = src[oldId];
      if (!s || typeof s !== 'object') return null;
      const n = M.newNode(str(s.text, M.LIMITS.text), newParent);
      idMap.set(oldId, n.id);
      count++;
      n.x = num(s.x, 0);
      n.y = num(s.y, 0);
      n.collapsed = s.collapsed === true;
      n.note = str(s.note, M.LIMITS.note);
      n.link = U.safeUrl(s.link) || '';
      n.style = cleanStyle(s.style);
      n.emoji = M.cleanEmoji(s.emoji);
      n.icon = typeof s.icon === 'string' && MM.ICONS && MM.ICONS[s.icon] ? s.icon : '';
      n.edge = cleanEdge(s.edge);
      if (s.image && typeof s.image === 'object') {
        const aid = useAsset(s.image.id);
        if (aid) n.image = { id: aid, size: M.IMAGE_SIZES[s.image.size] ? s.image.size : 'M', ratio: U.clamp(num(s.image.ratio, 1), 0.2, 5) };
      }
      nodes[n.id] = n;
      const kids = Array.isArray(s.children) ? s.children : [];
      for (const k of kids) {
        if (typeof k !== 'string') continue;
        const cid = walk(k, n.id);
        if (cid) n.children.push(cid);
      }
      return n.id;
    };
    const newRoot = walk(rootId, null);
    // tópicos soltos (sem pai) e suas ramificações
    for (const k of Object.keys(src)) {
      const s = src[k];
      if (k !== rootId && s && typeof s === 'object' && !s.parent && !idMap.has(k)) walk(k, null);
    }
    const shapes = [];
    for (const s of Array.isArray(raw.shapes) ? raw.shapes.slice(0, M.LIMITS.shapes) : []) {
      if (!s || typeof s !== 'object' || s.kind !== 'funnel' || !Array.isArray(s.stages)) continue;
      const stages = s.stages.slice(0, M.LIMITS.stages).filter((o) => o && typeof o === 'object').map((o, i) => ({
        label: str(o.label, M.LIMITS.label).replace(/[\r\n]+/g, ' ').trim(),
        color: U.isHex(o.color) ? o.color.toLowerCase() : M.STAGE_COLORS[i % M.STAGE_COLORS.length],
      }));
      if (!stages.length) continue;
      shapes.push({
        id: U.uid(), kind: 'funnel', x: num(s.x, 0), y: num(s.y, 0),
        w: U.clamp(num(s.w, 620), 160, 6000), stageH: U.clamp(num(s.stageH, 130), 40, 2000),
        taper: U.clamp(num(s.taper, 0.32), 0.1, 1), stages,
      });
    }
    const now = Date.now();
    const links = [];
    for (const l of Array.isArray(raw.links) ? raw.links.slice(0, M.LIMITS.links) : []) {
      if (!l || typeof l !== 'object') continue;
      const from = idMap.get(l.from), to = idMap.get(l.to);
      if (!from || !to || from === to) continue;
      links.push({
        id: U.uid(), from, to,
        label: str(l.label, M.LIMITS.label).replace(/[\r\n]+/g, ' ').trim(),
        color: U.isHex(l.color) ? l.color.toLowerCase() : '',
        line: M.BORDERS.includes(l.line) && l.line !== 'none' ? l.line : 'dashed',
        arrow: M.ARROWS.includes(l.arrow) ? l.arrow : 'end',
        bend: U.clamp(num(l.bend, 0), -2, 2),
      });
    }
    const v = raw.view && typeof raw.view === 'object' ? { x: num(raw.view.x, 0), y: num(raw.view.y, 0), k: U.clamp(num(raw.view.k, 1), 0.1, 4) } : null;
    return {
      id: U.uid(),
      name: str(raw.name, M.LIMITS.name).trim() || 'Mapa importado',
      created: num(raw.created, now) || now,
      updated: now,
      rootId: newRoot,
      nodes,
      view: v,
      links,
      assets,
      arrows: raw.arrows === true,
      autoLayout: raw.autoLayout === true,
      structure: M.STRUCTURES.includes(raw.structure) ? raw.structure : 'mind',
      shapes,
    };
  };

  /** Interpreta um arquivo JSON importado: um mapa ou uma cópia de segurança. */
  M.parseImport = function (text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('O arquivo não é um JSON válido.'); }
    if (data && data.format === M.BACKUP_FORMAT && Array.isArray(data.maps)) {
      return { kind: 'backup', created: num(data.created, Date.now()), label: str(data.label, 120), maps: data.maps.map(M.sanitizeMap) };
    }
    if (data && data.format === M.FORMAT && data.map) return { kind: 'map', maps: [M.sanitizeMap(data.map)] };
    if (data && data.nodes) return { kind: 'map', maps: [M.sanitizeMap(data)] };
    throw new Error('Formato de arquivo não reconhecido.');
  };

  M.exportObject = (map) => ({ format: M.FORMAT, version: M.VERSION, exported: new Date().toISOString(), map });

  MM.M = M;
})(window.MM);
