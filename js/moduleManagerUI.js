import addCustomBlocks, { removeModuleFromBlockManager } from './custom-blocks.js';
import {
  loadBlocks,
  updateBlock,
  deleteBlock,
  MODULES_CHANGED_EVENT
} from './modulePersistence.js';
import { showToast } from './toast.js';

const MODULE_LIST_ID = 'user-modules-list';
const EDIT_DIALOG_ID = 'module-edit-dialog';
const EDIT_FORM_ID = 'module-edit-form';
const EDIT_NAME_ID = 'module-edit-name';
const EDIT_CATEGORY_ID = 'module-edit-category';
const EDIT_MARKUP_ID = 'module-edit-markup';
const FALLBACK_CATEGORY = 'Custom Modules';
const VERSIONS_DIALOG_ID = 'module-versions-dialog';
const VERSIONS_DESCRIPTION_ID = 'module-versions-description';
const VERSIONS_BODY_ID = 'module-versions-body';

function createEmptyState() {
  const emptyState = document.createElement('p');
  emptyState.className = 'module-list__empty';
  emptyState.textContent = 'Saved modules will appear here.';
  return emptyState;
}

function formatTimestamp(timestamp) {
  if (!timestamp) {
    return 'Unknown date';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return date.toLocaleString();
}

function buildThumbnail(module) {
  const thumbnailWrapper = document.createElement('div');
  thumbnailWrapper.className = 'module-list__thumbnail';

  if (module.thumbnail) {
    const img = document.createElement('img');
    img.src = module.thumbnail;
    img.alt = `${module.label} preview`;
    thumbnailWrapper.appendChild(img);
  } else {
    thumbnailWrapper.classList.add('module-list__thumbnail--placeholder');
    thumbnailWrapper.textContent = module.label.charAt(0).toUpperCase();
  }

  return thumbnailWrapper;
}

export function insertModuleIntoCanvas(editor, module) {
  const selected = editor.getSelected();

  if (selected && typeof selected.append === 'function') {
    selected.append(module.markup);
  } else {
    editor.addComponents(module.markup);
  }

  showToast({
    id: 'module-insert-feedback',
    message: `Added "${module.label}" to the canvas.`,
    variant: 'success',
    duration: 2400
  });
}

function resolveUpdatedModule(modules, moduleId) {
  return modules.find((module) => module && module.id === moduleId);
}

export function initModuleManagerUI(editor) {
  const listContainer = document.getElementById(MODULE_LIST_ID);
  if (!editor || !listContainer) {
    return;
  }

  const dialog = document.getElementById(EDIT_DIALOG_ID);
  const form = document.getElementById(EDIT_FORM_ID);
  const nameInput = document.getElementById(EDIT_NAME_ID);
  const categoryInput = document.getElementById(EDIT_CATEGORY_ID);
  const markupInput = document.getElementById(EDIT_MARKUP_ID);
  const cancelButton = dialog?.querySelector('[data-action="cancel"]');
  const versionsDialog = document.getElementById(VERSIONS_DIALOG_ID);
  const versionsDescription = document.getElementById(VERSIONS_DESCRIPTION_ID);
  const versionsBody = document.getElementById(VERSIONS_BODY_ID);
  const versionsCloseButton = versionsDialog?.querySelector('[data-action="close"]');

  let modules = [];
  let editingModuleId = null;
  let viewingVersionsFor = null;

  const closeDialog = () => {
    if (dialog && dialog.open) {
      dialog.close();
    }

    if (form) {
      form.reset();
    }

    editingModuleId = null;
  };

  const closeVersionsDialog = () => {
    if (versionsDialog && versionsDialog.open) {
      versionsDialog.close();
    }

    if (versionsBody) {
      versionsBody.innerHTML = '';
    }

    if (versionsDescription) {
      versionsDescription.textContent = '';
    }

    viewingVersionsFor = null;
  };

  const renderVersionHistory = (module) => {
    if (!versionsBody) {
      return;
    }

    versionsBody.innerHTML = '';

    const history = Array.isArray(module.history) ? module.history : [];

    if (!history.length) {
      const empty = document.createElement('p');
      empty.className = 'module-versions-dialog__empty';
      empty.textContent = 'This module does not have any previous versions yet.';
      versionsBody.appendChild(empty);
      return;
    }

    history.forEach((entry) => {
      const item = document.createElement('article');
      item.className = 'module-versions-dialog__version';
      item.setAttribute('role', 'listitem');

      const header = document.createElement('div');
      header.className = 'module-versions-dialog__version-header';

      const title = document.createElement('span');
      title.className = 'module-versions-dialog__version-title';
      title.textContent = `Version ${entry.version || 1}`;

      const meta = document.createElement('span');
      meta.className = 'module-versions-dialog__version-meta';
      const category = entry.category || FALLBACK_CATEGORY;
      meta.textContent = `${formatTimestamp(entry.updatedAt)} • ${category}`;

      header.appendChild(title);
      header.appendChild(meta);
      item.appendChild(header);

      const labelRow = document.createElement('p');
      labelRow.className = 'module-versions-dialog__version-label';
      labelRow.textContent = `Label: ${entry.label}`;
      item.appendChild(labelRow);

      const markupBlock = document.createElement('pre');
      markupBlock.className = 'module-versions-dialog__markup';
      markupBlock.textContent = entry.markup;
      item.appendChild(markupBlock);

      versionsBody.appendChild(item);
    });
  };

  const openVersionsDialog = (module) => {
    const history = Array.isArray(module.history) ? module.history : [];

    if (!versionsDialog || typeof versionsDialog.showModal !== 'function') {
      if (!history.length) {
        window.alert('No previous versions available for this module yet.');
        return;
      }

      const summary = history
        .map(
          (entry) =>
            `Version ${entry.version || 1} (${formatTimestamp(entry.updatedAt)}):\n${entry.markup}`
        )
        .join('\n\n');
      window.alert(summary);
      return;
    }

    viewingVersionsFor = module.id;

    if (versionsDescription) {
      versionsDescription.textContent = `Viewing history for "${module.label}". Current version v${module.version || 1} • Updated ${formatTimestamp(module.updatedAt)}.`;
    }

    renderVersionHistory(module);
    versionsDialog.showModal();
  };

  const openEditDialog = (module) => {
    editingModuleId = module.id;

    if (nameInput) {
      nameInput.value = module.label;
    }

    if (categoryInput) {
      categoryInput.value = module.category || '';
    }

    if (markupInput) {
      markupInput.value = module.markup;
    }

    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      // Fallback to prompt dialogs when <dialog> is unsupported
      const newName = window.prompt('Module name', module.label);
      const newCategory = window.prompt('Module category', module.category || FALLBACK_CATEGORY);
      const newMarkup = window.prompt('Module markup', module.markup);

      if (!newName || !newMarkup) {
        return;
      }

      handleModuleUpdate({
        ...module,
        label: newName,
        category: newCategory || FALLBACK_CATEGORY,
        markup: newMarkup
      });
    }
  };

  const render = () => {
    listContainer.innerHTML = '';

    if (!modules.length) {
      listContainer.appendChild(createEmptyState());
      return;
    }

    const listElement = document.createElement('ul');
    listElement.className = 'module-list__items';

    modules.forEach((module) => {
      const listItem = document.createElement('li');
      listItem.className = 'module-list__item';

      const moduleButton = document.createElement('button');
      moduleButton.type = 'button';
      moduleButton.className = 'module-list__module';
      moduleButton.addEventListener('click', () => insertModuleIntoCanvas(editor, module));

      const thumbnail = buildThumbnail(module);
      const info = document.createElement('div');
      info.className = 'module-list__info';

      const label = document.createElement('span');
      label.className = 'module-list__label';
      label.textContent = module.label;

      const meta = document.createElement('span');
      meta.className = 'module-list__meta';
      const versionNumber = module.version || 1;
      const category = module.category || FALLBACK_CATEGORY;
      meta.textContent = `Version ${versionNumber} • ${category}`;

      info.appendChild(label);
      info.appendChild(meta);

      moduleButton.appendChild(thumbnail);
      moduleButton.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'module-list__actions';

      const versionsButton = document.createElement('button');
      versionsButton.type = 'button';
      versionsButton.className = 'module-list__action';
      versionsButton.textContent = 'Versions';
      versionsButton.setAttribute('aria-label', `View versions of ${module.label}`);
      versionsButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openVersionsDialog(module);
      });

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'module-list__action';
      editButton.textContent = 'Edit';
      editButton.addEventListener('click', (event) => {
        event.stopPropagation();
        openEditDialog(module);
      });

      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'module-list__action module-list__action--danger';
      deleteButton.textContent = 'Delete';
      deleteButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        const confirmed = window.confirm(`Delete "${module.label}"?`);
        if (!confirmed) {
          return;
        }

        try {
          modules = await deleteBlock(module.id);
          removeModuleFromBlockManager(editor, module.id);
          editor.BlockManager.render();
          render();
          showToast({
            id: 'module-delete-feedback',
            message: 'Module removed.',
            variant: 'success',
            duration: 2200
          });
        } catch (error) {
          console.error('[ModuleManager] Failed to delete module', error);
          showToast({
            id: 'module-delete-feedback',
            message: 'Failed to delete module. Check the console for details.',
            variant: 'error',
            duration: 4200
          });
        }
      });

      actions.appendChild(versionsButton);
      actions.appendChild(editButton);
      actions.appendChild(deleteButton);

      listItem.appendChild(moduleButton);
      listItem.appendChild(actions);
      listElement.appendChild(listItem);
    });

    listContainer.appendChild(listElement);

    if (viewingVersionsFor && versionsDialog?.open) {
      const activeModule = modules.find((module) => module.id === viewingVersionsFor);
      if (activeModule) {
        if (versionsDescription) {
          versionsDescription.textContent = `Viewing history for "${activeModule.label}". Current version v${activeModule.version || 1} • Updated ${formatTimestamp(activeModule.updatedAt)}.`;
        }
        renderVersionHistory(activeModule);
      } else {
        closeVersionsDialog();
      }
    }
  };

  async function handleModuleUpdate(updatedDefinition) {
    try {
      const updatedModules = await updateBlock(updatedDefinition);
      const refreshedModule = resolveUpdatedModule(updatedModules, updatedDefinition.id);

      if (refreshedModule) {
        addCustomBlocks(editor, [refreshedModule]);
      }

      editor.BlockManager.render();
      modules = updatedModules;
      render();
      showToast({
        id: 'module-edit-feedback',
        message: 'Module updated.',
        variant: 'success',
        duration: 2200
      });
      return true;
    } catch (error) {
      console.error('[ModuleManager] Failed to update module', error);
      showToast({
        id: 'module-edit-feedback',
        message: 'Failed to update module. Check the console for details.',
        variant: 'error',
        duration: 4200
      });
      return false;
    }
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!editingModuleId) {
        return;
      }

      const existing = modules.find((module) => module.id === editingModuleId);
      if (!existing) {
        closeDialog();
        return;
      }

      const nextLabel = nameInput?.value.trim();
      const nextCategory = categoryInput?.value.trim();
      const nextMarkup = markupInput?.value.trim();

      if (!nextLabel || !nextMarkup) {
        return;
      }

      const succeeded = await handleModuleUpdate({
        ...existing,
        label: nextLabel,
        category: nextCategory || FALLBACK_CATEGORY,
        markup: nextMarkup
      });

      if (succeeded) {
        closeDialog();
      }
    });
  }

  if (cancelButton) {
    cancelButton.addEventListener('click', (event) => {
      event.preventDefault();
      closeDialog();
    });
  }

  if (dialog) {
    dialog.addEventListener('cancel', closeDialog);
    dialog.addEventListener('close', closeDialog);
  }

  if (versionsCloseButton) {
    versionsCloseButton.addEventListener('click', (event) => {
      event.preventDefault();
      closeVersionsDialog();
    });
  }

  if (versionsDialog) {
    versionsDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeVersionsDialog();
    });
    versionsDialog.addEventListener('close', closeVersionsDialog);
  }

  const refreshModules = async () => {
    modules = await loadBlocks();
    render();
  };

  window.addEventListener(MODULES_CHANGED_EVENT, (event) => {
    const detailModules = event.detail?.modules;
    if (Array.isArray(detailModules)) {
      modules = detailModules;
      render();
    } else {
      refreshModules();
    }
  });

  refreshModules();
}

export default initModuleManagerUI;
