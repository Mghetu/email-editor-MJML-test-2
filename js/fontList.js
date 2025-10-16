const APTOS_FONT_LABEL = 'Aptos';
const APTOS_FONT_VALUE = 'Aptos, Calibri, sans-serif';

function toCollectionArray(collection) {
  if (!collection) {
    return [];
  }

  if (Array.isArray(collection)) {
    return collection;
  }

  if (typeof collection.each === 'function') {
    const items = [];
    collection.each((item) => items.push(item));
    return items;
  }

  if (typeof collection.forEach === 'function') {
    const items = [];
    collection.forEach((item) => items.push(item));
    return items;
  }

  if (Array.isArray(collection.models)) {
    return collection.models;
  }

  return [];
}

function findFontFamilyProperty(styleManager) {
  if (!styleManager) {
    return null;
  }

  const getPropertyFn =
    typeof styleManager.getProperty === 'function'
      ? styleManager.getProperty.bind(styleManager)
      : null;

  const sectorsCollection =
    typeof styleManager.getSectors === 'function' ? styleManager.getSectors() : null;
  const sectors = toCollectionArray(sectorsCollection);

  for (const sector of sectors) {
    if (!sector) {
      continue;
    }

    const sectorId =
      typeof sector.getId === 'function'
        ? sector.getId()
        : typeof sector.get === 'function'
        ? sector.get('id') || sector.get('name')
        : sector.id || sector.name;

    if (sectorId && getPropertyFn) {
      const propertyFromSector = getPropertyFn(sectorId, 'font-family');
      if (propertyFromSector) {
        return propertyFromSector;
      }
    }

    const propertiesCollection =
      typeof sector.getProperties === 'function'
        ? sector.getProperties()
        : typeof sector.get === 'function'
        ? sector.get('properties')
        : sector.properties;
    const properties = toCollectionArray(propertiesCollection);

    for (const property of properties) {
      if (!property) {
        continue;
      }

      const propertyId =
        typeof property.getId === 'function'
          ? property.getId()
          : typeof property.get === 'function'
          ? property.get('id') || property.get('name')
          : property.id || property.name;
      const propertyName =
        typeof property.get === 'function'
          ? property.get('property') || property.get('name') || property.get('id')
          : property.property || property.name || propertyId;

      if (propertyId === 'font-family' || propertyName === 'font-family') {
        return property;
      }
    }
  }

  return null;
}

function normaliseFontValue(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, '').toLowerCase() : '';
}

function getOptionsFromProperty(fontProperty) {
  if (!fontProperty) {
    return { items: [], sourceKey: 'list', existingKeys: [] };
  }

  const keysToCheck = ['list', 'options', 'values'];
  const existingKeys = [];

  for (const key of keysToCheck) {
    const value = fontProperty.get(key);
    if (Array.isArray(value) && value.length) {
      existingKeys.push(key);
    }
  }

  const sourceKey = existingKeys[0] || 'list';
  const sourceItems = Array.isArray(fontProperty.get(sourceKey))
    ? [...fontProperty.get(sourceKey)]
    : [];

  return { items: sourceItems, sourceKey, existingKeys };
}

function setOptionsOnProperty(fontProperty, options, sourceKey, existingKeys) {
  if (!fontProperty) {
    return;
  }

  const keysToUpdate = new Set(existingKeys && existingKeys.length ? existingKeys : [sourceKey]);

  // Always keep the `list` key in sync for backwards compatibility.
  keysToUpdate.add('list');

  for (const key of keysToUpdate) {
    fontProperty.set(key, options);
  }
}

export function addAptosFont(editor) {
  if (!editor || !editor.StyleManager) {
    return;
  }

  const styleManager = editor.StyleManager;
  const fontProperty = findFontFamilyProperty(styleManager);

  if (!fontProperty) {
    return;
  }

  const {
    items: existingList,
    sourceKey: optionsKey,
    existingKeys,
  } = getOptionsFromProperty(fontProperty);
  const aptosNormalised = normaliseFontValue(APTOS_FONT_VALUE);

  const hasAptos = existingList.some((item) => {
    const value = typeof item === 'string' ? item : item?.value;
    return normaliseFontValue(value) === aptosNormalised;
  });

  if (hasAptos) {
    return;
  }

  const containsObjectEntries = existingList.some((item) => item && typeof item === 'object');
  const aptosEntry = containsObjectEntries
    ? { value: APTOS_FONT_VALUE, name: APTOS_FONT_LABEL }
    : APTOS_FONT_VALUE;

  const updatedList = existingList.concat(aptosEntry);

  // Updating the property triggers GrapesJS to refresh the select options on render.
  setOptionsOnProperty(fontProperty, updatedList, optionsKey, existingKeys);
  if (typeof styleManager.render === 'function') {
    styleManager.render();
  }
}
