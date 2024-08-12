import { html } from 'lit';
import { z } from 'zod';

import type { InlineSpecs } from '../../_common/inline/inline-manager.js';

import {
  type AffineTextAttributes,
  affineInlineSpecsWithoutReference,
} from '../../_common/inline/presets/affine-inline-specs.js';

export const codeBlockInlineSpecs: InlineSpecs<AffineTextAttributes>[] = [
  {
    name: 'code-block-unit',
    schema: z.undefined(),
    match: () => true,
    renderer: ({ delta }) => {
      return html`<affine-code-unit .delta=${delta}></affine-code-unit>`;
    },
  },
  ...affineInlineSpecsWithoutReference,
];
