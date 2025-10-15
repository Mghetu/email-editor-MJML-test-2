import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';

import { DEFAULT_FONT_FAMILY, Theme } from '../js/themes.js';
import { ExampleModules } from '../js/custom-blocks.js';
import { SampleTemplates } from '../js/templates.js';

const FONT_ATTRIBUTE = `font-family="${Theme.fontFamily}"`;

describe('Default font configuration', () => {
  it('Theme uses the shared default font stack', () => {
    assert.equal(Theme.fontFamily, DEFAULT_FONT_FAMILY);
  });

  it('Example modules render with the theme font', () => {
    for (const moduleDef of ExampleModules) {
      assert.ok(
        moduleDef.markup.includes(FONT_ATTRIBUTE),
        `Expected module ${moduleDef.id} to include ${FONT_ATTRIBUTE}`
      );
    }
  });

  it('Sample templates configure mj-all with the theme font', () => {
    for (const template of Object.values(SampleTemplates)) {
      assert.ok(
        template.mjml.includes(`<mj-all font-family="${Theme.fontFamily}" />`),
        `Expected template ${template.name} to apply Theme.fontFamily`
      );
    }
  });

  it('Default starter MJML registers the Aptos font asset', async () => {
    const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
    assert.ok(
      indexHtml.includes('name="Aptos"'),
      'Starter MJML should register Aptos via <mj-font>'
    );
  });
});
