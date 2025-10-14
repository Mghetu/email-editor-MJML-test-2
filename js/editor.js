import addCustomBlocks from './custom-blocks.js';
import { loadBlocks, saveBlock } from './modulePersistence.js';
import { showToast } from './toast.js';
import { initModuleManagerUI } from './moduleManagerUI.js';

const STORAGE_TOAST_ID = 'storage-status-toast';
const STORE_TOAST_INTERVAL = 15000;
let lastStoreToastAt = 0;

const SAVE_BLOCK_BUTTON_ID = 'save-custom-block-btn';
const DEFAULT_BLOCK_CATEGORY = 'Custom Modules';

const slugify = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60) || 'custom-block';

const getSelectedMarkup = (editor) => {
  const selected = editor.getSelected();
  if (!selected) {
    return null;
  }

  if (typeof selected.toHTML === 'function') {
    return selected.toHTML();
  }

  if (typeof selected.toString === 'function') {
    return selected.toString();
  }

  return null;
};

async function initialiseCustomBlocks(editor) {
  try {
    addCustomBlocks(editor);
  } catch (error) {
    console.error('[CustomBlocks] Failed to register default modules', error);
  }

  try {
    const savedModules = await loadBlocks();
    if (Array.isArray(savedModules) && savedModules.length) {
      addCustomBlocks(editor, savedModules);
    }
  } catch (error) {
    console.error('[CustomBlocks] Failed to restore saved modules', error);
  }
}

function setupSaveBlockButton(editor) {
  const saveButton = document.getElementById(SAVE_BLOCK_BUTTON_ID);
  if (!saveButton) {
    return;
  }

  saveButton.addEventListener('click', async () => {
    const selected = editor.getSelected();

    if (!selected) {
      showToast({
        id: 'save-block-feedback',
        message: 'Select a component in the canvas to save it as a block.',
        variant: 'error',
        duration: 3500,
      });
      return;
    }

    const markup = getSelectedMarkup(editor);

    if (!markup) {
      showToast({
        id: 'save-block-feedback',
        message: 'Unable to serialise the selected component. Try another element.',
        variant: 'error',
        duration: 4000,
      });
      return;
    }

    const suggestedLabel =
      selected.get('custom-name') ||
      (typeof selected.getName === 'function' && selected.getName()) ||
      'Custom Block';

    const label = window.prompt('Enter a label for this block', suggestedLabel);
    if (!label) {
      return;
    }

    const suggestedId = `custom-${slugify(label)}`;
    const id = window.prompt('Enter a unique identifier for this block', suggestedId);
    if (!id) {
      return;
    }

    const category = window.prompt(
      'Enter a category for this block (optional)',
      DEFAULT_BLOCK_CATEGORY
    );

    const thumbnail = window.prompt(
      'Enter a thumbnail URL for this block (optional)',
      ''
    );

    const moduleDefinition = {
      id: id.trim(),
      label: label.trim(),
      category: category ? category.trim() : DEFAULT_BLOCK_CATEGORY,
      markup: markup.trim(),
      metadata: {
        savedFrom: 'editor',
      },
    };

    if (thumbnail && thumbnail.trim()) {
      moduleDefinition.thumbnail = thumbnail.trim();
    }

    saveButton.disabled = true;

    try {
      const persistedModules = await saveBlock(moduleDefinition);
      const savedModule = Array.isArray(persistedModules)
        ? persistedModules.find((module) => module.id === moduleDefinition.id)
        : null;
      addCustomBlocks(editor, [savedModule || moduleDefinition]);
      editor.BlockManager.render();
      showToast({
        id: 'save-block-feedback',
        message: 'Block saved to your library.',
        variant: 'success',
        duration: 2500,
      });
    } catch (error) {
      console.error('[CustomBlocks] Failed to save module', error);
      showToast({
        id: 'save-block-feedback',
        message: 'Unable to save block. Check the console for details.',
        variant: 'error',
        duration: 4500,
      });
    } finally {
      saveButton.disabled = false;
    }
  });
}

function configureStorageEvents(editor) {
  const logEvent = (eventName) => (...payload) => {
    console.info(`[StorageManager] ${eventName}`, ...payload);
  };

  editor.on('storage:start', logEvent('storage:start'));
  editor.on('storage:end', logEvent('storage:end'));

  editor.on('storage:store', (data) => {
    console.info('[StorageManager] storage:store', data);
    const now = Date.now();
    if (now - lastStoreToastAt >= STORE_TOAST_INTERVAL) {
      showToast({
        id: STORAGE_TOAST_ID,
        message: 'Project autosaved to IndexedDB.',
        variant: 'success',
        duration: 2500,
      });
      lastStoreToastAt = now;
    }
  });

  editor.on('storage:load', (data) => {
    console.info('[StorageManager] storage:load', data);
    showToast({
      id: STORAGE_TOAST_ID,
      message: 'Project loaded from IndexedDB.',
      variant: 'success',
      duration: 3000,
    });
  });

  editor.on('storage:error', (error) => {
    console.error('[StorageManager] storage:error', error);
    showToast({
      id: STORAGE_TOAST_ID,
      message: 'Storage error. Check console for details.',
      variant: 'error',
      duration: 6000,
      role: 'alert',
    });
  });
}

export function initEditor() {
  window.editor = grapesjs.init({
    height: '100%',
    noticeOnUnload: false,
    storageManager: {
      type: 'indexeddb',
      id: 'mjml-project',
      autosave: true,
      autoload: true,
      stepsBeforeSave: 1,
      options: {
        indexeddb: {
          dbName: 'mjmlBuilder',
          objectStoreName: 'projects',
        },
      },
    },
    fromElement: true,
    container: '#gjs',
    blockManager: {
      appendTo: '#custom-blocks-container',
    },
    layerManager: {
      appendTo: '#custom-layers-container',
    },
    plugins: ['grapesjs-mjml'],
    pluginsOpts: {
      'grapesjs-mjml': {}
    }
  });

  configureStorageEvents(window.editor);
  initialiseCustomBlocks(window.editor);
  setupSaveBlockButton(window.editor);
  initModuleManagerUI(window.editor);

  window.editor.on('load', function () {
    window.editor.BlockManager.render();
    window.editor.LayerManager.render();

    // Close the default GrapesJS block panel opened by the `open-blocks` command
    // so only the custom blocks sidebar remains visible. Explicitly deactivate the
    // panel button as stopping the command alone leaves the view docked open.
    var panels = window.editor.Panels;
    var openBlocksBtn = panels && panels.getButton('views', 'open-blocks');
    if (openBlocksBtn) {
      openBlocksBtn.set('active', false);
    }

    window.editor.Commands.stop('open-blocks');
  });
}

export default initEditor;
