'use strict';
(function (MM) {
  const { U, M, L, R, E, D, Store } = MM;
  const $ = (id) => document.getElementById(id);
  const h = U.h;

  const S = {
    maps: [],
    map: null,
    sel: null,
    theme: 'light',
    view: { x: 0, y: 0, k: 1 },
    history: new M.History(150),
    pointers: new Map(),
    drag: null,
    pan: null,
    pinch: null,
    editing: null,
    lastTap: { id: null, t: 0 },
    exportOpts: { tab: 'pdf', paper: 'A4', orientation: 'auto', mode: 'fit', marginMm: 10, dpi: 220, theme: 'light', expandAll: false, pngScale: 2, transparent: false, minPt: 7 },
  };
  MM.state = S; // útil para depuração

  const svg = $('canvas');
  const vp = $('viewport');
  const theme = () => R.THEMES[S.theme];

  // =====================================================================
  // Renderização e visualização
  // =====================================================================
  let raf = 0;
  function render() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; renderNow(); });
  }
  function renderNow() {
    if (!S.map) return;
    if (S.sel && !S.map.nodes[S.sel]) S.sel = null;
    R.draw(vp, S.map, theme(), {
      interactive: true,
      selectedId: S.sel,
      dropId: S.drag && S.drag.dropId,
      draggingId: S.drag && S.drag.moved ? S.drag.id : null,
    });
    if (S.sel) {
      const g = vp.querySelector(`.node[data-id="${S.sel}"]`);
      if (g) g.classList.add('selected');
    }
    applyView();
    updateToolbar();
    updateInspector();
    if (S.editing) positionEditor();
  }

  function applyView() {
    const v = S.view;
    vp.setAttribute('transform', `translate(${v.x.toFixed(2)},${v.y.toFixed(2)}) scale(${v.k.toFixed(4)})`);
    $('btnZoomReset').textContent = Math.round(v.k * 100) + '%';
    if (S.editing) positionEditor();
  }

  function svgRect() { return svg.getBoundingClientRect(); }

  function toWorld(cx, cy) {
    const r = svgRect();
    return { x: (cx - r.left - S.view.x) / S.view.k, y: (cy - r.top - S.view.y) / S.view.k };
  }

  function zoomAt(cx, cy, k) {
    k = U.clamp(k, 0.1, 4);
    const r = svgRect();
    const w = toWorld(cx, cy);
    S.view.k = k;
    S.view.x = cx - r.left - w.x * k;
    S.view.y = cy - r.top - w.y * k;
    applyView();
    saveViewSoon();
  }

  function zoomBy(f) {
    const r = svgRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, S.view.k * f);
  }

  function fitView() {
    if (!S.map) return;
    const b = R.contentBBox(S.map);
    const r = svgRect();
    if (!r.width || !r.height) return;
    const k = U.clamp(Math.min(r.width / b.w, r.height / b.h, 1.15) * 0.94, 0.1, 4);
    S.view = { k, x: r.width / 2 - (b.x + b.w / 2) * k, y: r.height / 2 - (b.y + b.h / 2) * k };
    applyView();
    saveViewSoon();
  }

  function ensureVisible(id) {
    const n = S.map.nodes[id];
    if (!n) return;
    const b = L.box(S.map, id);
    const r = svgRect();
    const k = S.view.k, m = 40;
    const sx1 = (n.x - b.w / 2) * k + S.view.x, sx2 = (n.x + b.w / 2) * k + S.view.x;
    const sy1 = (n.y - b.h / 2) * k + S.view.y, sy2 = (n.y + b.h / 2) * k + S.view.y;
    if (sx1 < m) S.view.x += m - sx1; else if (sx2 > r.width - m) S.view.x -= sx2 - (r.width - m);
    if (sy1 < m) S.view.y += m - sy1; else if (sy2 > r.height - m) S.view.y -= sy2 - (r.height - m);
    applyView();
  }

  // =====================================================================
  // Persistência
  // =====================================================================
  function setStatus(t) { $('saveStatus').textContent = t; }

  async function saveNow() {
    if (!S.map) return;
    S.map.view = Object.assign({}, S.view);
    try {
      await Store.putMap(S.map);
      setStatus('Salvo');
    } catch (e) {
      setStatus('Erro ao salvar');
      D.toast('Não foi possível salvar: ' + (e && e.message), 'error');
    }
  }
  const saveSoon = U.debounce(saveNow, 400);
  const saveViewSoon = U.debounce(() => { if (S.map) { S.map.view = Object.assign({}, S.view); Store.putMap(S.map).catch(() => {}); } }, 900);

  function persist() {
    S.map.updated = Date.now();
    setStatus('Salvando…');
    saveSoon();
    refreshMapListSoon();
  }

  /** Executa uma alteração com suporte a desfazer. */
  function change(fn, o) {
    if (!S.map) return;
    const before = M.snapshot(S.map);
    const r = fn();
    if (r === false) return r;
    S.history.push(before);
    afterChange(o);
    return r;
  }

  function afterChange(o) {
    if (S.map.autoLayout && !(o && o.noAuto)) L.layoutAll(S.map);
    persist();
    render();
  }

  function undo() {
    if (S.editing) commitEdit();
    const snap = S.history.undo(M.snapshot(S.map));
    if (snap == null) return;
    M.restore(S.map, snap);
    persist();
    render();
  }

  function redo() {
    if (S.editing) commitEdit();
    const snap = S.history.redo(M.snapshot(S.map));
    if (snap == null) return;
    M.restore(S.map, snap);
    persist();
    render();
  }

  // =====================================================================
  // Operações nos tópicos
  // =====================================================================
  const NEW_TEXT = 'Novo tópico';

  function select(id) {
    S.sel = id;
    render();
  }

  function addChild() {
    if (!S.map) return;
    if (S.editing) commitEdit();
    const pid = S.sel || S.map.rootId;
    const id = change(() => {
      const n = M.addChild(S.map, pid, NEW_TEXT);
      if (M.isRoot(S.map, pid)) n.style.branch = R.nextBranchColor(S.map);
      L.placeNewChild(S.map, n.id);
      if (!S.map.autoLayout) L.makeRoom(S.map, n.id);
      return n.id;
    });
    S.sel = id;
    renderNow();
    ensureVisible(id);
    startEdit(id, undefined, true);
  }

  function addSibling() {
    if (!S.map) return;
    if (S.editing) commitEdit();
    if (!S.sel || M.isRoot(S.map, S.sel)) return addChild();
    const ref = S.sel;
    const p = S.map.nodes[S.map.nodes[ref].parent];
    const id = change(() => {
      const n = M.addChild(S.map, p.id, NEW_TEXT, p.children.indexOf(ref) + 1);
      if (M.isRoot(S.map, p.id)) n.style.branch = R.nextBranchColor(S.map);
      L.placeAfterSibling(S.map, n.id, ref);
      if (!S.map.autoLayout) L.makeRoom(S.map, n.id);
      return n.id;
    });
    S.sel = id;
    renderNow();
    ensureVisible(id);
    startEdit(id, undefined, true);
  }

  function deleteSelected() {
    if (!S.map || !S.sel) return;
    if (M.isRoot(S.map, S.sel)) { D.toast('O tópico central não pode ser excluído.'); return; }
    const n = S.map.nodes[S.sel];
    const p = S.map.nodes[n.parent];
    const i = p.children.indexOf(n.id);
    const next = p.children[i + 1] || p.children[i - 1] || p.id;
    change(() => M.removeNode(S.map, n.id));
    S.sel = next;
    render();
  }

  function toggleCollapse(id) {
    id = id || S.sel;
    const n = id && S.map.nodes[id];
    if (!n || !n.children.length || !n.parent) return;
    change(() => {
      n.collapsed = !n.collapsed;
      if (!n.collapsed && !S.map.autoLayout) L.makeRoom(S.map, id);
    });
  }

  function setAllCollapsed(collapsed) {
    change(() => {
      for (const n of Object.values(S.map.nodes)) if (n.parent && n.children.length) n.collapsed = collapsed;
      if (!collapsed && !S.map.autoLayout) L.layoutAll(S.map);
    });
  }

  function layoutSelected() {
    if (!S.map) return;
    const id = S.sel || S.map.rootId;
    change(() => L.layoutSubtree(S.map, id), { noAuto: true });
    D.toast(M.isRoot(S.map, id) ? 'Mapa reorganizado' : 'Ramificação reorganizada');
  }

  function layoutAll() {
    change(() => L.layoutAll(S.map), { noAuto: true });
    fitView();
  }

  function duplicateSelected() {
    if (!S.sel || M.isRoot(S.map, S.sel)) return;
    const ref = S.sel;
    const id = change(() => {
      const p = S.map.nodes[S.map.nodes[ref].parent];
      const cid = M.cloneSubtree(S.map, ref, p.id);
      p.children.splice(p.children.indexOf(ref) + 1, 0, cid);
      const before = { x: S.map.nodes[cid].x, y: S.map.nodes[cid].y };
      L.placeAfterSibling(S.map, cid, ref);
      const n = S.map.nodes[cid];
      const dx = n.x - before.x, dy = n.y - before.y;
      n.x = before.x; n.y = before.y;
      M.moveSubtree(S.map, cid, dx, dy);
      if (!S.map.autoLayout) L.makeRoom(S.map, cid);
      return cid;
    });
    S.sel = id;
    render();
  }

  function setStyle(prop, value) {
    const n = S.sel && S.map.nodes[S.sel];
    if (!n) return;
    if ((n.style[prop] ?? null) === (value ?? null)) return;
    change(() => keepAnchor(n.id, () => {
      if (value == null || value === '') delete n.style[prop];
      else n.style[prop] = value;
    }));
  }

  function resetStyle() {
    const n = S.sel && S.map.nodes[S.sel];
    if (!n) return;
    change(() => {
      const keep = M.depth(S.map, n.id) === 1 && n.style.branch ? { branch: n.style.branch } : {};
      keepAnchor(n.id, () => { n.style = keep; });
    });
  }

  /**
   * Mantém a borda voltada ao pai no lugar quando a largura do tópico muda,
   * deslocando os filhos para não sobrepor.
   */
  function keepAnchor(id, mutate) {
    const map = S.map;
    const n = map.nodes[id];
    const oldW = L.box(map, id).w;
    mutate();
    const newW = L.box(map, id).w;
    const dw = (newW - oldW) / 2;
    if (!dw) return;
    if (M.isRoot(map, id)) {
      for (const c of n.children) M.moveSubtree(map, c, map.nodes[c].x >= n.x ? dw : -dw, 0);
    } else {
      const side = M.side(map, id);
      n.x += side * dw;
      for (const c of n.children) M.moveSubtree(map, c, side * dw * 2, 0);
    }
  }

  function openLink(id) {
    const n = S.map.nodes[id || S.sel];
    const url = n && U.safeUrl(n.link);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  function navigate(dir) {
    if (!S.map) return;
    if (!S.sel) { select(S.map.rootId); return; }
    const cur = S.map.nodes[S.sel];
    let best = null, bestScore = Infinity;
    for (const id of M.visibleIds(S.map)) {
      if (id === S.sel) continue;
      const n = S.map.nodes[id];
      const dx = n.x - cur.x, dy = n.y - cur.y;
      let main, cross;
      if (dir === 'ArrowRight') { main = dx; cross = dy; }
      else if (dir === 'ArrowLeft') { main = -dx; cross = dy; }
      else if (dir === 'ArrowDown') { main = dy; cross = dx; }
      else { main = -dy; cross = dx; }
      if (main <= 2) continue;
      const score = main + Math.abs(cross) * 2.5;
      if (score < bestScore) { bestScore = score; best = id; }
    }
    if (best) { select(best); ensureVisible(best); }
  }

  // =====================================================================
  // Edição de texto
  // =====================================================================
  const editor = $('editor');

  function startEdit(id, initial, selectAll) {
    if (S.editing) commitEdit();
    const n = S.map.nodes[id];
    if (!n) return;
    S.sel = id;
    S.editing = { id, original: n.text, fresh: n.text === NEW_TEXT && selectAll };
    editor.value = initial != null ? initial : n.text;
    editor.hidden = false;
    renderNow();
    positionEditor();
    editor.focus({ preventScroll: true });
    if (initial != null) editor.setSelectionRange(editor.value.length, editor.value.length);
    else editor.select();
  }

  function positionEditor() {
    const ed = S.editing;
    if (!ed || !S.map.nodes[ed.id]) return;
    const n = S.map.nodes[ed.id];
    const b = L.box(S.map, ed.id);
    const k = S.view.k;
    const fs = U.clamp(b.fontSize * k, 12, 42);
    editor.style.fontSize = fs + 'px';
    editor.style.fontWeight = b.bold ? '700' : '400';
    editor.style.fontStyle = b.italic ? 'italic' : 'normal';
    const w = Math.max(b.w * k + 16, 160);
    editor.style.width = w + 'px';
    editor.style.height = 'auto';
    const hgt = Math.max(editor.scrollHeight + 4, b.h * k);
    editor.style.height = hgt + 'px';
    editor.style.left = (n.x * k + S.view.x - w / 2) + 'px';
    editor.style.top = (n.y * k + S.view.y - hgt / 2) + 'px';
  }

  function commitEdit() {
    const ed = S.editing;
    if (!ed) return;
    S.editing = null;
    editor.hidden = true;
    const n = S.map.nodes[ed.id];
    if (!n) return;
    let text = editor.value.replace(/\r/g, '').replace(/^\s+|\s+$/g, '').slice(0, M.LIMITS.text);
    if (!text) text = ed.original || NEW_TEXT;
    if (text !== n.text) {
      const doIt = () => keepAnchor(n.id, () => { n.text = text; });
      if (ed.fresh) { doIt(); afterChange(); } // texto de um tópico recém-criado não gera passo extra
      else change(doIt);
    } else {
      render();
    }
    svg.focus({ preventScroll: true });
  }

  function cancelEdit() {
    if (!S.editing) return;
    S.editing = null;
    editor.hidden = true;
    render();
    svg.focus({ preventScroll: true });
  }

  editor.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(); addChild(); }
  });
  editor.addEventListener('input', positionEditor);
  editor.addEventListener('blur', () => { if (S.editing) commitEdit(); });

  // =====================================================================
  // Ponteiro: selecionar, arrastar, mover a tela, pinça
  // =====================================================================
  function hitNode(wx, wy, exclude) {
    const ids = M.visibleIds(S.map);
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i];
      if (exclude && exclude.has(id)) continue;
      const r = L.rect(S.map, id);
      if (wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h) return id;
    }
    return null;
  }

  function pinchInfo() {
    const [a, b] = [...S.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  svg.addEventListener('pointerdown', (e) => {
    if (!S.map) return;
    if (S.editing) commitEdit();
    closeMenus();
    svg.focus({ preventScroll: true });
    S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { svg.setPointerCapture(e.pointerId); } catch (err) { /* ignorado */ }

    if (S.pointers.size === 2) {
      endDrag(true);
      S.pan = null;
      const p = pinchInfo();
      S.pinch = { d0: p.d, k0: S.view.k, w: toWorld(p.cx, p.cy) };
      return;
    }
    if (S.pointers.size > 2) return;

    if (e.pointerType === 'mouse' && e.button === 1) {
      e.preventDefault();
      S.pan = { sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y, moved: true };
      svg.classList.add('panning');
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const nodeEl = e.target.closest && e.target.closest('.node');
    if (nodeEl) {
      const id = nodeEl.getAttribute('data-id');
      const actEl = e.target.closest('[data-act]');
      const start = {};
      for (const sid of M.subtreeIds(S.map, id)) start[sid] = [S.map.nodes[sid].x, S.map.nodes[sid].y];
      S.drag = { id, sx: e.clientX, sy: e.clientY, start, moved: false, dropId: null, act: actEl && actEl.getAttribute('data-act'), snap: null };
      if (S.sel !== id) select(id);
    } else {
      S.pan = { sx: e.clientX, sy: e.clientY, vx: S.view.x, vy: S.view.y, moved: false };
    }
  });

  svg.addEventListener('pointermove', (e) => {
    if (!S.pointers.has(e.pointerId)) return;
    S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (S.pinch && S.pointers.size >= 2) {
      const p = pinchInfo();
      const r = svgRect();
      const k = U.clamp(S.pinch.k0 * p.d / S.pinch.d0, 0.1, 4);
      S.view.k = k;
      S.view.x = p.cx - r.left - S.pinch.w.x * k;
      S.view.y = p.cy - r.top - S.pinch.w.y * k;
      applyView();
      return;
    }

    const d = S.drag;
    if (d) {
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (!d.moved) {
        if (Math.hypot(dx, dy) < 5) return;
        d.moved = true;
        d.snap = M.snapshot(S.map);
        svg.classList.add('dragging');
      }
      const wdx = dx / S.view.k, wdy = dy / S.view.k;
      for (const [sid, [x, y]] of Object.entries(d.start)) {
        S.map.nodes[sid].x = x + wdx;
        S.map.nodes[sid].y = y + wdy;
      }
      const w = toWorld(e.clientX, e.clientY);
      const target = hitNode(w.x, w.y, new Set(Object.keys(d.start)));
      d.dropId = target && target !== S.map.nodes[d.id].parent ? target : null;
      $('dropHint').hidden = !d.dropId;
      render();
      return;
    }

    const p = S.pan;
    if (p) {
      const dx = e.clientX - p.sx, dy = e.clientY - p.sy;
      if (!p.moved && Math.hypot(dx, dy) < 4) return;
      if (!p.moved) { p.moved = true; svg.classList.add('panning'); }
      S.view.x = p.vx + dx;
      S.view.y = p.vy + dy;
      applyView();
    }
  });

  function endDrag(cancelled) {
    const d = S.drag;
    if (!d) return;
    S.drag = null;
    svg.classList.remove('dragging');
    $('dropHint').hidden = true;
    if (!d.moved) { render(); return; }
    S.history.push(d.snap);
    if (!cancelled && d.dropId && M.reparent(S.map, d.id, d.dropId)) {
      const n = S.map.nodes[d.id];
      if (M.isRoot(S.map, d.dropId) && !n.style.branch) n.style.branch = R.nextBranchColor(S.map);
      if (!S.map.autoLayout) {
        const ox = n.x, oy = n.y;
        L.placeNewChild(S.map, d.id);
        const nx = n.x, ny = n.y;
        n.x = ox; n.y = oy;
        M.moveSubtree(S.map, d.id, nx - ox, ny - oy);
        L.layoutSubtree(S.map, d.id);
        L.makeRoom(S.map, d.id);
      }
      D.toast('Tópico movido para "' + S.map.nodes[d.dropId].text.slice(0, 40) + '"');
    }
    afterChange();
  }

  function onPointerEnd(e) {
    if (!S.pointers.has(e.pointerId)) return;
    S.pointers.delete(e.pointerId);
    if (S.pinch) {
      if (S.pointers.size < 2) { S.pinch = null; saveViewSoon(); }
      return;
    }
    const d = S.drag;
    if (d) {
      if (d.moved) { endDrag(e.type === 'pointercancel'); return; }
      S.drag = null;
      if (e.type === 'pointercancel') return;
      if (d.act === 'toggle') { toggleCollapse(d.id); return; }
      if (d.act === 'link') { openLink(d.id); return; }
      if (d.act === 'note') { openInspector(true); setTimeout(() => $('noteInput').focus(), 50); return; }
      const now = performance.now();
      if (S.lastTap.id === d.id && now - S.lastTap.t < 420) {
        S.lastTap = { id: null, t: 0 };
        startEdit(d.id);
      } else {
        S.lastTap = { id: d.id, t: now };
      }
      return;
    }
    const p = S.pan;
    if (p) {
      S.pan = null;
      svg.classList.remove('panning');
      if (p.moved) saveViewSoon();
      else if (S.sel) select(null);
    }
  }
  svg.addEventListener('pointerup', onPointerEnd);
  svg.addEventListener('pointercancel', onPointerEnd);
  svg.addEventListener('lostpointercapture', (e) => { if (S.pointers.has(e.pointerId)) onPointerEnd(e); });
  svg.addEventListener('contextmenu', (e) => e.preventDefault());

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (!S.map) return;
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    if (e.shiftKey && !e.ctrlKey) {
      S.view.x -= (e.deltaY || e.deltaX) * unit;
      applyView();
      saveViewSoon();
      return;
    }
    const f = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0018));
    zoomAt(e.clientX, e.clientY, S.view.k * f);
  }, { passive: false });

  // =====================================================================
  // Teclado
  // =====================================================================
  document.addEventListener('keydown', (e) => {
    if (D.isOpen() || S.editing || !S.map) return;
    const t = e.target;
    const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;

    if (e.key === 'Escape') {
      if (!$('moreMenu').hidden) { closeMenus(); return; }
      if ($('drawer').classList.contains('open')) { closeDrawer(); return; }
      if (inField) { t.blur(); return; }
    }
    if (inField) return;

    if (ctrl && !e.altKey) {
      const lk = k.toLowerCase();
      if (lk === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (lk === 'y' || (lk === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      else if (k === '0') { e.preventDefault(); fitView(); }
      else if (lk === 'l') { e.preventDefault(); layoutSelected(); }
      else if (lk === 'd') { e.preventDefault(); duplicateSelected(); }
      else if (lk === 'e') { e.preventDefault(); openExport(); }
      else if (lk === 'p') { e.preventDefault(); openExport(); }
      else if (lk === 's') { e.preventDefault(); saveSoon.flush(); saveNow(); D.toast('Mapa salvo no dispositivo'); }
      else if (lk === 'o') { e.preventDefault(); openDrawer(); }
      else if (k === '=' || k === '+') { e.preventDefault(); zoomBy(1.2); }
      else if (k === '-') { e.preventDefault(); zoomBy(1 / 1.2); }
      return;
    }
    if (e.altKey) return;

    switch (k) {
      case 'Tab': case 'Insert': e.preventDefault(); addChild(); return;
      case 'Enter': e.preventDefault(); if (S.sel) addSibling(); else select(S.map.rootId); return;
      case 'Delete': case 'Backspace': e.preventDefault(); deleteSelected(); return;
      case 'F2': e.preventDefault(); if (S.sel) startEdit(S.sel); return;
      case ' ': e.preventDefault(); if (S.sel) toggleCollapse(); return;
      case 'Escape': if (S.sel) select(null); return;
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': e.preventDefault(); navigate(k); return;
      case '+': case '=': zoomBy(1.2); return;
      case '-': zoomBy(1 / 1.2); return;
      default:
        if (S.sel && k.length === 1 && !e.repeat) { e.preventDefault(); startEdit(S.sel, k); }
    }
  });

  // =====================================================================
  // Barra de ferramentas e menus
  // =====================================================================
  function updateToolbar() {
    const sel = S.sel && S.map.nodes[S.sel];
    $('btnUndo').disabled = !S.history.canUndo();
    $('btnRedo').disabled = !S.history.canRedo();
    $('btnDelete').disabled = !sel || !sel.parent;
    $('btnAuto').setAttribute('aria-pressed', S.map.autoLayout ? 'true' : 'false');
    if (document.activeElement !== $('mapName')) $('mapName').value = S.map.name;
  }

  function closeMenus() {
    const m = $('moreMenu');
    if (!m.hidden) { m.hidden = true; $('btnMore').setAttribute('aria-expanded', 'false'); }
  }

  function toggleMoreMenu() {
    const m = $('moreMenu');
    if (!m.hidden) { closeMenus(); return; }
    m.hidden = false;
    const r = $('btnMore').getBoundingClientRect();
    const w = m.offsetWidth;
    m.style.top = (r.bottom + 6) + 'px';
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    $('btnMore').setAttribute('aria-expanded', 'true');
    const first = m.querySelector('button');
    if (first) first.focus();
  }

  function bindToolbar() {
    $('btnMenu').addEventListener('click', openDrawer);
    $('btnUndo').addEventListener('click', undo);
    $('btnRedo').addEventListener('click', redo);
    $('btnAddChild').addEventListener('click', addChild);
    $('btnAddSibling').addEventListener('click', addSibling);
    $('btnDelete').addEventListener('click', deleteSelected);
    $('btnLayout').addEventListener('click', layoutSelected);
    $('btnAuto').addEventListener('click', () => {
      const on = !S.map.autoLayout;
      change(() => { S.map.autoLayout = on; if (on) L.layoutAll(S.map); });
      D.toast(on ? 'Organização automática ativada' : 'Posicionamento livre ativado');
    });
    $('btnZoomIn').addEventListener('click', () => zoomBy(1.2));
    $('btnZoomOut').addEventListener('click', () => zoomBy(1 / 1.2));
    $('btnZoomReset').addEventListener('click', () => zoomBy(1 / S.view.k));
    $('btnFit').addEventListener('click', fitView);
    $('btnTheme').addEventListener('click', () => setTheme(S.theme === 'light' ? 'dark' : 'light'));
    $('btnInspector').addEventListener('click', () => openInspector($('inspector').classList.contains('closed')));
    $('btnInspClose').addEventListener('click', () => openInspector(false));
    $('btnExport').addEventListener('click', openExport);
    $('btnMore').addEventListener('click', (e) => { e.stopPropagation(); toggleMoreMenu(); });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.menu-wrap')) closeMenus(); });
    $('moreMenu').addEventListener('click', (e) => {
      const b = e.target.closest('[data-cmd]');
      if (!b) return;
      closeMenus();
      const cmd = b.getAttribute('data-cmd');
      ({
        exportJson: () => exportJson(S.map),
        importJson: importJson,
        exportSvg: () => U.downloadBlob(E.svgFile(S.map, theme(), {}), U.safeFilename(S.map.name) + '.svg'),
        backups: openBackups,
        expandAll: () => setAllCollapsed(false),
        collapseAll: () => setAllCollapsed(true),
        layoutAll: layoutAll,
        shortcuts: openShortcuts,
      })[cmd]();
    });

    const name = $('mapName');
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); if (e.key === 'Escape') { name.value = S.map.name; name.blur(); } });
    name.addEventListener('change', () => {
      const v = name.value.trim().slice(0, M.LIMITS.name);
      if (!v) { name.value = S.map.name; return; }
      S.map.name = v;
      persist();
    });

    $('btnDrawerClose').addEventListener('click', closeDrawer);
    $('scrim').addEventListener('click', closeDrawer);
    $('btnNewMap').addEventListener('click', newMap);
    $('btnImport').addEventListener('click', importJson);
    $('btnBackups').addEventListener('click', openBackups);
    $('mapSearch').addEventListener('input', renderMapList);
  }

  function setTheme(t) {
    S.theme = t === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', S.theme);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', S.theme === 'dark' ? '#1c2027' : '#0e8a7e');
    $('btnTheme').querySelector('use').setAttribute('href', S.theme === 'dark' ? '#i-sun' : '#i-moon');
    Store.setMeta('theme', S.theme).catch(() => {});
    render();
  }

  // =====================================================================
  // Painel de estilo
  // =====================================================================
  const SHAPES = [
    ['', 'Padrão', '<path d="M4 3h26M4 15h26" stroke-dasharray="2 2"/>'],
    ['rounded', 'Arredond.', '<rect x="3" y="2" width="28" height="14" rx="4"/>'],
    ['rect', 'Retângulo', '<rect x="3" y="2" width="28" height="14"/>'],
    ['pill', 'Cápsula', '<rect x="3" y="2" width="28" height="14" rx="7"/>'],
    ['ellipse', 'Elipse', '<ellipse cx="17" cy="9" rx="14" ry="7"/>'],
    ['hexagon', 'Hexágono', '<path d="M8 2h18l5 7-5 7H8L3 9z"/>'],
    ['underline', 'Sublinhado', '<path d="M3 15h28"/><path d="M9 9h16" stroke-width="1"/>'],
    ['none', 'Só texto', '<path d="M9 9h16" stroke-width="1"/>'],
  ];
  const SWATCHES = {
    fill: ['#ffffff', '#fff3bf', '#ffd8a8', '#ffc9c9', '#fcc2d7', '#eebefa', '#d0bfff', '#a5d8ff', '#99e9f2', '#b2f2bb', '#d8f5a2', '#dee2e6', '#253041'],
    textColor: ['#1f2630', '#ffffff', '#c92a2a', '#1864ab', '#2b8a3e', '#862e9c', '#d9480f', '#868e96'],
    branch: R.PALETTE.concat(['#495057']),
  };
  const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

  function buildInspector() {
    const grid = $('shapeGrid');
    for (const [val, label, path] of SHAPES) {
      const b = h('button', { class: 'btn', 'data-shape': val, title: label, 'aria-pressed': 'false' });
      // ícones estáticos e confiáveis (não vêm do usuário)
      const ic = U.s('svg', { viewBox: '0 0 34 18', 'aria-hidden': 'true' });
      ic.innerHTML = path;
      b.appendChild(ic);
      b.appendChild(document.createTextNode(label));
      b.addEventListener('click', () => setStyle('shape', val || null));
      grid.appendChild(b);
    }
    for (const box of document.querySelectorAll('.swatches')) {
      const prop = box.getAttribute('data-prop');
      const auto = h('button', { class: 'swatch auto', 'data-value': '', title: 'Automática', 'aria-label': 'Cor automática', 'aria-pressed': 'false' });
      auto.addEventListener('click', () => setStyle(prop, null));
      box.appendChild(auto);
      for (const c of SWATCHES[prop]) {
        const s = h('button', { class: 'swatch', 'data-value': c, title: c, 'aria-label': 'Cor ' + c, 'aria-pressed': 'false' });
        s.style.background = c;
        s.addEventListener('click', () => setStyle(prop, c));
        box.appendChild(s);
      }
      const input = h('input', { type: 'color', 'aria-label': 'Escolher outra cor' });
      input.addEventListener('change', () => setStyle(prop, input.value.toLowerCase()));
      box.appendChild(h('label', { class: 'swatch custom', title: 'Outra cor' }, input));
    }
    const fs = $('fontSize');
    fs.appendChild(h('option', { value: '', text: 'Tamanho padrão' }));
    for (const v of FONT_SIZES) fs.appendChild(h('option', { value: String(v), text: v + ' px' }));
    fs.addEventListener('change', () => setStyle('fontSize', fs.value ? Number(fs.value) : null));

    $('btnBold').addEventListener('click', () => { const t = L.typo(S.map, S.sel); setStyle('bold', !t.bold); });
    $('btnItalic').addEventListener('click', () => { const t = L.typo(S.map, S.sel); setStyle('italic', t.italic ? null : true); });
    for (const b of $('borderSeg').querySelectorAll('[data-border]')) {
      b.addEventListener('click', () => setStyle('border', b.getAttribute('data-border') || null));
    }

    const note = $('noteInput');
    note.addEventListener('focus', () => { S.noteSnap = S.sel ? { id: S.sel, snap: M.snapshot(S.map), text: S.map.nodes[S.sel].note } : null; });
    note.addEventListener('input', () => {
      if (!S.noteSnap || !S.map.nodes[S.noteSnap.id]) return;
      S.map.nodes[S.noteSnap.id].note = note.value.slice(0, M.LIMITS.note);
      persist();
      render();
    });
    note.addEventListener('blur', () => {
      const ns = S.noteSnap;
      S.noteSnap = null;
      if (ns && S.map.nodes[ns.id] && S.map.nodes[ns.id].note !== ns.text) {
        S.history.push(ns.snap);
        if (!S.map.autoLayout) { /* ícone de nota pode mudar a largura */ }
        afterChange();
      }
    });

    const link = $('linkInput');
    const applyLink = () => {
      const n = S.sel && S.map.nodes[S.sel];
      if (!n) return;
      const raw = link.value.trim();
      const url = raw ? U.safeUrl(raw) : '';
      $('linkError').hidden = url !== null;
      if (url === null || url === n.link) return;
      link.value = url;
      change(() => { n.link = url; });
    };
    link.addEventListener('change', applyLink);
    link.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } });
    $('btnOpenLink').addEventListener('click', () => openLink());

    $('iAddChild').addEventListener('click', addChild);
    $('iAddSibling').addEventListener('click', addSibling);
    $('iCollapse').addEventListener('click', () => toggleCollapse());
    $('iLayout').addEventListener('click', layoutSelected);
    $('iDuplicate').addEventListener('click', duplicateSelected);
    $('iResetStyle').addEventListener('click', resetStyle);
    $('iDelete').addEventListener('click', deleteSelected);
  }

  function updateInspector() {
    const n = S.sel && S.map.nodes[S.sel];
    $('inspEmpty').hidden = !!n;
    $('inspBody').hidden = !n;
    if (!n) return;
    const s = n.style;
    const t = L.typo(S.map, n.id);
    $('inspTitle').textContent = n.parent ? 'Tópico' : 'Tópico central';
    for (const b of $('shapeGrid').children) b.setAttribute('aria-pressed', String((s.shape || '') === b.getAttribute('data-shape')));
    const box = L.box(S.map, n.id);
    const col = R.colors(S.map, n.id, theme(), box);
    for (const sw of document.querySelectorAll('.swatches')) {
      const prop = sw.getAttribute('data-prop');
      const cur = s[prop] || '';
      let found = false;
      for (const b of sw.querySelectorAll('button.swatch')) {
        const on = b.getAttribute('data-value') === cur;
        found = found || on;
        b.setAttribute('aria-pressed', String(on));
      }
      const custom = sw.querySelector('.swatch.custom');
      custom.setAttribute('aria-pressed', String(!!cur && !found));
      const inp = custom.querySelector('input');
      const eff = prop === 'fill' ? (col.fill === 'none' ? '#ffffff' : col.fill) : prop === 'textColor' ? col.text : col.branch;
      if (document.activeElement !== inp && U.isHex(eff)) inp.value = eff;
    }
    // o tópico central não tem ramificação própria
    document.querySelector('.swatches[data-prop="branch"]').parentElement.hidden = !n.parent;
    if (document.activeElement !== $('fontSize')) $('fontSize').value = s.fontSize ? String(s.fontSize) : '';
    if (s.fontSize && !FONT_SIZES.includes(s.fontSize)) {
      const sel = $('fontSize');
      if (![...sel.options].some((o) => o.value === String(s.fontSize))) sel.appendChild(h('option', { value: String(s.fontSize), text: s.fontSize + ' px' }));
      sel.value = String(s.fontSize);
    }
    $('btnBold').setAttribute('aria-pressed', String(t.bold));
    $('btnItalic').setAttribute('aria-pressed', String(t.italic));
    for (const b of $('borderSeg').children) b.setAttribute('aria-pressed', String((s.border || '') === b.getAttribute('data-border')));
    const note = $('noteInput');
    if (document.activeElement !== note && note.value !== n.note) note.value = n.note;
    const link = $('linkInput');
    if (document.activeElement !== link) { link.value = n.link; $('linkError').hidden = true; }
    $('btnOpenLink').disabled = !n.link;
    $('iCollapse').querySelector('span').textContent = n.collapsed ? 'Expandir' : 'Recolher';
    $('iCollapse').querySelector('use').setAttribute('href', n.collapsed ? '#i-expand' : '#i-collapse');
    $('iCollapse').disabled = !n.children.length || !n.parent;
    $('iDelete').disabled = !n.parent;
    $('iDuplicate').disabled = !n.parent;
  }

  function openInspector(open) {
    $('inspector').classList.toggle('closed', !open);
    $('btnInspector').setAttribute('aria-pressed', String(open));
    Store.setMeta('inspector', open).catch(() => {});
  }

  // =====================================================================
  // Mapas: lista, abrir, criar, renomear, excluir
  // =====================================================================
  function openDrawer() {
    renderMapList();
    $('drawer').classList.add('open');
    $('scrim').hidden = false;
    setTimeout(() => $('mapSearch').focus(), 50);
  }
  function closeDrawer() {
    $('drawer').classList.remove('open');
    $('scrim').hidden = true;
  }

  const refreshMapListSoon = U.debounce(() => { if ($('drawer').classList.contains('open')) renderMapList(); }, 500);

  function renderMapList() {
    const ul = $('mapList');
    ul.textContent = '';
    const q = $('mapSearch').value.trim().toLowerCase();
    const maps = S.maps.slice().sort((a, b) => b.updated - a.updated)
      .filter((m) => !q || m.name.toLowerCase().includes(q));
    for (const m of maps) {
      const count = Object.keys(m.nodes).length;
      const li = h('li', { class: 'map-item' + (S.map && m.id === S.map.id ? ' active' : '') },
        h('button', { class: 'map-open', onclick: () => { openMap(m.id); closeDrawer(); } },
          h('strong', { text: m.name }),
          h('span', { text: `${count} ${count === 1 ? 'tópico' : 'tópicos'} · ${U.formatDate(m.updated)}` })),
        h('button', { class: 'btn icon', title: 'Renomear', 'aria-label': 'Renomear ' + m.name, onclick: () => renameMap(m.id) }, U.icon('edit')),
        h('button', { class: 'btn icon', title: 'Duplicar', 'aria-label': 'Duplicar ' + m.name, onclick: () => duplicateMap(m.id) }, U.icon('copy')),
        h('button', { class: 'btn icon', title: 'Exportar JSON', 'aria-label': 'Exportar ' + m.name, onclick: () => exportJson(m) }, U.icon('file')),
        h('button', { class: 'btn icon danger', title: 'Excluir', 'aria-label': 'Excluir ' + m.name, onclick: () => deleteMap(m.id) }, U.icon('trash')));
      ul.appendChild(li);
    }
    if (!maps.length) ul.appendChild(h('li', { class: 'muted small', style: 'padding:12px 8px', text: q ? 'Nenhum mapa encontrado.' : 'Nenhum mapa ainda.' }));
    updateStorageInfo();
  }

  async function updateStorageInfo() {
    let txt = `${S.maps.length} ${S.maps.length === 1 ? 'mapa salvo' : 'mapas salvos'} neste dispositivo (${Store.kind}).`;
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage != null) txt += ` Uso: ${(est.usage / 1048576).toFixed(1)} MB.`;
      }
    } catch (e) { /* opcional */ }
    $('storageInfo').textContent = txt;
  }

  function openMap(id) {
    const m = S.maps.find((x) => x.id === id);
    if (!m) return;
    if (S.editing) commitEdit();
    saveSoon.flush();
    S.map = m;
    S.sel = null;
    S.history.clear();
    if (m.autoLayout == null) m.autoLayout = false;
    Store.setMeta('lastMap', id).catch(() => {});
    renderNow();
    if (m.view && isFinite(m.view.k)) { S.view = Object.assign({}, m.view); applyView(); }
    else fitView();
    renderMapList();
    setStatus('Salvo');
  }

  async function addMaps(maps) {
    for (const m of maps) {
      S.maps.push(m);
      await Store.putMap(m);
    }
  }

  async function newMap() {
    const name = await D.prompt('Novo mapa', 'Novo mapa', { label: 'Nome do mapa', okLabel: 'Criar' });
    if (!name) return;
    const m = M.createMap(name, name);
    await addMaps([m]);
    openMap(m.id);
    closeDrawer();
    S.view = { k: 1, x: svgRect().width / 2, y: svgRect().height / 2 };
    applyView();
    select(m.rootId);
  }

  async function renameMap(id) {
    const m = S.maps.find((x) => x.id === id);
    if (!m) return;
    const name = await D.prompt('Renomear mapa', m.name, { label: 'Nome do mapa' });
    if (!name || name === m.name) return;
    m.name = name.slice(0, M.LIMITS.name);
    m.updated = Date.now();
    await Store.putMap(m);
    renderMapList();
    if (S.map === m) $('mapName').value = m.name;
  }

  async function duplicateMap(id) {
    const m = S.maps.find((x) => x.id === id);
    if (!m) return;
    if (m === S.map) saveSoon.flush();
    const copy = U.clone(m);
    copy.id = U.uid();
    copy.name = ('Cópia de ' + m.name).slice(0, M.LIMITS.name);
    copy.created = copy.updated = Date.now();
    await addMaps([copy]);
    renderMapList();
    D.toast('Mapa duplicado');
  }

  async function deleteMap(id) {
    const m = S.maps.find((x) => x.id === id);
    if (!m) return;
    const ok = await D.confirm(`O mapa "${m.name}" será excluído deste dispositivo. Esta ação não pode ser desfeita (a não ser por uma cópia de segurança).`,
      { title: 'Excluir mapa?', okLabel: 'Excluir', danger: true });
    if (!ok) return;
    if (S.map === m) saveSoon.flush();
    await Store.deleteMap(id);
    S.maps = S.maps.filter((x) => x.id !== id);
    if (S.map === m) {
      S.map = null;
      if (!S.maps.length) {
        const blank = M.createMap('Novo mapa', 'Tópico central');
        await addMaps([blank]);
      }
      openMap(S.maps.slice().sort((a, b) => b.updated - a.updated)[0].id);
    }
    renderMapList();
    D.toast('Mapa excluído');
  }

  // =====================================================================
  // JSON: exportar e importar
  // =====================================================================
  function exportJson(map) {
    if (map === S.map) saveSoon.flush();
    U.downloadBlob(E.json(map), U.safeFilename(map.name) + '.json');
  }

  async function importJson() {
    const file = await U.pickFile('.json,application/json');
    if (!file) return;
    if (file.size > 30 * 1048576) { D.toast('Arquivo muito grande (máx. 30 MB).', 'error'); return; }
    let data;
    try {
      data = M.parseImport(await U.readFileAsText(file));
    } catch (e) {
      D.toast('Não foi possível importar: ' + e.message, 'error');
      return;
    }
    if (data.kind === 'map') {
      await addMaps(data.maps);
      openMap(data.maps[0].id);
      closeDrawer();
      D.toast(`Mapa "${data.maps[0].name}" importado`);
      return;
    }
    const choice = await D.open({
      title: 'Arquivo de cópia de segurança',
      body: `Este arquivo contém ${data.maps.length} ${data.maps.length === 1 ? 'mapa' : 'mapas'}. O que deseja fazer?`,
      actions: [
        { label: 'Cancelar', value: null },
        { label: 'Guardar nas cópias', value: 'backup' },
        { label: 'Adicionar mapas', value: 'add', kind: 'primary' },
      ],
    }).result;
    if (choice === 'add') {
      await addMaps(data.maps);
      if (data.maps.length) openMap(data.maps[0].id);
      renderMapList();
      D.toast(`${data.maps.length} mapas importados`);
    } else if (choice === 'backup') {
      await Store.putBackup({ id: U.uid(), created: data.created || Date.now(), label: data.label || 'Importada de arquivo', auto: false, maps: data.maps });
      D.toast('Cópia de segurança importada');
    }
  }

  // =====================================================================
  // Cópias de segurança
  // =====================================================================
  async function createBackup(label, auto) {
    saveSoon.flush();
    await saveNow();
    const maps = await Store.getMaps();
    const b = { id: U.uid(), created: Date.now(), label, auto: !!auto, maps };
    await Store.putBackup(b);
    if (auto) {
      const all = (await Store.getBackups()).filter((x) => x.auto).sort((a, c) => c.created - a.created);
      for (const old of all.slice(10)) await Store.deleteBackup(old.id);
    }
    return b;
  }

  function backupFile(b) {
    const data = { format: M.BACKUP_FORMAT, version: M.VERSION, created: b.created, label: b.label, maps: b.maps };
    return new Blob([JSON.stringify(data)], { type: 'application/json' });
  }

  async function restoreBackup(b) {
    const ok = await D.confirm(`Os mapas atuais serão substituídos pelos ${b.maps.length} mapas desta cópia (${U.formatDate(b.created)}). Antes disso, uma cópia automática do estado atual será criada.`,
      { title: 'Restaurar cópia?', okLabel: 'Restaurar' });
    if (!ok) return false;
    await createBackup('Antes da restauração', true);
    await Store.clearMaps();
    S.maps = [];
    await addMaps(U.clone(b.maps));
    if (!S.maps.length) await addMaps([M.createMap('Novo mapa', 'Tópico central')]);
    S.map = null;
    openMap(S.maps.slice().sort((a, c) => c.updated - a.updated)[0].id);
    D.toast('Cópia restaurada');
    return true;
  }

  async function openBackups() {
    closeDrawer();
    const list = h('ul', { class: 'backup-list' });
    const body = h('div', null,
      h('p', { class: 'muted small', text: 'As cópias ficam guardadas neste navegador. Baixe um arquivo para guardar em outro lugar (pendrive, nuvem etc.). Uma cópia automática é criada por dia de uso.' }),
      list);
    const dlg = D.open({
      title: 'Cópias de segurança', body, wide: false,
      actions: [
        { label: 'Importar arquivo', icon: 'import', onClick: async () => { dlg.close(); await importJson(); } },
        { label: 'Baixar tudo', icon: 'export', onClick: async () => {
          saveSoon.flush(); await saveNow();
          const maps = await Store.getMaps();
          U.downloadBlob(backupFile({ created: Date.now(), label: 'Todos os mapas', maps }), 'mapas-mentais-backup-' + new Date().toISOString().slice(0, 10) + '.json');
        } },
        { label: 'Criar cópia agora', icon: 'shield', kind: 'primary', onClick: async () => { await createBackup('Manual', false); D.toast('Cópia criada'); fill(); } },
      ],
    });
    async function fill() {
      const backups = (await Store.getBackups()).sort((a, b) => b.created - a.created);
      list.textContent = '';
      if (!backups.length) list.appendChild(h('li', { class: 'muted', text: 'Nenhuma cópia ainda.' }));
      for (const b of backups) {
        list.appendChild(h('li', null,
          h('div', null,
            h('strong', { text: U.formatDate(b.created) }),
            h('span', { class: 'muted small', text: `${b.label || ''}${b.auto ? ' (automática)' : ''} · ${b.maps.length} ${b.maps.length === 1 ? 'mapa' : 'mapas'}` })),
          h('button', { class: 'btn', onclick: async () => { if (await restoreBackup(b)) dlg.close(); } }, 'Restaurar'),
          h('button', { class: 'btn icon', title: 'Baixar arquivo', 'aria-label': 'Baixar arquivo', onclick: () => U.downloadBlob(backupFile(b), 'mapas-mentais-backup-' + new Date(b.created).toISOString().slice(0, 10) + '.json') }, U.icon('export')),
          h('button', { class: 'btn icon danger', title: 'Excluir cópia', 'aria-label': 'Excluir cópia', onclick: async () => {
            if (await D.confirm('Excluir esta cópia de segurança?', { title: 'Excluir cópia?', okLabel: 'Excluir', danger: true })) { await Store.deleteBackup(b.id); fill(); }
          } }, U.icon('trash'))));
      }
    }
    fill();
  }

  async function autoBackup() {
    const last = await Store.getMeta('lastAutoBackup', 0);
    if (Date.now() - last < 20 * 3600 * 1000 || !S.maps.length) return;
    await createBackup('Automática', true);
    await Store.setMeta('lastAutoBackup', Date.now());
  }

  // =====================================================================
  // Exportação (PDF, PNG, impressão) com pré-visualização
  // =====================================================================
  // no tema claro, o papel exportado é branco puro
  const paperColor = (t) => (t.name === 'light' ? '#ffffff' : t.bg);

  function openExport() {
    if (!S.map) return;
    if (S.editing) commitEdit();
    const o = S.exportOpts;
    const preview = h('div', { class: 'export-preview' });
    const info = h('div', { class: 'export-info' });
    const controls = h('div');

    const sel = (label, key, options, parse) => {
      const s = h('select');
      for (const [v, t] of options) s.appendChild(h('option', { value: String(v), text: t }));
      s.value = String(o[key]);
      s.addEventListener('change', () => { o[key] = parse ? parse(s.value) : s.value; update(); });
      return h('label', { class: 'field' }, h('span', { text: label }), s);
    };
    const chk = (label, key) => {
      const c = h('input', { type: 'checkbox' });
      c.checked = !!o[key];
      c.addEventListener('change', () => { o[key] = c.checked; update(); });
      return h('label', { class: 'check' }, c, label);
    };

    const tabs = h('div', { class: 'tabs', role: 'tablist' });
    const tabBtn = (id, label) => {
      const b = h('button', { class: 'btn', role: 'tab', 'aria-selected': String(o.tab === id), text: label });
      b.addEventListener('click', () => { o.tab = id; for (const x of tabs.children) x.setAttribute('aria-selected', String(x === b)); update(); });
      tabs.appendChild(b);
    };
    tabBtn('pdf', 'PDF');
    tabBtn('png', 'Imagem PNG');

    const pdfControls = h('div', null,
      sel('Papel', 'paper', [['A4', 'A4'], ['A3', 'A3'], ['Letter', 'Carta'], ['Legal', 'Ofício']]),
      sel('Orientação', 'orientation', [['auto', 'Automática'], ['portrait', 'Retrato'], ['landscape', 'Paisagem']]),
      sel('Ajuste', 'mode', [['fit', 'Tudo em uma página'], ['legible', 'Várias páginas se o texto ficar pequeno']]),
      sel('Margem', 'marginMm', [[5, '5 mm'], [10, '10 mm'], [15, '15 mm'], [20, '20 mm']], Number),
      sel('Qualidade', 'dpi', [[150, 'Normal (150 dpi)'], [220, 'Alta (220 dpi)'], [300, 'Máxima (300 dpi)']], Number));
    const pngControls = h('div', null,
      sel('Resolução', 'pngScale', [[1, '1× (tamanho real)'], [2, '2× (nítida)'], [3, '3×'], [4, '4× (muito grande)']], Number),
      chk('Fundo transparente', 'transparent'));
    const common = h('div', null,
      sel('Tema', 'theme', [['light', 'Claro'], ['dark', 'Escuro']]),
      chk('Expandir ramificações recolhidas', 'expandAll'));
    controls.append(tabs, pdfControls, pngControls, common);

    const body = h('div', { class: 'export-grid' }, controls, h('div', null, preview, info));
    let plan = null;
    const dlg = D.open({
      title: 'Exportar "' + S.map.name + '"', body, wide: true,
      actions: [
        { label: 'Cancelar', value: null },
        { id: 'expPrint', label: 'Imprimir / Salvar como PDF', icon: 'print', onClick: () => {
          const t = R.THEMES[o.theme];
          dlg.close();
          E.print(S.map, t, plan, { expandAll: o.expandAll, bg: paperColor(t) });
        } },
        { id: 'expGo', label: 'Baixar', icon: 'export', kind: 'primary', onClick: () => doExport() },
      ],
    });
    const btnGo = dlg.el.querySelector('#expGo');
    const btnPrint = dlg.el.querySelector('#expPrint');

    function update() {
      pdfControls.hidden = o.tab !== 'pdf';
      pngControls.hidden = o.tab !== 'png';
      btnPrint.hidden = o.tab !== 'pdf';
      btnGo.lastChild.textContent = o.tab === 'pdf' ? 'Baixar PDF' : 'Baixar PNG';
      const t = R.THEMES[o.theme];
      const content = E.buildContent(S.map, t, o.expandAll);
      preview.textContent = '';
      info.className = 'export-info';
      if (o.tab === 'pdf') {
        plan = E.plan(S.map, o);
        const n = plan.tiles.length;
        preview.classList.toggle('single', n === 1);
        const areaW = Math.max(240, preview.clientWidth - 32 || 560), areaH = 380;
        let tw = n === 1 ? Math.min(areaW, areaH * plan.pageW / plan.pageH) : Math.min(180, areaW / Math.min(plan.cols, 3) - 12);
        tw = Math.max(90, tw);
        plan.tiles.slice(0, 24).forEach((tile, i) => {
          const page = h('div', { class: 'page-thumb' });
          page.style.width = tw + 'px';
          page.style.height = (tw * plan.pageH / plan.pageW) + 'px';
          page.style.background = paperColor(t);
          page.appendChild(E.pageSVG(content, plan, tile, paperColor(t), 'prev' + i));
          if (n > 1) page.appendChild(h('span', { class: 'pg-num', text: String(i + 1) }));
          preview.appendChild(page);
        });
        const paperName = { A4: 'A4', A3: 'A3', Letter: 'Carta', Legal: 'Ofício' }[o.paper];
        info.textContent = `${n} ${n === 1 ? 'página' : 'páginas'} · ${paperName} ${plan.orientation === 'landscape' ? 'paisagem' : 'retrato'} · menor texto ≈ ${plan.minFontPt.toFixed(1).replace('.', ',')} pt`;
        if (!plan.legible) {
          info.textContent += '. O texto ficará pequeno: escolha "Várias páginas", papel A3 ou paisagem.';
          info.classList.add('warn');
        }
        if (n > 24) info.textContent += ` (mostrando 24 de ${n})`;
      } else {
        preview.classList.add('single');
        const bbox = R.contentBBox(S.map, o.expandAll);
        const s = U.clamp(o.pngScale, 0.1, Math.min(16000 / bbox.w, 16000 / bbox.h, Math.sqrt(60e6 / (bbox.w * bbox.h))));
        const svgEl = E.fullSVG(content, bbox, o.transparent ? null : paperColor(t));
        svgEl.setAttribute('class', 'png-thumb');
        svgEl.removeAttribute('width');
        svgEl.removeAttribute('height');
        svgEl.style.width = '100%';
        svgEl.style.aspectRatio = `${bbox.w} / ${bbox.h}`;
        preview.appendChild(svgEl);
        info.textContent = `Imagem de ${Math.round(bbox.w * s)} × ${Math.round(bbox.h * s)} pixels.`;
      }
    }

    async function doExport() {
      const t = R.THEMES[o.theme];
      const label = btnGo.lastChild.textContent;
      btnGo.disabled = true;
      try {
        if (o.tab === 'pdf') {
          const blob = await E.pdf(S.map, t, plan, { dpi: o.dpi, bg: paperColor(t), expandAll: o.expandAll },
            (i, n) => { btnGo.lastChild.textContent = `Gerando ${i}/${n}…`; });
          U.downloadBlob(blob, U.safeFilename(S.map.name) + '.pdf');
        } else {
          btnGo.lastChild.textContent = 'Gerando…';
          const blob = await E.png(S.map, t, { scale: o.pngScale, transparent: o.transparent, expandAll: o.expandAll, bg: paperColor(t) });
          U.downloadBlob(blob, U.safeFilename(S.map.name) + '.png');
        }
        Store.setMeta('exportOpts', o).catch(() => {});
        dlg.close();
        D.toast('Arquivo exportado');
      } catch (e) {
        console.error(e);
        D.toast('Falha na exportação: ' + e.message + ' Tente "Imprimir / Salvar como PDF".', 'error');
        btnGo.disabled = false;
        btnGo.lastChild.textContent = label;
      }
    }

    requestAnimationFrame(update);
  }

  // =====================================================================
  // Atalhos
  // =====================================================================
  function openShortcuts() {
    const rows = [
      ['Tab / Insert', 'Novo subtópico'], ['Enter', 'Novo tópico irmão'], ['Delete / Backspace', 'Excluir tópico'],
      ['Duplo clique / F2', 'Editar texto'], ['Digitar qualquer letra', 'Substituir texto do tópico'], ['Shift + Enter (editando)', 'Nova linha'],
      ['Esc', 'Cancelar edição / tirar seleção'], ['Espaço', 'Recolher / expandir'], ['Setas', 'Selecionar tópico vizinho'],
      ['Ctrl + Z', 'Desfazer'], ['Ctrl + Y / Ctrl + Shift + Z', 'Refazer'], ['Ctrl + D', 'Duplicar ramificação'],
      ['Ctrl + L', 'Reorganizar ramificação'], ['Ctrl + 0', 'Centralizar mapa'], ['+ / −  ou roda do mouse', 'Zoom'],
      ['Shift + roda', 'Mover na horizontal'], ['Arrastar o fundo', 'Mover a tela'], ['Arrastar tópico sobre outro', 'Mudar de pai'],
      ['Ctrl + E', 'Exportar PDF / PNG'], ['Ctrl + S', 'Salvar agora (o salvamento já é automático)'], ['Ctrl + O', 'Meus mapas'],
    ];
    const table = h('table', { class: 'kbd-table' });
    for (const [k, d] of rows) table.appendChild(h('tr', null, h('td', null, h('kbd', { text: k })), h('td', { text: d })));
    D.open({ title: 'Atalhos de teclado', body: table, actions: [{ label: 'Fechar', value: null, kind: 'primary' }] });
  }

  // =====================================================================
  // Inicialização
  // =====================================================================
  async function init() {
    bindToolbar();
    buildInspector();
    await Store.init();

    const prefersDark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(await Store.getMeta('theme', prefersDark ? 'dark' : 'light'));
    const savedExport = await Store.getMeta('exportOpts', null);
    if (savedExport && typeof savedExport === 'object') Object.assign(S.exportOpts, savedExport, { minPt: 7 });
    S.exportOpts.theme = S.exportOpts.theme || 'light';
    const insp = await Store.getMeta('inspector', window.innerWidth > 1100);
    openInspector(!!insp);

    S.maps = (await Store.getMaps()).filter((m) => m && m.nodes && m.rootId && m.nodes[m.rootId]);
    if (!S.maps.length && !(await Store.getMeta('seeded', false))) {
      await addMaps(MM.demoMaps());
      await Store.setMeta('seeded', true);
    }
    if (!S.maps.length) await addMaps([M.createMap('Novo mapa', 'Tópico central')]);
    const last = await Store.getMeta('lastMap', null);
    const first = S.maps.find((m) => m.id === last) || S.maps.slice().sort((a, b) => b.updated - a.updated)[0];
    openMap(first.id);
    autoBackup().catch((e) => console.warn('Backup automático falhou', e));

    window.addEventListener('resize', () => { if (S.editing) positionEditor(); });
    window.addEventListener('beforeunload', () => saveSoon.flush());
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveSoon.flush(); });

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker não registrado', e));
    }
  }

  // API para testes automatizados e depuração
  MM.app = { S, addChild, addSibling, deleteSelected, undo, redo, select, startEdit, commitEdit, toggleCollapse, layoutSelected, fitView, openMap, createBackup, restoreBackup, openExport, setTheme, renderNow };

  init().catch((e) => {
    console.error(e);
    D.toast('Erro ao iniciar: ' + e.message, 'error');
  });
})(window.MM);
