import type { MenuItem } from '@blocksuite/affine-components/toolbar';

import { isPeekable, peek } from '@blocksuite/affine-components/peek';
import { Bound } from '@blocksuite/global/utils';
import {
  ArrowDownBigBottomIcon,
  ArrowDownBigIcon,
  ArrowUpBigIcon,
  ArrowUpBigTopIcon,
  CenterPeekIcon,
  CopyIcon,
  DeleteIcon,
  DuplicateIcon,
  FrameIcon,
  GroupIcon,
  LinkedPageIcon,
  OpenInNewIcon,
  ResetIcon,
} from '@blocksuite/icons/lit';

import type { AttachmentBlockComponent } from '../../../../attachment-block/attachment-block.js';
import type { BookmarkBlockComponent } from '../../../../bookmark-block/bookmark-block.js';
import type { EmbedFigmaBlockComponent } from '../../../../embed-figma-block/embed-figma-block.js';
import type { EmbedGithubBlockComponent } from '../../../../embed-github-block/embed-github-block.js';
import type { EmbedLoomBlockComponent } from '../../../../embed-loom-block/embed-loom-block.js';
import type { EmbedYoutubeBlockComponent } from '../../../../embed-youtube-block/embed-youtube-block.js';
import type { ImageBlockComponent } from '../../../../image-block/image-block.js';
import type { MoreMenuContext } from './context.js';

import {
  createLinkedDocFromEdgelessElements,
  createLinkedDocFromNote,
  notifyDocCreated,
  promptDocTitle,
} from '../../../../_common/utils/render-linked-doc.js';
import { edgelessElementsBound } from '../../../edgeless/utils/bound-utils.js';
import { duplicate } from '../../../edgeless/utils/clipboard-utils.js';
import { getCloneElements } from '../../../edgeless/utils/clone-utils.js';
import { moveConnectors } from '../../../edgeless/utils/connector.js';
import { deleteElements } from '../../../edgeless/utils/crud.js';

type EmbedLinkBlockComponent =
  | EmbedGithubBlockComponent
  | EmbedFigmaBlockComponent
  | EmbedLoomBlockComponent
  | EmbedYoutubeBlockComponent;

type RefreshableBlockComponent =
  | EmbedLinkBlockComponent
  | ImageBlockComponent
  | AttachmentBlockComponent
  | BookmarkBlockComponent;

export type MoreMenuItemPart = {
  action: () => void;
  disabled?: boolean;
};

export type MoreMenuItem = Omit<MenuItem, 'action' | 'disabled'> & {
  action?: (context: MoreMenuContext) => void | Promise<void>;
  disabled?: boolean | ((context: MoreMenuContext) => boolean);
  showWhile?: (context: MoreMenuContext) => boolean;
  // Generates action at runtime
  generate?: (context: MoreMenuContext) => MoreMenuItemPart | void;
};

export type MoreMenuItemGroup = {
  type: string;
  items: MoreMenuItem[];
  showWhile?: (context: MoreMenuContext) => boolean;
  // // fallback
  // action?: (
  //   menuItem: MoreMenuItemGroup['items'][number],
  //   service: EdgelessRootService,
  //   edgeless: EdgelessRootBlockComponent
  // ) => void;
};

// Section Group: frame & group
export const sectionGroup: MoreMenuItemGroup = {
  type: 'section',
  items: [
    {
      icon: FrameIcon({ width: '20', height: '20' }),
      name: 'Frame section',
      type: 'create-frame',
      action: ({ service, edgeless }) => {
        const frame = service.frame.createFrameOnSelected();
        if (!frame) return;

        service.telemetryService?.track('CanvasElementAdded', {
          control: 'context-menu',
          page: 'whiteboard editor',
          module: 'toolbar',
          segment: 'toolbar',
          type: 'frame',
        });

        edgeless.surface.fitToViewport(Bound.deserialize(frame.xywh));
      },
    },
    {
      icon: GroupIcon({ width: '20', height: '20' }),
      name: 'Group section',
      type: 'create-group',
      action: ({ service }) => {
        service.createGroupFromSelected();
      },
      showWhile: (ctx: MoreMenuContext) => !ctx.hasFrame(),
    },
  ],
};

// Reorder Group
export const reorderGroup: MoreMenuItemGroup = {
  type: 'reorder',
  items: [
    {
      icon: ArrowUpBigTopIcon({ width: '20', height: '20' }),
      name: 'Bring to Front',
      type: 'front',
      action: ({ service }) => {
        service.selection.selectedElements.forEach(el => {
          service.reorderElement(el, 'front');
        });
      },
    },
    {
      icon: ArrowUpBigIcon({ width: '20', height: '20' }),
      name: 'Bring Forward',
      type: 'forward',
      action: ({ service }) => {
        service.selection.selectedElements.forEach(el => {
          service.reorderElement(el, 'forward');
        });
      },
    },
    {
      icon: ArrowDownBigIcon({ width: '20', height: '20' }),
      name: 'Send Backward',
      type: 'backward',
      action: ({ service }) => {
        service.selection.selectedElements.forEach(el => {
          service.reorderElement(el, 'backward');
        });
      },
    },
    {
      icon: ArrowDownBigBottomIcon({ width: '20', height: '20' }),
      name: 'Send to Back',
      type: 'back',
      action: ({ service }) => {
        service.selection.selectedElements.forEach(el => {
          service.reorderElement(el, 'back');
        });
      },
    },
  ],
  showWhile: ctx => !ctx.hasFrame(),
};

// Open Group
export const openGroup: MoreMenuItemGroup = {
  type: 'open',
  items: [
    {
      icon: OpenInNewIcon({ width: '20', height: '20' }),
      name: 'Open this doc',
      type: 'open',
      generate: ctx => {
        const linkedDocBlock = ctx.getLinkedDocBlock();

        if (!linkedDocBlock) return;

        const disabled = linkedDocBlock.pageId === ctx.doc.id;

        return {
          action: () => {
            const blockComponent = ctx.firstBlockComponent;

            if (!blockComponent) return;
            if (!('open' in blockComponent)) return;
            if (typeof blockComponent.open !== 'function') return;

            blockComponent.open();
          },

          disabled,
        };
      },
    },
    {
      icon: CenterPeekIcon({ width: '20', height: '20' }),
      name: 'Open in center peek',
      type: 'center-peek',
      generate: ctx => {
        const valid =
          ctx.isSingle() &&
          !!ctx.firstBlockComponent &&
          isPeekable(ctx.firstBlockComponent);

        if (!valid) return;

        return {
          action: () => {
            if (!ctx.firstBlockComponent) return;

            peek(ctx.firstBlockComponent);
          },
        };
      },
    },
  ],
};

// Clipboard Group
export const clipboardGroup: MoreMenuItemGroup = {
  type: 'clipboard',
  items: [
    {
      icon: CopyIcon({ width: '20', height: '20' }),
      name: 'Copy',
      type: 'copy',
      action: ({ edgeless }) => edgeless.clipboardController.copy(),
    },
    {
      icon: DuplicateIcon({ width: '20', height: '20' }),
      name: 'Duplicate',
      type: 'duplicate',
      action: ({ edgeless, selectedElements }) =>
        duplicate(edgeless, selectedElements),
    },
    {
      icon: ResetIcon({ width: '20', height: '20' }),
      name: 'Reload',
      type: 'reload',
      generate: ctx => {
        if (ctx.hasFrame()) {
          return;
        }

        const blocks = ctx.selection.surfaceSelections
          .map(s => ctx.getBlockComponent(s.blockId))
          .filter(block => !!block)
          .filter(block => ctx.refreshable(block.model));

        if (
          !blocks.length ||
          blocks.length !== ctx.selection.surfaceSelections.length
        ) {
          return;
        }

        return {
          action: () =>
            blocks.forEach(block =>
              (block as RefreshableBlockComponent).refreshData()
            ),
        };
      },
    },
  ],
};

// Conversions Group
export const conversionsGroup: MoreMenuItemGroup = {
  type: 'conversions',
  items: [
    {
      icon: LinkedPageIcon({ width: '20', height: '20' }),
      name: 'Turn into linked doc',
      type: 'turn-into-linked-doc',
      action: async ctx => {
        const { doc, service, surface, host } = ctx;
        const element = ctx.getNoteBlock();
        if (!element) return;

        const title = await promptDocTitle(host);
        if (title === null) return;

        const linkedDoc = createLinkedDocFromNote(doc, element, title);
        // insert linked doc card
        const cardId = service.addBlock(
          'affine:embed-synced-doc',
          {
            xywh: element.xywh,
            style: 'syncedDoc',
            pageId: linkedDoc.id,
            index: element.index,
          },
          surface.model.id
        );
        service.telemetryService?.track('CanvasElementAdded', {
          control: 'context-menu',
          page: 'whiteboard editor',
          module: 'toolbar',
          segment: 'toolbar',
          type: 'embed-synced-doc',
        });
        service.telemetryService?.track('DocCreated', {
          control: 'turn into linked doc',
          page: 'whiteboard editor',
          module: 'format toolbar',
          type: 'embed-linked-doc',
        });
        service.telemetryService?.track('LinkedDocCreated', {
          control: 'turn into linked doc',
          page: 'whiteboard editor',
          module: 'format toolbar',
          type: 'embed-linked-doc',
          other: 'new doc',
        });
        moveConnectors(element.id, cardId, service);
        // delete selected note
        doc.transact(() => {
          doc.deleteBlock(element);
        });
        service.selection.set({
          elements: [cardId],
          editing: false,
        });
      },
      showWhile: ctx => !!ctx.getNoteBlock(),
    },
    {
      icon: LinkedPageIcon({ width: '20', height: '20' }),
      name: 'Create linked doc',
      type: 'create-linked-doc',
      action: async ({ doc, selection, service, surface, host }) => {
        const title = await promptDocTitle(host);
        if (title === null) return;

        const elements = getCloneElements(
          selection.selectedElements,
          service.frame
        );
        const linkedDoc = createLinkedDocFromEdgelessElements(
          host,
          elements,
          title
        );
        // insert linked doc card
        const width = 364;
        const height = 390;
        const bound = edgelessElementsBound(elements);
        const cardId = service.addBlock(
          'affine:embed-linked-doc',
          {
            xywh: `[${bound.center[0] - width / 2}, ${bound.center[1] - height / 2}, ${width}, ${height}]`,
            style: 'vertical',
            pageId: linkedDoc.id,
          },
          surface.model.id
        );
        service.telemetryService?.track('CanvasElementAdded', {
          control: 'context-menu',
          page: 'whiteboard editor',
          module: 'toolbar',
          segment: 'toolbar',
          type: 'embed-linked-doc',
        });
        service.telemetryService?.track('DocCreated', {
          control: 'create linked doc',
          page: 'whiteboard editor',
          module: 'format toolbar',
          type: 'embed-linked-doc',
        });
        service.telemetryService?.track('LinkedDocCreated', {
          control: 'create linked doc',
          page: 'whiteboard editor',
          module: 'format toolbar',
          type: 'embed-linked-doc',
          other: 'new doc',
        });
        // delete selected elements
        doc.transact(() => {
          deleteElements(surface, elements);
        });
        selection.set({
          elements: [cardId],
          editing: false,
        });

        notifyDocCreated(host, doc);
      },
      showWhile: ctx => !(ctx.getLinkedDocBlock() || ctx.getNoteBlock()),
    },
  ],
};

// Delete Group
export const deleteGroup: MoreMenuItemGroup = {
  type: 'delete',
  items: [
    {
      icon: DeleteIcon({ width: '20', height: '20' }),
      name: 'Delete',
      type: 'delete',
      action: ({ doc, selection, selectedElements, surface }) => {
        doc.captureSync();
        deleteElements(surface, selectedElements);

        selection.set({
          elements: [],
          editing: false,
        });
      },
    },
  ],
};
