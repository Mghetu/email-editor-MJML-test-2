import test from 'node:test';
import assert from 'node:assert/strict';

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

class TestWindow extends EventTarget {
  constructor() {
    super();
    this.localStorage = new LocalStorageMock();
    this.indexedDB = undefined;
    this.idbKeyval = undefined;
  }
}

function setupBrowserEnv() {
  const testWindow = new TestWindow();
  globalThis.window = testWindow;
  return () => {
    delete globalThis.window;
  };
}

const teardown = setupBrowserEnv();
const modulePersistence = await import('../js/modulePersistence.js');
const { saveBlock, loadBlocks } = modulePersistence;

function resetEnvironment() {
  window.localStorage.clear();
}

test.beforeEach(() => {
  resetEnvironment();
});

test.after(() => {
  teardown();
});

test('saveBlock rejects identifiers that are empty after trimming', async () => {
  await assert.rejects(
    saveBlock({
      id: '   ',
      label: 'Example Block',
      markup: '   <mjml><mj-body></mj-body></mjml>   '
    }),
    /Module definitions require id, label, and markup\./
  );
});

test('saveBlock trims values and applies default category before persisting', async () => {
  const persisted = await saveBlock({
    id: '  example-block  ',
    label: '  Example Block  ',
    markup: '  <mjml><mj-body></mj-body></mjml>  ',
    category: '   ',
    thumbnail: '   '
  });

  assert.equal(persisted.length, 1);
  const stored = persisted[0];
  assert.equal(stored.id, 'example-block');
  assert.equal(stored.label, 'Example Block');
  assert.equal(stored.category, 'Custom Modules');
  assert.equal(stored.markup, '<mjml><mj-body></mj-body></mjml>');
  assert.ok(!('thumbnail' in stored));

  const loaded = await loadBlocks();
  assert.equal(loaded.length, 1);
  const moduleRecord = loaded[0];
  assert.equal(moduleRecord.id, 'example-block');
  assert.equal(moduleRecord.label, 'Example Block');
  assert.equal(moduleRecord.category, 'Custom Modules');
  assert.equal(moduleRecord.markup, '<mjml><mj-body></mj-body></mjml>');
  assert.equal(moduleRecord.metadata.source, 'user');
});
