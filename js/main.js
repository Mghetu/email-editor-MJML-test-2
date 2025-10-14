import initEditor from './editor.js';

window.addEventListener('load', () => {
  initEditor();
});

export * from './compile.js';
export * from './storage.js';
export * from './imageStore.js';
export * from './themes.js';
export * from './templates.js';
export * from './modulePersistence.js';
