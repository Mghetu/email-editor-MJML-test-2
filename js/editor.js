import addCustomBlocks from './custom-blocks.js';
import { loadBlocks, saveBlock } from './modulePersistence.js';
import { showToast } from './toast.js';
import { initModuleManagerUI } from './moduleManagerUI.js';
import {
  ensureModuleLibraryReady,
  initMarketingTemplatesUI,
  showModuleLibraryPanel,
  hideModuleLibraryPanel
} from './moduleLibraryPanel.js';

const STORAGE_TOAST_ID = 'storage-status-toast';
const STORE_TOAST_INTERVAL = 15000;
let lastStoreToastAt = 0;

const SAVE_BLOCK_BUTTON_ID = 'save-custom-block-btn';
const DEFAULT_BLOCK_CATEGORY = 'Custom Modules';
const MODULE_LIBRARY_COMMAND_ID = 'open-module-library';

const slugify = (value = '') =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60) || 'custom-block';

const showSaveBlockToast = (message, { variant = 'info', duration = 3500 } = {}) =>
  showToast({
    id: 'save-block-feedback',
    message,
    variant,
    duration,
    role: variant === 'error' ? 'alert' : 'status',
  });

const promptForValue = ({ message, defaultValue = '', required = false }) => {
  const response = window.prompt(message, defaultValue);

  if (response === null) {
    return { cancelled: true, value: null };
  }

  const trimmed = response.trim();
  if (required && !trimmed) {
    return { cancelled: false, value: null };
  }

  return { cancelled: false, value: trimmed };
};

const buildModuleDefinition = async (editor, markup) => {
  const selected = editor.getSelected();
  const suggestedLabel =
    selected?.get('custom-name') ||
    (typeof selected?.getName === 'function' && selected.getName()) ||
    'Custom Block';

  const labelPrompt = promptForValue({
    message: 'Enter a label for this block',
    defaultValue: suggestedLabel,
    required: true,
  });

  if (labelPrompt.cancelled) {
    return null;
  }

  if (!labelPrompt.value) {
    showSaveBlockToast('A label is required to save the block.', {
      variant: 'error',
      duration: 4000,
    });
    return null;
  }

  const label = labelPrompt.value;
  const suggestedId = `custom-${slugify(label)}`;
  const idPrompt = promptForValue({
    message: 'Enter a unique identifier for this block',
    defaultValue: suggestedId,
    required: true,
  });

  if (idPrompt.cancelled) {
    return null;
  }

  if (!idPrompt.value) {
    showSaveBlockToast('A unique identifier is required to save the block.', {
      variant: 'error',
      duration: 4000,
    });
    return null;
  }

  const id = idPrompt.value;
  let existingModule = null;

  try {
    const modules = await loadBlocks();
    existingModule = modules.find((module) => module.id === id) || null;
  } catch (error) {
    console.warn('[CustomBlocks] Unable to verify existing modules before saving', error);
  }

  if (existingModule) {
    const confirmed = window.confirm(
      `A block with the identifier "${id}" already exists. Do you want to overwrite it?`
    );

    if (!confirmed) {
      showSaveBlockToast('Block save cancelled.', { duration: 2400 });
      return null;
    }
  }

  const categoryPrompt = promptForValue({
    message: 'Enter a category for this block (optional)',
    defaultValue: existingModule?.category || DEFAULT_BLOCK_CATEGORY,
  });

  if (categoryPrompt?.cancelled) {
    return null;
  }

  const thumbnailPrompt = promptForValue({
    message: 'Enter a thumbnail URL for this block (optional)',
    defaultValue: existingModule?.thumbnail || '',
  });

  if (thumbnailPrompt?.cancelled) {
    return null;
  }

  const moduleDefinition = {
    id,
    label,
    category: categoryPrompt?.value || DEFAULT_BLOCK_CATEGORY,
    markup: markup.trim(),
    metadata: {
      ...(existingModule?.metadata || {}),
      savedFrom: 'editor',
    },
  };

  if (thumbnailPrompt?.value) {
    moduleDefinition.thumbnail = thumbnailPrompt.value;
  }

  return {
    moduleDefinition,
    isUpdate: Boolean(existingModule),
  };
};

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
    const savedModules = await loadBlocks();
    if (Array.isArray(savedModules) && savedModules.length) {
      addCustomBlocks(editor, savedModules);
    }
  } catch (error) {
    console.error('[CustomBlocks] Failed to restore saved modules', error);
  }
}

function setupModuleLibraryControls(editor) {
  ensureModuleLibraryReady(editor);

  const panelsApi = editor?.Panels;
  const commandsApi = editor?.Commands;

  if (!panelsApi || !commandsApi) {
    return;
  }

  const getModuleLibraryButton = () =>
    typeof panelsApi.getButton === 'function'
      ? panelsApi.getButton('views', MODULE_LIBRARY_COMMAND_ID)
      : null;

  const hasCommand =
    typeof commandsApi.get === 'function' && commandsApi.get(MODULE_LIBRARY_COMMAND_ID);

  if (!hasCommand) {
    commandsApi.add(MODULE_LIBRARY_COMMAND_ID, {
      run(ed) {
        showModuleLibraryPanel(ed);
        initMarketingTemplatesUI(ed);
      },
      stop(ed) {
        hideModuleLibraryPanel(ed);
      },
    });
  }

  if (!getModuleLibraryButton()) {
    panelsApi.addButton('views', {
      id: MODULE_LIBRARY_COMMAND_ID,
      className: 'fa fa-th-large',
      command: MODULE_LIBRARY_COMMAND_ID,
      attributes: {
        title: 'Module Library',
      },
      togglable: true,
    });
  }

  if (!editor.__moduleLibraryListenersAttached) {
    const deactivateModuleLibrary = () => {
      hideModuleLibraryPanel(editor);
      const button = getModuleLibraryButton();
      if (button && typeof button.set === 'function') {
        button.set('active', false);
      }
    };

    editor.on('run:open-sm', deactivateModuleLibrary);
    editor.on('run:open-layers', deactivateModuleLibrary);
    editor.on('run:open-blocks', deactivateModuleLibrary);

    editor.__moduleLibraryListenersAttached = true;
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
      showSaveBlockToast('Select a component in the canvas to save it as a block.', {
        variant: 'error',
      });
      return;
    }

    const markup = getSelectedMarkup(editor);

    if (!markup) {
      showSaveBlockToast('Unable to serialise the selected component. Try another element.', {
        variant: 'error',
        duration: 4000,
      });
      return;
    }

    const moduleDetails = await buildModuleDefinition(editor, markup);
    if (!moduleDetails) {
      return;
    }

    const { moduleDefinition, isUpdate } = moduleDetails;

    saveButton.disabled = true;

    try {
      const persistedModules = await saveBlock(moduleDefinition);
      const savedModule = Array.isArray(persistedModules)
        ? persistedModules.find((module) => module.id === moduleDefinition.id)
        : null;
      addCustomBlocks(editor, [savedModule || moduleDefinition]);
      editor.BlockManager.render();
      showSaveBlockToast(
        isUpdate ? 'Block updated in your library.' : 'Block saved to your library.',
        {
          variant: 'success',
          duration: 2500,
        }
      );
    } catch (error) {
      console.error('[CustomBlocks] Failed to save module', error);
      showSaveBlockToast('Unable to save block. Check the console for details.', {
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
  setupModuleLibraryControls(window.editor);

  window.editor.on('load', function () {
    ensureModuleLibraryReady(window.editor);
    hideModuleLibraryPanel(window.editor);
    initModuleManagerUI(window.editor);
    initMarketingTemplatesUI(window.editor);
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
