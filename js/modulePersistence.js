const MODULES_DB_NAME = 'mjmlBuilder';
const MODULES_STORE_NAME = 'modules';
const MODULES_KEY = 'mjmlModules';
const MODULES_FALLBACK_KEY = 'mjmlModulesFallback';

const DEFAULT_CATEGORY = 'Custom Modules';
const DEFAULT_VERSION = 1;
export const MODULES_CHANGED_EVENT = 'modules:changed';

function toIsoString(value, fallback) {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  if (fallback) {
    const fallbackDate = new Date(fallback);
    if (!Number.isNaN(fallbackDate.getTime())) {
      return fallbackDate.toISOString();
    }
  }

  return new Date().toISOString();
}

function toTrimmedString(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value).trim();
}

function sanitizeModuleFields(moduleObj = {}) {
  const id = toTrimmedString(moduleObj.id);
  const label = toTrimmedString(moduleObj.label);
  const markup = toTrimmedString(moduleObj.markup);

  if (!id || !label || !markup) {
    throw new Error('Module definitions require id, label, and markup.');
  }

  const categoryValue = toTrimmedString(moduleObj.category);
  const sanitized = {
    id,
    label,
    category: categoryValue || DEFAULT_CATEGORY,
    markup
  };

  const thumbnailValue = toTrimmedString(moduleObj.thumbnail);
  if (thumbnailValue) {
    sanitized.thumbnail = thumbnailValue;
  }

  return sanitized;
}

function sanitizeMetadata(metadata, { defaultSavedAt, defaultUpdatedAt } = {}) {
  const base = metadata && typeof metadata === 'object' ? { ...metadata } : {};

  if (defaultSavedAt || base.savedAt) {
    base.savedAt = toIsoString(base.savedAt, defaultSavedAt);
  }

  if (defaultUpdatedAt || base.updatedAt) {
    base.updatedAt = toIsoString(
      base.updatedAt,
      defaultUpdatedAt || base.savedAt || defaultSavedAt
    );
  }

  base.source = base.source || 'user';

  return base;
}

function createHistorySnapshot(module) {
  if (!module) {
    return null;
  }

  try {
    const baseFields = sanitizeModuleFields(module);
    const updatedAt = toIsoString(
      module.updatedAt,
      module.metadata?.updatedAt || module.metadata?.savedAt
    );
    const metadata = sanitizeMetadata(module.metadata, {
      defaultSavedAt: module.metadata?.savedAt || updatedAt,
      defaultUpdatedAt: updatedAt
    });

    return {
      ...baseFields,
      metadata,
      version:
        Number.isInteger(module.version) && module.version > 0
          ? module.version
          : DEFAULT_VERSION,
      updatedAt
    };
  } catch (error) {
    console.warn(
      `[ModulePersistence] Unable to snapshot module ${module?.id || ''}`,
      error
    );
    return null;
  }
}

function normalizeHistory(historyEntries, moduleSnapshot) {
  if (!Array.isArray(historyEntries)) {
    return [];
  }

  return historyEntries
    .map((entry) => {
      if (!entry) {
        return null;
      }

      try {
        const baseFields = sanitizeModuleFields({
          ...moduleSnapshot,
          ...entry,
          id: moduleSnapshot.id
        });
        const updatedAt = toIsoString(
          entry.updatedAt,
          entry.metadata?.updatedAt || moduleSnapshot.updatedAt
        );
        const metadata = sanitizeMetadata(
          { ...moduleSnapshot.metadata, ...(entry.metadata || {}) },
          {
            defaultSavedAt: moduleSnapshot.metadata?.savedAt,
            defaultUpdatedAt: updatedAt
          }
        );

        return {
          ...baseFields,
          metadata,
          version:
            Number.isInteger(entry.version) && entry.version > 0
              ? entry.version
              : DEFAULT_VERSION,
          updatedAt
        };
      } catch (error) {
        console.warn(
          `[ModulePersistence] Ignoring invalid history entry for module ${moduleSnapshot.id}`,
          error
        );
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeModuleRecord(rawModule) {
  if (!rawModule) {
    return null;
  }

  try {
    const baseFields = sanitizeModuleFields(rawModule);
    const now = new Date().toISOString();
    const updatedAt = toIsoString(
      rawModule.updatedAt,
      rawModule.metadata?.updatedAt || rawModule.metadata?.savedAt || now
    );
    const metadata = sanitizeMetadata(rawModule.metadata, {
      defaultSavedAt: rawModule.metadata?.savedAt || updatedAt,
      defaultUpdatedAt: updatedAt
    });

    return {
      ...baseFields,
      metadata,
      version:
        Number.isInteger(rawModule.version) && rawModule.version > 0
          ? rawModule.version
          : DEFAULT_VERSION,
      updatedAt,
      history: normalizeHistory(rawModule.history, {
        ...baseFields,
        metadata,
        updatedAt
      })
    };
  } catch (error) {
    console.warn('[ModulePersistence] Ignoring invalid module definition while loading.', error);
    return null;
  }
}

function normalizeModulesCollection(modules) {
  if (!Array.isArray(modules)) {
    return [];
  }

  return modules.map(normalizeModuleRecord).filter(Boolean);
}

function ensureWindow() {
  if (typeof window === 'undefined') {
    throw new Error('Custom block persistence requires a browser environment.');
  }
  return window;
}

function openModulesDb() {
  const { indexedDB } = ensureWindow();

  if (!indexedDB) {
    return Promise.reject(
      new Error('IndexedDB is not available in this environment.')
    );
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MODULES_DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(MODULES_STORE_NAME)) {
        db.createObjectStore(MODULES_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open modules database.'));
  });
}

function broadcastModulesChanged(modules) {
  try {
    const win = ensureWindow();
    const event = new CustomEvent(MODULES_CHANGED_EVENT, {
      detail: { modules: Array.isArray(modules) ? modules : [] }
    });
    win.dispatchEvent(event);
  } catch (error) {
    console.warn('[ModulePersistence] Failed to broadcast module changes', error);
  }
}

function readFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(MODULES_FALLBACK_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('[ModulePersistence] Failed to read from localStorage', error);
    return [];
  }
}

function writeToLocalStorage(modules) {
  try {
    window.localStorage.setItem(MODULES_FALLBACK_KEY, JSON.stringify(modules));
    return modules;
  } catch (error) {
    console.error('[ModulePersistence] Failed to write to localStorage', error);
    throw error;
  }
}

function persistToIndexedDb(modules) {
  return openModulesDb().then((db) =>
    new Promise((resolve, reject) => {
      const transaction = db.transaction(MODULES_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(MODULES_STORE_NAME);
      const request = store.put(modules, MODULES_KEY);

      transaction.oncomplete = () => resolve(modules);
      transaction.onerror = () => reject(transaction.error || request.error);
      request.onerror = () => reject(request.error);
    })
  );
}

async function persistModules(modules) {
  let persistedModules = modules;

  try {
    await persistToIndexedDb(modules);
  } catch (error) {
    console.warn('[ModulePersistence] Falling back to localStorage.', error);
    persistedModules = writeToLocalStorage(modules);
  }

  broadcastModulesChanged(persistedModules);
  return persistedModules;
}

function fetchFromIndexedDb() {
  return openModulesDb().then((db) =>
    new Promise((resolve, reject) => {
      const transaction = db.transaction(MODULES_STORE_NAME, 'readonly');
      const store = transaction.objectStore(MODULES_STORE_NAME);
      const request = store.get(MODULES_KEY);

      request.onsuccess = () => {
        const result = request.result;
        resolve(Array.isArray(result) ? result : []);
      };

      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    })
  );
}

export async function loadBlocks() {
  try {
    const modules = await fetchFromIndexedDb();
    return normalizeModulesCollection(modules);
  } catch (error) {
    console.warn('[ModulePersistence] Falling back to localStorage for load.', error);
    return normalizeModulesCollection(readFromLocalStorage());
  }
}

export async function saveBlock(moduleObj) {
  const existingModules = await loadBlocks();
  const existingIndex = existingModules.findIndex(
    (module) => module && module.id === moduleObj.id
  );
  const existingModule = existingIndex >= 0 ? existingModules[existingIndex] : null;
  const now = new Date().toISOString();
  const sanitizedFields = sanitizeModuleFields(
    existingModule ? { ...existingModule, ...moduleObj } : moduleObj
  );
  const metadata = sanitizeMetadata(
    existingModule
      ? { ...existingModule.metadata, ...(moduleObj.metadata || {}) }
      : moduleObj.metadata,
    {
      defaultSavedAt: existingModule?.metadata?.savedAt || now,
      defaultUpdatedAt: now
    }
  );

  let modules;

  if (existingModule) {
    const history = [
      createHistorySnapshot(existingModule),
      ...(existingModule.history || [])
    ].filter(Boolean);

    const updatedModule = {
      ...existingModule,
      ...sanitizedFields,
      metadata,
      version:
        (existingModule.version && existingModule.version > 0
          ? existingModule.version
          : DEFAULT_VERSION) + 1,
      updatedAt: now,
      history
    };

    modules = existingModules.slice();
    modules[existingIndex] = updatedModule;
  } else {
    const newModule = {
      ...sanitizedFields,
      metadata,
      version: DEFAULT_VERSION,
      updatedAt: now,
      history: []
    };

    modules = [...existingModules, newModule];
  }

  return persistModules(modules);
}

export async function updateBlock(moduleObj) {
  const existingModules = await loadBlocks();
  const existingIndex = existingModules.findIndex(
    (module) => module && module.id === moduleObj.id
  );
  const existingModule = existingIndex >= 0 ? existingModules[existingIndex] : null;

  if (!existingModule) {
    throw new Error('Cannot update module: definition not found.');
  }

  const now = new Date().toISOString();
  const sanitizedFields = sanitizeModuleFields({ ...existingModule, ...moduleObj });
  const metadata = sanitizeMetadata(
    { ...existingModule.metadata, ...(moduleObj.metadata || {}) },
    {
      defaultSavedAt: existingModule.metadata?.savedAt || now,
      defaultUpdatedAt: now
    }
  );
  const history = [
    createHistorySnapshot(existingModule),
    ...(existingModule.history || [])
  ].filter(Boolean);

  const updatedModule = {
    ...existingModule,
    ...sanitizedFields,
    metadata,
    version:
      (existingModule.version && existingModule.version > 0
        ? existingModule.version
        : DEFAULT_VERSION) + 1,
    updatedAt: now,
    history
  };

  const modules = existingModules.slice();
  modules[existingIndex] = updatedModule;

  return persistModules(modules);
}

export async function deleteBlock(moduleId) {
  if (!moduleId) {
    throw new Error('Cannot delete module without an identifier.');
  }

  const existingModules = await loadBlocks();
  const modules = existingModules.filter((module) => module && module.id !== moduleId);

  if (modules.length === existingModules.length) {
    throw new Error('Module not found.');
  }

  return persistModules(modules);
}

export default {
  saveBlock,
  loadBlocks,
  updateBlock,
  deleteBlock
};
