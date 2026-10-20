'use strict';
(function (MM) {
  const { U, M, L, R } = MM;
  const E = {};

  E.PAPERS = { A4: [210, 297], A3: [297, 420], Letter: [215.9, 279.4], Legal: [215.9, 355.6] };
  const PT_PER_MM = 72 / 25.4;
  const MAX_SCALE = 1.25;

  /** Conteúdo SVG (um <g>) do mapa inteiro, pronto para ser clonado em páginas. */
  E.buildContent = function (map, theme, expandAll) {
    const g = U.s('g');
    R.draw(g, map, theme, { interactive: false, expandAll });
    return g;
  };

  /**
   * Planeja as páginas do PDF/impressão.
   * mode 'fit': tudo em uma página. mode 'legible': divide em páginas se o
   * texto ficar menor que minPt.
   */
  E.plan = function (map, o) {
    const bbox = R.contentBBox(map, o.expandAll);
    const minFont = R.minFontSize(map, o.expandAll);
    let [pw, ph] = E.PAPERS[o.paper] || E.PAPERS.A4;
    let orient = o.orientation;
    if (orient === 'auto') orient = bbox.w >= bbox.h ? 'landscape' : 'portrait';
    if (orient === 'landscape') [pw, ph] = [ph, pw];
    const pageW = pw * PT_PER_MM, pageH = ph * PT_PER_MM;
    const marginPt = o.marginMm * PT_PER_MM;
    const cw = pageW - marginPt * 2, ch = pageH - marginPt * 2;

    let scale = Math.min(cw / bbox.w, ch / bbox.h, MAX_SCALE);
    let cols = 1, rows = 1;
    const tiles = [];
    const legible = minFont * scale >= o.minPt;

    if (o.mode === 'legible' && !legible) {
      scale = o.minPt / minFont;
      const tw = cw / scale, th = ch / scale;
      // sobreposição suficiente para que todo tópico apareça inteiro em ao menos uma página
      let maxW = 0, maxH = 0;
      for (const id of M.visibleIds(map, o.expandAll)) {
        const b = L.box(map, id);
        maxW = Math.max(maxW, b.w); maxH = Math.max(maxH, b.h);
      }
      const ox = Math.min(maxW + 30, tw * 0.5), oy = Math.min(maxH + 30, th * 0.5);
      cols = bbox.w <= tw ? 1 : Math.ceil((bbox.w - tw) / (tw - ox)) + 1;
      rows = bbox.h <= th ? 1 : Math.ceil((bbox.h - th) / (th - oy)) + 1;
      const gridW = tw + (cols - 1) * (tw - ox), gridH = th + (rows - 1) * (th - oy);
      const x0 = bbox.x + bbox.w / 2 - gridW / 2, y0 = bbox.y + bbox.h / 2 - gridH / 2;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        tiles.push({ x: x0 + c * (tw - ox), y: y0 + r * (th - oy), w: tw, h: th });
      }
    } else {
      const tw = cw / scale, th = ch / scale;
      tiles.push({ x: bbox.x + bbox.w / 2 - tw / 2, y: bbox.y + bbox.h / 2 - th / 2, w: tw, h: th });
    }
    return { pageW, pageH, pageWmm: pw, pageHmm: ph, marginPt, scale, tiles, cols, rows, bbox, orientation: orient, minFontPt: minFont * scale, legible: minFont * scale >= o.minPt };
  };

  /** SVG de uma página (coordenadas do mapa, com margens e recorte). */
  E.pageSVG = function (content, plan, tile, bg, idx) {
    const m = plan.marginPt / plan.scale;
    const vb = [tile.x - m, tile.y - m, tile.w + 2 * m, tile.h + 2 * m];
    const svg = U.s('svg', { xmlns: U.SVGNS, viewBox: vb.map((v) => v.toFixed(2)).join(' '), preserveAspectRatio: 'xMidYMid meet' });
    if (bg) svg.appendChild(U.s('rect', { x: vb[0], y: vb[1], width: vb[2], height: vb[3], fill: bg }));
    const clipId = 'pg' + (idx || 0);
    const defs = U.s('defs');
    const cp = U.s('clipPath', { id: clipId });
    cp.appendChild(U.s('rect', { x: tile.x, y: tile.y, width: tile.w, height: tile.h }));
    defs.appendChild(cp);
    svg.appendChild(defs);
    const g = U.s('g', { 'clip-path': `url(#${clipId})` });
    g.appendChild(content.cloneNode(true));
    svg.appendChild(g);
    return svg;
  };

  E.fullSVG = function (content, bbox, bg) {
    const svg = U.s('svg', { xmlns: U.SVGNS, viewBox: `${bbox.x} ${bbox.y} ${bbox.w} ${bbox.h}`, width: Math.ceil(bbox.w), height: Math.ceil(bbox.h) });
    if (bg) svg.appendChild(U.s('rect', { x: bbox.x, y: bbox.y, width: bbox.w, height: bbox.h, fill: bg }));
    svg.appendChild(content.cloneNode(true));
    return svg;
  };

  E.rasterize = function (svg, w, h, bg) {
    svg = svg.cloneNode(true);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    const str = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao desenhar a imagem.')); };
      img.src = url;
    });
  };

  // ---------- PNG ----------
  E.png = async function (map, theme, o) {
    const content = E.buildContent(map, theme, o.expandAll);
    const bbox = R.contentBBox(map, o.expandAll);
    let s = o.scale;
    // limites de canvas dos navegadores
    s = Math.min(s, 16000 / bbox.w, 16000 / bbox.h, Math.sqrt(60e6 / (bbox.w * bbox.h)));
    const w = Math.max(1, Math.round(bbox.w * s)), h = Math.max(1, Math.round(bbox.h * s));
    const bg = o.transparent ? null : (o.bg || theme.bg);
    const canvas = await E.rasterize(E.fullSVG(content, bbox, bg), w, h, bg);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  };

  E.svgFile = function (map, theme, o) {
    const content = E.buildContent(map, theme, o.expandAll);
    const bbox = R.contentBBox(map, o.expandAll);
    const svg = E.fullSVG(content, bbox, theme.bg);
    return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  };

  // ---------- PDF (gerador próprio, sem bibliotecas) ----------
  async function deflate(bytes) {
    const cs = new CompressionStream('deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function canvasToPdfImage(canvas) {
    const w = canvas.width, h = canvas.height;
    if (typeof CompressionStream === 'function') {
      const data = canvas.getContext('2d').getImageData(0, 0, w, h).data;
      const rgb = new Uint8Array(w * h * 3);
      for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
        rgb[j] = data[i]; rgb[j + 1] = data[i + 1]; rgb[j + 2] = data[i + 2];
      }
      return { w, h, filter: 'FlateDecode', data: await deflate(rgb) };
    }
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.93));
    return { w, h, filter: 'DCTDecode', data: new Uint8Array(await blob.arrayBuffer()) };
  }

  function pdfText(s) {
    let hex = 'FEFF';
    for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
    return '<' + hex + '>';
  }

  E.buildPDF = function (pages, title) {
    const enc = new TextEncoder();
    const chunks = [];
    let offset = 0;
    const offsets = [];
    const add = (d) => { const b = typeof d === 'string' ? enc.encode(d) : d; chunks.push(b); offset += b.length; };
    const obj = (n, dict, stream) => {
      offsets[n] = offset;
      add(`${n} 0 obj\n${dict}\n`);
      if (stream) { add('stream\n'); add(stream); add('\nendstream\n'); }
      add('endobj\n');
    };
    add(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // %PDF-1.4
    const kids = pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
    const d = new Date();
    const pad = (v) => String(v).padStart(2, '0');
    const date = `D:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    obj(3, `<< /Title ${pdfText(title)} /Producer (Mapas Mentais) /CreationDate (${date}) >>`);
    pages.forEach((p, i) => {
      const n = 4 + i * 3;
      const W = p.wPt.toFixed(2), H = p.hPt.toFixed(2);
      obj(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
      const content = enc.encode(`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`);
      obj(n + 1, `<< /Length ${content.length} >>`, content);
      const im = p.img;
      obj(n + 2, `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${im.filter} /Length ${im.data.length} >>`, im.data);
    });
    const total = 4 + pages.length * 3;
    const xref = offset;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    add(x);
    add(`trailer\n<< /Size ${total} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  };

  E.pdf = async function (map, theme, plan, o, onProgress) {
    const content = E.buildContent(map, theme, o.expandAll);
    const pxW = Math.round(plan.pageW / 72 * o.dpi), pxH = Math.round(plan.pageH / 72 * o.dpi);
    const pages = [];
    for (let i = 0; i < plan.tiles.length; i++) {
      if (onProgress) onProgress(i + 1, plan.tiles.length);
      const svg = E.pageSVG(content, plan, plan.tiles[i], o.bg, i);
      const canvas = await E.rasterize(svg, pxW, pxH, o.bg || '#ffffff');
      pages.push({ wPt: plan.pageW, hPt: plan.pageH, img: await canvasToPdfImage(canvas) });
      canvas.width = canvas.height = 0;
    }
    return E.buildPDF(pages, map.name || 'Mapa mental');
  };

  // ---------- impressão vetorial (Salvar como PDF do navegador) ----------
  E.print = function (map, theme, plan, o) {
    const area = document.getElementById('printArea');
    area.textContent = '';
    const content = E.buildContent(map, theme, o.expandAll);
    plan.tiles.forEach((t, i) => {
      const page = U.h('div', { class: 'print-page' });
      page.style.width = plan.pageWmm + 'mm';
      page.style.height = (plan.pageHmm - 0.6) + 'mm';
      const svg = E.pageSVG(content, plan, t, o.bg, 'p' + i);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      page.appendChild(svg);
      area.appendChild(page);
    });
    let style = document.getElementById('printPageStyle');
    if (!style) { style = U.h('style', { id: 'printPageStyle' }); document.head.appendChild(style); }
    style.textContent = `@page { size: ${plan.pageWmm}mm ${plan.pageHmm}mm; margin: 0; }`;
    const cleanup = () => { area.textContent = ''; window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 60);
  };

  E.json = (map) => new Blob([JSON.stringify(M.exportObject(map), null, 2)], { type: 'application/json' });

  MM.E = E;
})(window.MM);
