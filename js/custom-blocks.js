const DEFAULT_CATEGORY = 'Premade Modules';

export const ExampleModules = [
  {
    id: 'premade-hero-banner',
    label: 'Hero Banner',
    category: 'Marketing',
    markup: `
<mj-section background-color="#ffffff" padding="24px 16px">
  <mj-column>
    <mj-image width="120px" src="https://via.placeholder.com/240x80?text=Logo" alt="Company Logo" />
    <mj-text font-size="24px" font-weight="700" padding-top="16px">Level up your workflow</mj-text>
    <mj-text color="#4b5563" padding-bottom="16px">Introduce your product benefits with a concise hero block that keeps things readable on any device.</mj-text>
    <mj-button background-color="#4338ca" color="#ffffff" href="https://example.com">Get started</mj-button>
  </mj-column>
</mj-section>
`.trim(),
    thumbnail: 'https://via.placeholder.com/140x90?text=Hero',
    metadata: {
      description: 'Pre-styled hero banner with button and supporting text.'
    }
  },
  {
    id: 'premade-feature-columns',
    label: 'Feature Columns',
    category: 'Marketing',
    markup: `
<mj-section background-color="#f3f4f6" padding="24px 16px">
  <mj-column>
    <mj-image width="64px" src="https://via.placeholder.com/128?text=A" alt="Feature A" />
    <mj-text font-size="18px" font-weight="600" padding-top="12px">Feature One</mj-text>
    <mj-text color="#4b5563">Explain the first key benefit of your offering in just a couple sentences.</mj-text>
  </mj-column>
  <mj-column>
    <mj-image width="64px" src="https://via.placeholder.com/128?text=B" alt="Feature B" />
    <mj-text font-size="18px" font-weight="600" padding-top="12px">Feature Two</mj-text>
    <mj-text color="#4b5563">Highlight another capability or differentiator that matters to your audience.</mj-text>
  </mj-column>
  <mj-column>
    <mj-image width="64px" src="https://via.placeholder.com/128?text=C" alt="Feature C" />
    <mj-text font-size="18px" font-weight="600" padding-top="12px">Feature Three</mj-text>
    <mj-text color="#4b5563">Round it out with a final benefit that reinforces your core value.</mj-text>
  </mj-column>
</mj-section>
`.trim(),
    thumbnail: 'https://via.placeholder.com/140x90?text=Columns',
    metadata: {
      description: 'Three-column feature summary with icons and supporting copy.'
    }
  }
];

const createMediaPreview = (thumbnail, label) => {
  if (!thumbnail) {
    return '';
  }

  return `\n    <div style="display:flex;align-items:center;justify-content:center;height:60px;">\n      <img src="${thumbnail}" alt="${label} preview" style="max-width:100%;max-height:60px;"/>\n    </div>\n  `;
};

const normalizeModules = (modules = []) =>
  modules.filter(Boolean).map((moduleDefinition) => {
    const {
      id,
      label,
      category = DEFAULT_CATEGORY,
      markup,
      thumbnail,
      metadata = {}
    } = moduleDefinition;

    if (!id || !label || !markup) {
      throw new Error('Module definitions require at least an id, label, and markup.');
    }

    return {
      id,
      label,
      category,
      markup,
      thumbnail,
      metadata
    };
  });

const addModuleToBlockManager = (blockManager, moduleDefinition) => {
  const { id, label, category, markup, thumbnail, metadata } = moduleDefinition;

  if (blockManager.get(id)) {
    blockManager.remove(id);
  }

  blockManager.add(id, {
    label,
    category,
    content: markup,
    media: createMediaPreview(thumbnail, label),
    metadata
  });
};

export function removeModuleFromBlockManager(editor, moduleId) {
  if (!editor || !editor.BlockManager || !moduleId) {
    return;
  }

  const blockManager = editor.BlockManager;
  if (blockManager.get(moduleId)) {
    blockManager.remove(moduleId);
  }
}

export default function addCustomBlocks(editor, modules = ExampleModules) {
  if (!editor || !editor.BlockManager) {
    throw new Error('A valid GrapesJS editor instance with a BlockManager is required.');
  }

  const blockManager = editor.BlockManager;
  const normalizedModules = normalizeModules(modules);

  normalizedModules.forEach((moduleDefinition) =>
    addModuleToBlockManager(blockManager, moduleDefinition)
  );
}
