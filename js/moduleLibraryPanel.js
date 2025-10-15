import { ExampleModules } from './custom-blocks.js';
import { insertModuleIntoCanvas } from './moduleManagerUI.js';

const PANEL_ID = 'module-library-panel';
const MARKETING_LIST_ID = 'marketing-templates-list';
const MODULE_LIST_WRAPPER_ID = 'module-library-modules';
const MODULE_LIBRARY_BUTTON_ID = 'open-module-library';
const MODULE_LIBRARY_COMMAND_ID = 'show-module-library';
const MODULE_LIBRARY_HIDDEN_ATTR = 'data-module-library-hidden';
const MODULE_LIBRARY_PREV_DISPLAY_ATTR = 'data-module-library-prev-display';

function buildPanelMarkup() {
  const panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.className = 'module-library-panel';
  panel.setAttribute('aria-label', 'Module library');

  panel.innerHTML = `
    <header class="module-library-panel__header">
      <h2 class="module-library-panel__title">Module Library</h2>
      <p class="module-library-panel__subtitle">Reuse saved modules or start from marketing templates.</p>
    </header>
    <div class="module-library-panel__group module-library-panel__group--marketing">
      <h3 class="module-library-panel__group-title">Marketing Templates</h3>
      <div id="${MARKETING_LIST_ID}" class="module-library-panel__list module-library-panel__list--marketing" role="list"></div>
    </div>
    <div class="module-library-panel__group module-library-panel__group--modules">
      <h3 class="module-library-panel__group-title">My Modules</h3>
      <div id="${MODULE_LIST_WRAPPER_ID}" class="module-library-panel__list module-library-panel__list--modules">
        <div id="user-modules-list" class="module-list" aria-live="polite"></div>
      </div>
    </div>
  `;

  return panel;
}

function resolveViewsContainer(editor) {
  if (!editor || !editor.Panels) {
    return null;
  }

  const viewsPanel = editor.Panels.getPanel('views-container');
  if (!viewsPanel) {
    return null;
  }

  const el = viewsPanel.get('el');
  if (el) {
    return el;
  }

  return viewsPanel.view?.el || null;
}

export function mountModuleLibraryPanel(editor) {
  const viewsContainer = resolveViewsContainer(editor);
  if (!viewsContainer) {
    return null;
  }
  let panel = viewsContainer.querySelector(`#${PANEL_ID}`);
  if (!panel) {
    panel = buildPanelMarkup();
    viewsContainer.appendChild(panel);
  }

  return panel;
}

function createEmptyState() {
  const emptyState = document.createElement('p');
  emptyState.className = 'marketing-template-list__empty';
  emptyState.textContent = 'Marketing templates will appear here when available.';
  return emptyState;
}

function buildTemplateCard(editor, template) {
  const card = document.createElement('article');
  card.className = 'marketing-template-card';
  card.setAttribute('role', 'listitem');

  const thumbnail = document.createElement('div');
  thumbnail.className = 'marketing-template-card__thumbnail';

  if (template.thumbnail) {
    const image = document.createElement('img');
    image.src = template.thumbnail;
    image.alt = `${template.label} preview`;
    thumbnail.appendChild(image);
  } else {
    thumbnail.classList.add('marketing-template-card__thumbnail--placeholder');
    thumbnail.textContent = template.label.charAt(0).toUpperCase();
  }

  const body = document.createElement('div');
  body.className = 'marketing-template-card__body';

  const title = document.createElement('h4');
  title.className = 'marketing-template-card__title';
  title.textContent = template.label;

  const description = document.createElement('p');
  description.className = 'marketing-template-card__description';
  const templateDescription = template.metadata?.description;
  description.textContent = templateDescription || 'Reusable marketing layout ready to drop into your design.';

  const actions = document.createElement('div');
  actions.className = 'marketing-template-card__actions';

  const insertButton = document.createElement('button');
  insertButton.type = 'button';
  insertButton.className = 'marketing-template-card__action';
  insertButton.textContent = 'Add to canvas';
  insertButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    insertModuleIntoCanvas(editor, template);
  });

  actions.appendChild(insertButton);

  body.appendChild(title);
  body.appendChild(description);
  body.appendChild(actions);

  card.appendChild(thumbnail);
  card.appendChild(body);

  return card;
}

export function initMarketingTemplatesUI(editor) {
  const list = document.getElementById(MARKETING_LIST_ID);
  if (!list) {
    return;
  }

  list.innerHTML = '';

  if (!Array.isArray(ExampleModules) || !ExampleModules.length) {
    list.appendChild(createEmptyState());
    return;
  }

  ExampleModules.forEach((template) => {
    const card = buildTemplateCard(editor, template);
    list.appendChild(card);
  });
}

export function ensureModuleLibraryReady(editor) {
  const panel = mountModuleLibraryPanel(editor);
  if (!panel) {
    return;
  }

  if (!panel.hasAttribute('data-module-library-initialised')) {
    panel.setAttribute('hidden', 'true');
    panel.setAttribute('aria-hidden', 'true');
    panel.setAttribute('data-module-library-initialised', 'true');
  }

  const moduleListWrapper = panel.querySelector(`#${MODULE_LIST_WRAPPER_ID}`);
  if (moduleListWrapper) {
    moduleListWrapper.setAttribute('role', 'region');
    moduleListWrapper.setAttribute('aria-live', 'polite');
  }
}

function hideNonModuleViews(viewsContainer, panel) {
  Array.from(viewsContainer.children).forEach((child) => {
    if (child === panel) {
      child.removeAttribute(MODULE_LIBRARY_HIDDEN_ATTR);
      child.removeAttribute(MODULE_LIBRARY_PREV_DISPLAY_ATTR);
      child.style.display = '';
      return;
    }

    if (child.hasAttribute(MODULE_LIBRARY_HIDDEN_ATTR)) {
      return;
    }

    const currentDisplay = child.style.display || '';
    child.setAttribute(MODULE_LIBRARY_HIDDEN_ATTR, 'true');
    child.setAttribute(MODULE_LIBRARY_PREV_DISPLAY_ATTR, currentDisplay);
    child.setAttribute('aria-hidden', 'true');
    child.style.display = 'none';
  });
}

function restoreNonModuleViews(viewsContainer, panel) {
  Array.from(viewsContainer.children).forEach((child) => {
    if (child === panel) {
      child.style.display = '';
      child.setAttribute('hidden', 'true');
      child.setAttribute('aria-hidden', 'true');
      return;
    }

    if (!child.hasAttribute(MODULE_LIBRARY_HIDDEN_ATTR)) {
      return;
    }

    const previousDisplay = child.getAttribute(MODULE_LIBRARY_PREV_DISPLAY_ATTR) || '';
    child.style.display = previousDisplay;
    child.removeAttribute(MODULE_LIBRARY_HIDDEN_ATTR);
    child.removeAttribute(MODULE_LIBRARY_PREV_DISPLAY_ATTR);
    child.removeAttribute('aria-hidden');
  });
}

function showModuleLibrary(editor) {
  const viewsContainer = resolveViewsContainer(editor);
  const panel = mountModuleLibraryPanel(editor);

  if (!viewsContainer || !panel) {
    return;
  }

  panel.removeAttribute('hidden');
  panel.setAttribute('aria-hidden', 'false');

  hideNonModuleViews(viewsContainer, panel);
}

function hideModuleLibrary(editor) {
  const viewsContainer = resolveViewsContainer(editor);
  if (!viewsContainer) {
    return;
  }

  const panel = viewsContainer.querySelector(`#${PANEL_ID}`);
  if (!panel) {
    return;
  }

  restoreNonModuleViews(viewsContainer, panel);
}

export function registerModuleLibraryView(editor) {
  if (!editor) {
    return;
  }

  const panels = editor.Panels;
  if (!panels) {
    return;
  }

  const viewsPanel = panels.getPanel('views');
  if (!viewsPanel) {
    return;
  }

  const existingButton = panels.getButton('views', MODULE_LIBRARY_BUTTON_ID);
  if (!existingButton) {
    panels.addButton('views', {
      id: MODULE_LIBRARY_BUTTON_ID,
      className: 'module-library-button',
      attributes: {
        title: 'Module Library',
      },
      label: 'Modules',
      command: MODULE_LIBRARY_COMMAND_ID,
      togglable: true,
    });
  }

  const commands = editor.Commands;
  const hasCommand =
    commands && typeof commands.get === 'function' && commands.get(MODULE_LIBRARY_COMMAND_ID);
  if (!hasCommand) {
    commands.add(MODULE_LIBRARY_COMMAND_ID, {
      run(ed) {
        ensureModuleLibraryReady(ed);
        showModuleLibrary(ed);
      },
      stop(ed) {
        hideModuleLibrary(ed);
      },
    });
  }

  ensureModuleLibraryReady(editor);
}

