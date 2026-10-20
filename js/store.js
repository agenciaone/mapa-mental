'use strict';
(function (MM) {
  /**
   * Armazenamento local. Usa IndexedDB; se indisponível (ex.: modo privado
   * restrito), recorre ao localStorage com a mesma interface.
   */
  const DB_NAME = 'mapas-mentais';
  const DB_VERSION = 1;
  const STORES = { maps: 'id', backups: 'id', meta: 'key' };

  const req = (r) => new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

  function idbBackend(db) {
    const tx = (store, mode, fn) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      let result;
      Promise.resolve(fn(t.objectStore(store))).then((r) => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transação abortada'));
    });
    return {
      kind: 'IndexedDB',
      all: (store) => tx(store, 'readonly', (s) => req(s.getAll())),
      get: (store, key) => tx(store, 'readonly', (s) => req(s.get(key))),
      put: (store, value) => tx(store, 'readwrite', (s) => { s.put(value); }),
      del: (store, key) => tx(store, 'readwrite', (s) => { s.delete(key); }),
      clear: (store) => tx(store, 'readwrite', (s) => { s.clear(); }),
    };
  }

  function lsBackend() {
    const k = (store) => 'mapas-mentais:' + store;
    const read = (store) => { try { return JSON.parse(localStorage.getItem(k(store)) || '{}'); } catch (e) { return {}; } };
    const write = (store, obj) => localStorage.setItem(k(store), JSON.stringify(obj));
    return {
      kind: 'localStorage',
      all: async (store) => Object.values(read(store)),
      get: async (store, key) => read(store)[key],
      put: async (store, value) => { const o = read(store); o[value[STORES[store]]] = value; write(store, o); },
      del: async (store, key) => { const o = read(store); delete o[key]; write(store, o); },
      clear: async (store) => write(store, {}),
    };
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB indisponível'));
      // alguns navegadores nunca respondem ao abrir via file://
      if (location.protocol === 'file:') setTimeout(() => reject(new Error('IndexedDB não respondeu')), 2500);
      let r;
      try { r = indexedDB.open(DB_NAME, DB_VERSION); } catch (e) { return reject(e); }
      r.onupgradeneeded = () => {
        const db = r.result;
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath });
        }
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('Banco bloqueado'));
    });
  }

  let be = null;
  const Store = {
    async init() {
      try {
        be = idbBackend(await openDB());
      } catch (e) {
        console.warn('Usando localStorage:', e);
        be = lsBackend();
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      return be.kind;
    },
    get kind() { return be && be.kind; },
    getMaps: () => be.all('maps'),
    getMap: (id) => be.get('maps', id),
    putMap: (m) => be.put('maps', m),
    deleteMap: (id) => be.del('maps', id),
    clearMaps: () => be.clear('maps'),
    getBackups: () => be.all('backups'),
    putBackup: (b) => be.put('backups', b),
    deleteBackup: (id) => be.del('backups', id),
    async getMeta(key, def) { const r = await be.get('meta', key); return r ? r.value : def; },
    setMeta: (key, value) => be.put('meta', { key, value }),
  };

  MM.Store = Store;
})(window.MM);
