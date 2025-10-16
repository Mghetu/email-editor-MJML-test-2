export function addAptosFont(editor) {
  if (!editor || !editor.StyleManager) {
    return;
  }

  const styleManager = editor.StyleManager;
  const fontProperty = styleManager.getProperty('Typography', 'font-family');

  if (!fontProperty) {
    return;
  }

  const aptosFont = 'Aptos, Calibri, sans-serif';
  const existingList = Array.isArray(fontProperty.get('list'))
    ? [...fontProperty.get('list')]
    : [];

  const hasAptos = existingList.some((item) => {
    const value = typeof item === 'string' ? item : item?.value;
    return typeof value === 'string' && value.toLowerCase() === aptosFont.toLowerCase();
  });

  if (hasAptos) {
    return;
  }

  existingList.push({
    value: aptosFont,
    name: 'Aptos',
  });

  // Updating the list and re-rendering ensures the new option appears immediately
  fontProperty.set('list', existingList);
  styleManager.render();
}
