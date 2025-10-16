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

export function addAptosFont(editor) {
  if (!editor || !editor.StyleManager) {
    return;
  }

  const styleManager = editor.StyleManager;
  const fontProperty = findFontFamilyProperty(styleManager);

  if (!fontProperty) {
    return;
  }

  const currentList = fontProperty.get('list');
  const existingList = Array.isArray(currentList) ? [...currentList] : [];
  const aptosNormalised = normaliseFontValue(APTOS_FONT_VALUE);

  const hasAptos = existingList.some((item) => {
    const value = typeof item === 'string' ? item : item?.value;
    return normaliseFontValue(value) === aptosNormalised;
  });

  if (hasAptos) {
    return;
  }

  const updatedList = existingList.concat({
    value: APTOS_FONT_VALUE,
    name: APTOS_FONT_LABEL,
  });

  // Updating the property triggers GrapesJS to refresh the select options on render.
  fontProperty.set('list', updatedList);
  if (typeof styleManager.render === 'function') {
    styleManager.render();
  }
}
