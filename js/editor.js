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
const DEFAULT_EMAIL_FONT_NAME = 'Inter';
const DEFAULT_EMAIL_FONT_HREF = 'https://rsms.me/inter/inter.css';
const DEFAULT_EMAIL_FONT = `${DEFAULT_EMAIL_FONT_NAME}, Arial, sans-serif`;
const getDefaultFontOption = () => ({
  value: DEFAULT_EMAIL_FONT,
  name: DEFAULT_EMAIL_FONT_NAME,
});

const MJ_TEXT_COMPONENT_TYPE = 'mj-text';
const MJ_TEXT_STYLE_ATTRIBUTE_MAP = {
  color: 'color',
  'font-family': 'font-family',
  'font-size': 'font-size',
  'font-style': 'font-style',
  'font-weight': 'font-weight',
  'line-height': 'line-height',
  'letter-spacing': 'letter-spacing',
  'text-align': 'align',
  'text-decoration': 'text-decoration',
  'text-transform': 'text-transform',
  'background-color': 'background-color',
  'container-background-color': 'container-background-color',
  padding: 'padding',
  'padding-top': 'padding-top',
  'padding-right': 'padding-right',
  'padding-bottom': 'padding-bottom',
  'padding-left': 'padding-left',
};

const isMjTextComponent = (component) =>
  Boolean(component?.is) && component.is(MJ_TEXT_COMPONENT_TYPE);

const forEachComponentInTree = (component, callback) => {
  if (!component || typeof callback !== 'function') {
    return;
  }

  callback(component);

  if (typeof component.components !== 'function') {
    return;
  }

  const children = component.components();
  if (!children || typeof children.each !== 'function') {
    return;
  }

  children.each((child) => forEachComponentInTree(child, callback));
};

const getManagedMjTextAttrs = (component) => {
  if (!component) {
    return null;
  }

  if (!component.__managedMjTextAttrs) {
    component.__managedMjTextAttrs = {};
  }

  return component.__managedMjTextAttrs;
};

const markManagedMjTextAttr = (component, attrName) => {
  const managedAttrs = getManagedMjTextAttrs(component);
  if (managedAttrs) {
    managedAttrs[attrName] = true;
  }
};

const unmarkManagedMjTextAttr = (component, attrName) => {
  const managedAttrs = component?.__managedMjTextAttrs;
  if (managedAttrs && Object.prototype.hasOwnProperty.call(managedAttrs, attrName)) {
    delete managedAttrs[attrName];
  }
};

const isManagedMjTextAttr = (component, attrName) =>
  Boolean(component?.__managedMjTextAttrs?.[attrName]);

const normaliseMjTextStyles = (component, properties, { allowRemoval = false } = {}) => {
  if (!isMjTextComponent(component) || component.__normalisingMjTextStyles) {
    return;
  }

  component.__normalisingMjTextStyles = true;

  try {
    const style =
      (typeof component.getStyle === 'function' && component.getStyle()) || {};
    let attributes =
      (typeof component.getAttributes === 'function' && component.getAttributes()) || {};

    const propertiesToCheck = (() => {
      if (Array.isArray(properties) && properties.length) {
        return Array.from(new Set(properties));
      }

      return Object.keys(style);
    })();

    propertiesToCheck.forEach((styleName) => {
      const attrName = MJ_TEXT_STYLE_ATTRIBUTE_MAP[styleName];
      if (!attrName) {
        return;
      }

      const value = style?.[styleName];

      if (value !== undefined && value !== null && value !== '') {
        if (typeof component.addAttributes === 'function') {
          component.addAttributes({ [attrName]: value });
          attributes =
            (typeof component.getAttributes === 'function' &&
              component.getAttributes()) ||
            { ...attributes, [attrName]: value };
          attributes[attrName] = value;
          markManagedMjTextAttr(component, attrName);
        }

        if (typeof component.removeStyle === 'function' && styleName in style) {
          component.removeStyle(styleName);
        }

        return;
      }

      if (
        allowRemoval &&
        isManagedMjTextAttr(component, attrName) &&
        Object.prototype.hasOwnProperty.call(attributes, attrName)
      ) {
        if (typeof component.removeAttributes === 'function') {
          component.removeAttributes(attrName);
          attributes =
            (typeof component.getAttributes === 'function' &&
              component.getAttributes()) ||
            attributes;
        } else if (typeof component.setAttributes === 'function') {
          const nextAttributes = { ...attributes };
          delete nextAttributes[attrName];
          component.setAttributes(nextAttributes);
          attributes = nextAttributes;
        }

        delete attributes[attrName];
        unmarkManagedMjTextAttr(component, attrName);
      }
    });
  } finally {
    component.__normalisingMjTextStyles = false;
  }
};

const attachMjTextStyleNormaliser = (component) => {
  if (!component) {
    return;
  }

  forEachComponentInTree(component, (cmp) => {
    if (!isMjTextComponent(cmp)) {
      return;
    }

    if (!cmp.__mjTextStyleNormaliserAttached && typeof cmp.on === 'function') {
      cmp.__mjTextStyleNormaliserAttached = true;

      cmp.on('change:style', (model, newStyle = {}) => {
        const previousStyle =
          (typeof model.previous === 'function' && model.previous('style')) || {};

        const changedProperties = Array.from(
          new Set([
            ...Object.keys(previousStyle || {}),
            ...Object.keys(newStyle || {}),
          ])
        );

        normaliseMjTextStyles(model, changedProperties, { allowRemoval: true });
      });
    }

    normaliseMjTextStyles(cmp);
  });
};

const setDefaultFontForWrapper = (editor) => {
  if (!editor || typeof editor.getWrapper !== 'function') {
    return;
  }

  const wrapper = editor.getWrapper();
  if (wrapper && typeof wrapper.addStyle === 'function') {
    wrapper.addStyle({ 'font-family': DEFAULT_EMAIL_FONT });
  }
};

const normalizeFontOptionValue = (value) =>
  value ? value.toString().trim().toLowerCase() : '';

const optionMatchesFont = (option, fontOption) => {
  if (!option) {
    return false;
  }

  const targetValues = [fontOption.value, fontOption.name]
    .filter(Boolean)
    .map(normalizeFontOptionValue);

  if (!targetValues.length) {
    return false;
  }

  if (typeof option === 'string') {
    return targetValues.includes(normalizeFontOptionValue(option));
  }

  const value = option.value ?? option.id ?? option.name ?? '';
  const name = option.name ?? option.label ?? '';

  return (
    targetValues.includes(normalizeFontOptionValue(value)) ||
    targetValues.includes(normalizeFontOptionValue(name))
  );
};

const ensureFontOptionsIncludeDefault = (options, fontOption) => {
  if (!Array.isArray(options) || !options.length) {
    return [fontOption];
  }

  if (options.some((option) => optionMatchesFont(option, fontOption))) {
    return options;
  }

  const areStrings = options.every((option) => typeof option === 'string');

  if (areStrings) {
    return [...options, fontOption.value || fontOption.name];
  }

  return [...options, fontOption];
};

const ensureFontPropertyHasDefault = (editor) => {
  const styleManager = editor?.StyleManager;

  if (!styleManager || typeof styleManager.getProperty !== 'function') {
    return;
  }

  const fontProperty = styleManager.getProperty('typography', 'font-family');

  if (!fontProperty || typeof fontProperty.set !== 'function') {
    return;
  }

  const fontOption = getDefaultFontOption();
  const currentOptions =
    fontProperty.get?.('options') || fontProperty.get?.('list') || [];
  const nextOptions = ensureFontOptionsIncludeDefault(currentOptions, fontOption);

  fontProperty.set('options', nextOptions);
  fontProperty.set('list', nextOptions);
  fontProperty.set('default', fontOption.value);

  const currentValue =
    (typeof fontProperty.getValue === 'function' &&
      fontProperty.getValue()) ||
    fontProperty.get?.('value');

  if (!currentValue) {
    if (typeof fontProperty.setValue === 'function') {
      fontProperty.setValue(fontOption.value);
    } else {
      fontProperty.set('value', fontOption.value);
    }
  }
};

const ensureDefaultFontTrait = (component) => {
  if (!component) {
    return;
  }

  forEachComponentInTree(component, (cmp) => {
    const traits = cmp?.get?.('traits');

    if (!traits || typeof traits.each !== 'function') {
      return;
    }

    traits.each((trait) => {
      if (!trait || typeof trait.get !== 'function') {
        return;
      }

      if (trait.get('name') !== 'font-family') {
        return;
      }

      const fontOption = getDefaultFontOption();
      const currentOptions =
        trait.get?.('options') || trait.get?.('list') || [];
      const nextOptions = ensureFontOptionsIncludeDefault(
        currentOptions,
        fontOption
      );

      if (typeof trait.set === 'function') {
        trait.set('options', nextOptions);
        trait.set('list', nextOptions);
        trait.set('default', fontOption.value);
      }

      const currentValue = trait.get?.('value');

      if (!currentValue) {
        if (typeof trait.setValue === 'function') {
          trait.setValue(fontOption.value);
        } else if (typeof trait.set === 'function') {
          trait.set('value', fontOption.value);
        }
      }
    });
  });
};

const applyDefaultFontToMjText = (component) => {
  if (!component) {
    return;
  }

  forEachComponentInTree(component, (cmp) => {
    if (!isMjTextComponent(cmp)) {
      return;
    }

    const attributes =
      (typeof cmp.getAttributes === 'function' && cmp.getAttributes()) || {};
    const style = (typeof cmp.getStyle === 'function' && cmp.getStyle()) || {};

    const hasFontAttribute = Boolean(
      attributes &&
        Object.prototype.hasOwnProperty.call(attributes, 'font-family') &&
        attributes['font-family']
    );
    const hasFontStyle = Boolean(style && style['font-family']);

    if (!hasFontAttribute && !hasFontStyle && typeof cmp.addAttributes === 'function') {
      cmp.addAttributes({ 'font-family': DEFAULT_EMAIL_FONT });
    }
  });
};

const getViewsContainer = (editor) => {
  const panelsApi = editor?.Panels;
  if (!panelsApi || typeof panelsApi.getPanel !== 'function') {
    return null;
  }

  const viewsPanel = panelsApi.getPanel('views-container');
  if (!viewsPanel) {
    return null;
  }

  return viewsPanel.get?.('el') || viewsPanel.view?.el || null;
};

const getPanelElement = (editor, panelId) => {
  const panelsApi = editor?.Panels;
  if (!panelsApi || typeof panelsApi.getPanel !== 'function') {
    return null;
  }

  const panel = panelsApi.getPanel(panelId);
  if (!panel) {
    return null;
  }

  return panel.get?.('el') || panel.view?.el || null;
};

const syncViewsContainerLayout = (editor) => {
  const viewsContainer = getViewsContainer(editor);
  if (!viewsContainer) {
    return;
  }

  const viewsNav =
    getPanelElement(editor, 'views') ||
    document.querySelector('.gjs-pn-panel.gjs-pn-views');

  const navHeight = viewsNav?.offsetHeight || 0;

  if (navHeight) {
    viewsContainer.style.setProperty(
      '--views-panel-header-offset',
      `${navHeight}px`
    );
  } else {
    viewsContainer.style.removeProperty('--views-panel-header-offset');
  }
};

const registerViewsContainerLayoutSync = (editor) => {
  if (!editor) {
    return;
  }

  const sync = () => syncViewsContainerLayout(editor);
  sync();

  const viewsNav = getPanelElement(editor, 'views');

  if (typeof ResizeObserver === 'function' && viewsNav) {
    const resizeObserver = new ResizeObserver(() => sync());
    resizeObserver.observe(viewsNav);
    editor.once('destroy', () => resizeObserver.disconnect());
  } else {
    window.addEventListener('resize', sync);
    editor.once('destroy', () => window.removeEventListener('resize', sync));
  }
};

const removeLayersAndBlocksFromRightPanel = (editor) => {
  const panelsApi = editor?.Panels;

  if (panelsApi && typeof panelsApi.removeButton === 'function') {
    ['open-blocks', 'open-layers'].forEach((buttonId) => {
      panelsApi.removeButton('views', buttonId);
    });
  }

  const viewsContainer = getViewsContainer(editor);
  if (!viewsContainer) {
    return;
  }

  ['.gjs-blocks-c', '.gjs-layers-c'].forEach((selector) => {
    const view = viewsContainer.querySelector(selector);
    if (view && typeof view.remove === 'function') {
      view.remove();
    }
  });
};

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

  if (!editor) {
    return;
  }

  const panelsApi = editor.Panels;
  const commandsApi = editor.Commands;

  const areControlsReady =
    panelsApi &&
    commandsApi &&
    typeof panelsApi.addButton === 'function' &&
    typeof panelsApi.getButton === 'function' &&
    typeof commandsApi.add === 'function' &&
    typeof commandsApi.get === 'function';

  if (!areControlsReady) {
    if (
      typeof editor.once === 'function' &&
      !editor.__moduleLibraryControlsDeferred
    ) {
      editor.__moduleLibraryControlsDeferred = true;
      editor.once('load', () => {
        editor.__moduleLibraryControlsDeferred = false;
        setupModuleLibraryControls(editor);
      });
    }
    return;
  }

  const getModuleLibraryButton = () =>
    panelsApi.getButton('views', MODULE_LIBRARY_COMMAND_ID);

  const hasCommand =
    typeof commandsApi.get === 'function' &&
    commandsApi.get(MODULE_LIBRARY_COMMAND_ID);

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
      'grapesjs-mjml': {
        fonts: {
          [DEFAULT_EMAIL_FONT_NAME]: DEFAULT_EMAIL_FONT_HREF,
        },
      },
    }
  });

  configureStorageEvents(window.editor);
  initialiseCustomBlocks(window.editor);
  setupSaveBlockButton(window.editor);
  setupModuleLibraryControls(window.editor);
  ensureFontPropertyHasDefault(window.editor);

  window.editor.on('component:selected', (component) => {
    ensureDefaultFontTrait(component);
    applyDefaultFontToMjText(component);
    attachMjTextStyleNormaliser(component);
  });
  window.editor.on('component:add', (component) => {
    ensureDefaultFontTrait(component);
    applyDefaultFontToMjText(component);
    attachMjTextStyleNormaliser(component);
  });

  window.editor.on('load', function () {
    setupModuleLibraryControls(window.editor);
    setDefaultFontForWrapper(window.editor);
    ensureFontPropertyHasDefault(window.editor);
    const wrapper = window.editor.getWrapper();
    ensureDefaultFontTrait(wrapper);
    applyDefaultFontToMjText(wrapper);
    registerViewsContainerLayoutSync(window.editor);
    removeLayersAndBlocksFromRightPanel(window.editor);
    ensureModuleLibraryReady(window.editor);
    hideModuleLibraryPanel(window.editor);
    initModuleManagerUI(window.editor);
    initMarketingTemplatesUI(window.editor);
    attachMjTextStyleNormaliser(window.editor.getWrapper());
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

  window.editor.on('run:open-sm', () => ensureFontPropertyHasDefault(window.editor));
}

export default initEditor;
