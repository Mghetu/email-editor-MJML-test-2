import { jest } from '@jest/globals';

const exportMock = jest.fn();
const showToastMock = jest.fn();

await jest.unstable_mockModule('./js/storage.js', () => ({
  default: {
    export: exportMock,
  },
}));

await jest.unstable_mockModule('./js/toast.js', () => ({
  showToast: showToastMock,
}));

const { compileMJML, downloadHtml, downloadMjml } = await import('./js/compile.js');

describe('compileMJML', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.window = {};
  });

  afterEach(() => {
    delete global.window;
  });

  test('throws when MJML runtime is missing', async () => {
    await expect(compileMJML('<mjml></mjml>')).rejects.toThrow(
      'The MJML runtime is not available'
    );
  });

  test('throws when MJML input is empty', async () => {
    await expect(compileMJML('   ')).rejects.toThrow('Empty MJML');
  });

  test('returns HTML and skips error toast on success', async () => {
    const expectedHtml = '<html>content</html>';
    global.window.mjml = jest.fn(() => ({ html: expectedHtml, errors: [] }));

    const result = await compileMJML('<mjml></mjml>');

    expect(result).toBe(expectedHtml);
    expect(global.window.mjml).toHaveBeenCalledTimes(1);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  test('shows an error toast and rethrows when compilation fails', async () => {
    const error = new Error('Compile failure');
    global.window.mjml = jest.fn(() => {
      throw error;
    });

    await expect(compileMJML('<mjml></mjml>')).rejects.toThrow(error);

    expect(showToastMock).toHaveBeenCalledWith({
      id: 'compile-error-toast',
      message: error.message,
      variant: 'error',
      duration: 5000,
      role: 'alert',
    });
  });
});

describe('download helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('downloadHtml exports HTML with the correct MIME type', async () => {
    const html = '<html></html>';

    await downloadHtml(html, 'custom.html');

    expect(exportMock).toHaveBeenCalledWith('text/html;charset=utf-8', html, 'custom.html');
  });

  test('downloadMjml exports MJML with the correct MIME type', async () => {
    const mjml = '<mjml></mjml>';

    await downloadMjml(mjml, 'custom.mjml');

    expect(exportMock).toHaveBeenCalledWith('application/xml', mjml, 'custom.mjml');
  });
});
