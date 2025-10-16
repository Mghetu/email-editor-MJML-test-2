import { test } from 'node:test';
import assert from 'node:assert/strict';

class SimpleCustomEvent extends Event {
  constructor(type, eventInit = {}) {
    super(type, eventInit);
    this.detail = eventInit?.detail;
  }
}

globalThis.CustomEvent = SimpleCustomEvent;

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function createIndexedDbMock() {
  const dataStore = new Map();
  const objectStores = new Set();

  const db = {
    objectStoreNames: {
      contains(name) {
        return objectStores.has(name);
      }
    },
    createObjectStore(name) {
      objectStores.add(name);
      return {};
    },
    transaction(storeName, mode) {
      if (!objectStores.has(storeName)) {
        throw new Error(`Object store ${storeName} does not exist.`);
      }

      const transaction = {
        error: null,
        oncomplete: null,
        onerror: null,
        objectStore() {
          return {
            put(value, key) {
              dataStore.set(key, value);
              const request = {
                result: undefined,
                error: null,
                onsuccess: null,
                onerror: null
              };
              queueMicrotask(() => {
                request.result = value;
                if (typeof request.onsuccess === 'function') {
                  request.onsuccess({ target: { result: value } });
                }
                if (typeof transaction.oncomplete === 'function') {
                  transaction.oncomplete({ target: { result: value } });
                }
              });
              return request;
            },
            get(key) {
              const request = {
                result: undefined,
                error: null,
                onsuccess: null,
                onerror: null
              };
              queueMicrotask(() => {
                request.result = dataStore.get(key);
                if (typeof request.onsuccess === 'function') {
                  request.onsuccess({ target: { result: request.result } });
                }
              });
              return request;
            }
          };
        }
      };

      return transaction;
    }
  };

  const indexedDB = {
    open() {
      const request = {
        result: db,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
      };

      queueMicrotask(() => {
        if (!objectStores.has('modules')) {
          if (typeof request.onupgradeneeded === 'function') {
            request.onupgradeneeded({ target: { result: db } });
          }
        }
        if (typeof request.onsuccess === 'function') {
          request.onsuccess({ target: { result: db } });
        }
      });

      return request;
    }
  };

  return { indexedDB };
}

function createWindowMock({ enableIndexedDb = true } = {}) {
  const eventTarget = new EventTarget();
  const localStorage = createLocalStorageMock();
  const windowMock = {
    localStorage,
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
    CustomEvent: SimpleCustomEvent
  };

  if (enableIndexedDb) {
    windowMock.indexedDB = createIndexedDbMock().indexedDB;
  }

  return windowMock;
}

function setWindow(options) {
  const newWindow = createWindowMock(options);
  globalThis.window = newWindow;
  return newWindow;
}

setWindow();

const modulePersistenceModule = await import('../js/modulePersistence.js');
const { saveBlock, updateBlock, deleteBlock, MODULES_CHANGED_EVENT } = modulePersistenceModule;

const DEFAULT_MODULE = {
  id: 'module-1',
  label: 'Sample Module',
  markup: '<mjml></mjml>'
};

test.beforeEach(() => {
  setWindow();
});

test.afterEach(() => {
  delete globalThis.window;
});

const FALLBACK_STORAGE_KEY = 'mjmlModulesFallback';

test('saveBlock stores new modules with version 1 and empty history', async () => {
  const modules = await saveBlock({ ...DEFAULT_MODULE });

  assert.strictEqual(modules.length, 1, 'one module should be stored');
  const [storedModule] = modules;
  assert.strictEqual(storedModule.version, 1);
  assert.deepStrictEqual(storedModule.history, []);
  assert.ok(storedModule.updatedAt, 'updatedAt timestamp should be set');
  assert.ok(storedModule.metadata.savedAt, 'savedAt should be populated');
});

test('updateBlock increments version and prepends prior snapshots to history', async () => {
  await saveBlock({ ...DEFAULT_MODULE });

  const firstUpdate = await updateBlock({
    id: DEFAULT_MODULE.id,
    label: 'Updated Module',
    markup: '<mjml>updated</mjml>'
  });

  const afterFirstUpdate = firstUpdate.find((module) => module.id === DEFAULT_MODULE.id);
  assert.ok(afterFirstUpdate, 'module should exist after first update');
  assert.strictEqual(afterFirstUpdate.version, 2);
  assert.strictEqual(afterFirstUpdate.history.length, 1);
  assert.strictEqual(afterFirstUpdate.history[0].version, 1);
  assert.strictEqual(afterFirstUpdate.history[0].markup, DEFAULT_MODULE.markup);

  const secondUpdate = await updateBlock({
    id: DEFAULT_MODULE.id,
    label: 'Updated Module Again',
    markup: '<mjml>twice</mjml>'
  });

  const afterSecondUpdate = secondUpdate.find((module) => module.id === DEFAULT_MODULE.id);
  assert.ok(afterSecondUpdate, 'module should exist after second update');
  assert.strictEqual(afterSecondUpdate.version, 3);
  assert.strictEqual(afterSecondUpdate.history.length, 2);
  assert.strictEqual(afterSecondUpdate.history[0].version, 2);
  assert.strictEqual(afterSecondUpdate.history[1].version, 1);
});

test('saveBlock rejects invalid module definitions', async () => {
  await assert.rejects(
    saveBlock({ label: 'Missing id', markup: '<mjml />' }),
    /Module definitions require id, label, and markup./
  );

  await assert.rejects(
    saveBlock({ id: 'missing-label', markup: '<mjml />' }),
    /Module definitions require id, label, and markup./
  );

  await assert.rejects(
    saveBlock({ id: 'missing-markup', label: 'Missing markup' }),
    /Module definitions require id, label, and markup./
  );
});

test('persistModules falls back to localStorage and broadcasts changes when IndexedDB is unavailable', async () => {
  const win = setWindow({ enableIndexedDb: false });
  let broadcastedModules = null;
  win.addEventListener(MODULES_CHANGED_EVENT, (event) => {
    broadcastedModules = event.detail.modules;
  });

  const modules = await saveBlock({ ...DEFAULT_MODULE });

  assert.strictEqual(
    typeof win.localStorage.getItem(FALLBACK_STORAGE_KEY),
    'string',
    'modules should be saved to localStorage'
  );
  const stored = JSON.parse(win.localStorage.getItem(FALLBACK_STORAGE_KEY));
  assert.strictEqual(stored.length, 1);
  assert.strictEqual(stored[0].id, DEFAULT_MODULE.id);

  assert.ok(broadcastedModules, 'modules:changed event should be dispatched');
  assert.strictEqual(broadcastedModules[0].id, DEFAULT_MODULE.id);
  assert.strictEqual(modules[0].id, DEFAULT_MODULE.id);
});

test('deleteBlock throws when the module id does not exist', async () => {
  await assert.rejects(
    deleteBlock('non-existent'),
    /Module not found./
  );
});
