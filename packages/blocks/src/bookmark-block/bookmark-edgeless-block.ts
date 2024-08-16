import { toGfxBlockComponent } from '@blocksuite/block-std';
import { customElement } from 'lit/decorators.js';

import { BookmarkBlockComponent } from './bookmark-block.js';

@customElement('affine-edgeless-bookmark')
export class BookmarkEdgelessBlockComponent extends toGfxBlockComponent(
  BookmarkBlockComponent
) {
  override rootServiceFlavour: string = 'affine:page';
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-edgeless-bookmark': BookmarkEdgelessBlockComponent;
  }
}
