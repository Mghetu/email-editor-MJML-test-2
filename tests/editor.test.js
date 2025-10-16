import test from 'node:test';
import assert from 'node:assert/strict';

import { slugify, buildModuleDefinition } from '../js/editor.js';
import { saveBlock } from '../js/modulePersistence.js';

const MJML_MODULES_FALLBACK_KEY = 'mjmlModulesFallback';

function createMockWindow() {
  const storage = new Map();

  return {
    prompt: () => null,
    confirm: () => true,
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: (...args) => clearTimeout(...args),
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
      clear() {
        storage.clear();
      }
    },
    dispatchEvent: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

test('slugify lowercases text and replaces non-alphanumerics with hyphens', () => {
  assert.equal(slugify('Hello, MJML Builder!'), 'hello-mjml-builder');
  assert.equal(slugify('   Multi   space   value   '), 'multi-space-value');
});

test('slugify trims hyphens, enforces max length, and defaults to custom-block', () => {
  const longInput = 'Super Fancy Hero Banner With Extra Details And Styling Options';
  const slug = slugify(longInput);

  assert.equal(slug.startsWith('super-fancy-hero-banner'), true);
  assert.equal(slug.length, 60);
  assert.equal(slug.endsWith('-'), false);

  assert.equal(slugify(undefined), 'custom-block');
  assert.equal(slugify(null), 'custom-block');
});

test('buildModuleDefinition prompts for overwrite and saving updates module history', async () => {
  const mockWin = createMockWindow();
  const promptCalls = [];
  const confirmCalls = [];
  const promptResponses = [
    'Hero Banner',
    'custom-hero-banner',
    '',
    ''
  ];

  mockWin.prompt = (message, defaultValue) => {
    promptCalls.push({ message, defaultValue });
    return promptResponses.length ? promptResponses.shift() : '';
  };

  mockWin.confirm = (message) => {
    confirmCalls.push(message);
    return true;
  };

  class MockCustomEvent {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  mockWin.CustomEvent = MockCustomEvent;

  global.window = mockWin;
  global.CustomEvent = MockCustomEvent;

  const existingModule = {
    id: 'custom-hero-banner',
    label: 'Hero Banner',
    category: 'Custom Modules',
    markup: '<mj-section>Old Content</mj-section>',
    metadata: {
      savedAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
      source: 'user',
      savedFrom: 'editor'
    },
    version: 2,
    updatedAt: '2024-01-02T00:00:00.000Z',
    history: []
  };

  mockWin.localStorage.setItem(
    MJML_MODULES_FALLBACK_KEY,
    JSON.stringify([existingModule])
  );

  const selectedComponent = {
    get(prop) {
      if (prop === 'custom-name') {
        return 'Hero Banner';
      }
      return undefined;
    },
    getName() {
      return 'mj-hero';
    }
  };

  const editor = {
    getSelected() {
      return selectedComponent;
    }
  };

  try {
    const { moduleDefinition, isUpdate } = await buildModuleDefinition(
      editor,
      '   <mj-section>New Content</mj-section>   ',
      {
        loadBlocks: async () => [existingModule]
      }
    );

    assert.equal(isUpdate, true);
    assert.equal(moduleDefinition.id, 'custom-hero-banner');
    assert.equal(moduleDefinition.label, 'Hero Banner');
    assert.equal(moduleDefinition.markup, '<mj-section>New Content</mj-section>');
    assert.equal(moduleDefinition.metadata.savedFrom, 'editor');
    assert.equal(confirmCalls.length, 1);
    assert.match(confirmCalls[0], /custom-hero-banner/);
    assert.equal(promptCalls[1].defaultValue, 'custom-hero-banner');

    const persistedModules = await saveBlock(moduleDefinition);
    assert.equal(persistedModules.length, 1);
    const [persisted] = persistedModules;

    assert.equal(persisted.version, 3);
    assert.equal(Array.isArray(persisted.history), true);
    assert.equal(persisted.history.length, 1);
    assert.equal(persisted.history[0].version, 2);
    assert.equal(persisted.history[0].markup, '<mj-section>Old Content</mj-section>');
  } finally {
    delete global.window;
    delete global.CustomEvent;
  }
});
