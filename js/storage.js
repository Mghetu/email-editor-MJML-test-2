// StorageProvider interface and LocalProvider implementation (localStorage with IndexedDB fallback)
const KEY = 'mjml_studio_project_v1';

export const StorageProvider = {
  async save(data) {
    try {
      // data can be project json or a custom object; we persist as-is
      localStorage.setItem(KEY, JSON.stringify(data));
      return { ok: true, where: 'localStorage' };
    } catch (e) {
      if (window.idbKeyval) {
        await idbKeyval.set(KEY, data);
        return { ok: true, where: 'indexedDB' };
      }
      return { ok: false, error: e.message };
    }
  },
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
      if (window.idbKeyval) {
        const v = await idbKeyval.get(KEY);
        if (v) return v;
      }
    } catch (_) {}
    return null;
  },
  async clear() {
    localStorage.removeItem(KEY);
    if (window.idbKeyval) await idbKeyval.del(KEY);
  },
  async export(type, dataStr, filename) {
    const blob = new Blob([dataStr], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },
  async importText(text) {
    return text;
  }
};

export default StorageProvider;
