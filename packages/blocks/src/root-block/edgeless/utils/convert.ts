import { deserializeXYWH } from '@blocksuite/global/utils';

import type { BlockElementModel } from '../edgeless-block-model.js';

export function xywhArrayToObject(element: BlockElementModel) {
  const [x, y, w, h] = deserializeXYWH(element.xywh);
  return { x, y, w, h };
}
