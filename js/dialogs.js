'use strict';
(function (MM) {
  const { U } = MM;
  const h = U.h;
  const D = {};
  const stack = [];

  D.isOpen = () => stack.length > 0;

  /**
   * Abre um diálogo modal. actions: [{label, value, kind, icon}]
   * Retorna { el, body, close(value), result: Promise }.
   */
  D.open = function (o) {
    const root = document.getElementById('modalRoot');
    const prevFocus = document.activeElement;
    let resolve;
    const result = new Promise((r) => { resolve = r; });
    const body = h('div', { class: 'modal-body' });
    if (typeof o.body === 'string') body.appendChild(h('p', { text: o.body }));
    else if (o.body) body.appendChild(o.body);

    const foot = h('div', { class: 'modal-foot' });
    const titleId = 'dlg-' + U.uid();
    const modal = h('div', { class: 'modal' + (o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('div', { class: 'modal-head' },
        h('h2', { id: titleId, text: o.title || '' }),
        h('button', { class: 'btn icon', 'aria-label': 'Fechar', onclick: () => close(null) }, U.icon('close'))),
      body, foot);
    const back = h('div', { class: 'modal-back' }, modal);
    back.addEventListener('pointerdown', (e) => { if (e.target === back) back._downOnBack = true; });
    back.addEventListener('click', (e) => { if (e.target === back && back._downOnBack) close(null); back._downOnBack = false; });

    const handle = { el: modal, body, foot, result, close };
    for (const a of o.actions || []) {
      const b = h('button', { class: 'btn ' + (a.kind || ''), type: 'button' }, a.icon ? U.icon(a.icon) : null, a.label);
      b.addEventListener('click', () => {
        if (a.onClick) { a.onClick(handle); return; }
        close(typeof a.value === 'function' ? a.value() : a.value);
      });
      if (a.id) b.id = a.id;
      foot.appendChild(b);
    }
    if (!foot.children.length) foot.remove();

    function onKey(e) {
      if (stack[stack.length - 1] !== handle) return;
      if (e.key === 'Escape') { e.preventDefault(); close(null); }
      if (e.key === 'Tab') {
        const f = [...modal.querySelectorAll('button, input, select, textarea, [tabindex]')].filter((x) => !x.disabled && x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);

    let closed = false;
    function close(value) {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey, true);
      back.remove();
      stack.splice(stack.indexOf(handle), 1);
      if (o.onClose) o.onClose(value);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      resolve(value);
    }

    root.appendChild(back);
    stack.push(handle);
    const first = modal.querySelector('[autofocus]') || modal.querySelector('input, textarea, select') || foot.querySelector('.primary, .solid') || modal.querySelector('button');
    if (first) setTimeout(() => first.focus(), 0);
    return handle;
  };

  D.confirm = function (message, o) {
    o = o || {};
    return D.open({
      title: o.title || 'Confirmar',
      body: message,
      actions: [
        { label: o.cancelLabel || 'Cancelar', value: false },
        { label: o.okLabel || 'OK', value: true, kind: o.danger ? 'danger solid' : 'primary' },
      ],
    }).result.then((v) => v === true);
  };

  D.prompt = function (title, value, o) {
    o = o || {};
    const input = h('input', { type: 'text', maxlength: o.maxlength || 120, 'aria-label': o.label || title });
    input.value = value || '';
    const wrap = h('label', { class: 'field' }, h('span', { text: o.label || 'Nome' }), input);
    const dlg = D.open({
      title, body: wrap,
      actions: [
        { label: 'Cancelar', value: null },
        { label: o.okLabel || 'Salvar', kind: 'primary', value: () => input.value.trim() },
      ],
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dlg.close(input.value.trim()); } });
    setTimeout(() => input.select(), 10);
    return dlg.result.then((v) => (v == null ? null : v || o.allowEmpty ? v : null));
  };

  D.toast = function (msg, kind) {
    const el = h('div', { class: 'toast' + (kind ? ' ' + kind : ''), role: kind === 'error' ? 'alert' : 'status', text: msg });
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => el.remove(), kind === 'error' ? 5000 : 2600);
  };

  MM.D = D;
})(window.MM);
