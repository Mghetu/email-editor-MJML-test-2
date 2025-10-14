import { ExampleModules } from './custom-blocks.js';
import { insertModuleIntoCanvas } from './moduleManagerUI.js';

const PANEL_ID = 'module-library-panel';
const MARKETING_LIST_ID = 'marketing-templates-list';
const MODULE_LIST_WRAPPER_ID = 'module-library-modules';
const MODULE_LIBRARY_VIEW_FLAG = 'moduleLibraryView';

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
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    panel.dataset.moduleLibraryInitialised = 'true';
    viewsContainer.prepend(panel);
  }

  return panel;
}

function markOtherViewsHidden(viewsContainer, panel) {
  const children = Array.from(viewsContainer.children || []);

  children.forEach((child) => {
    if (!child || child === panel) {
      return;
    }

    child.dataset[MODULE_LIBRARY_VIEW_FLAG] = 'hidden';
    child.style.display = 'none';
  });
}

function restoreOtherViews(viewsContainer, panel) {
  const children = Array.from(viewsContainer.children || []);

  children.forEach((child) => {
    if (!child || child === panel) {
      return;
    }

    if (child.dataset[MODULE_LIBRARY_VIEW_FLAG] === 'hidden') {
      delete child.dataset[MODULE_LIBRARY_VIEW_FLAG];
      child.style.removeProperty('display');
    }
  });
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

  if (!panel.dataset.moduleLibraryInitialised) {
    panel.hidden = true;
    panel.setAttribute('aria-hidden', 'true');
    panel.dataset.moduleLibraryInitialised = 'true';
  }

  const moduleListWrapper = panel.querySelector(`#${MODULE_LIST_WRAPPER_ID}`);
  if (moduleListWrapper) {
    moduleListWrapper.setAttribute('role', 'region');
    moduleListWrapper.setAttribute('aria-live', 'polite');
  }
}

export function showModuleLibraryPanel(editor) {
  const viewsContainer = resolveViewsContainer(editor);
  const panel = mountModuleLibraryPanel(editor);

  if (!viewsContainer || !panel) {
    return;
  }

  panel.hidden = false;
  panel.removeAttribute('aria-hidden');
  markOtherViewsHidden(viewsContainer, panel);
}

export function hideModuleLibraryPanel(editor) {
  const viewsContainer = resolveViewsContainer(editor);
  const panel = viewsContainer?.querySelector(`#${PANEL_ID}`);

  if (!viewsContainer || !panel) {
    return;
  }

  panel.hidden = true;
  panel.setAttribute('aria-hidden', 'true');
  restoreOtherViews(viewsContainer, panel);
}

