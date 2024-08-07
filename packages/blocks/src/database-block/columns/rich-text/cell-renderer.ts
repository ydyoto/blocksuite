import { ShadowlessElement, WithDisposable } from '@blocksuite/block-std';
import { IS_MAC } from '@blocksuite/global/env';
import { assertExists } from '@blocksuite/global/utils';
import { Text } from '@blocksuite/store';
import { type PropertyValues, css, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { html } from 'lit/static-html.js';

import type { RichText } from '../../../_common/components/index.js';
import type {
  AffineInlineEditor,
  AffineTextAttributes,
} from '../../../_common/inline/presets/affine-inline-specs.js';
import type { DatabaseBlockComponent } from '../../database-block.js';

import { createPopup } from '../../../_common/components/index.js';
import { HostContextKey } from '../../context/host-context.js';
import { BaseCellRenderer } from '../../data-view/column/base-cell.js';
import { createFromBaseCellRenderer } from '../../data-view/column/renderer.js';
import { createIcon } from '../../data-view/utils/uni-icon.js';
import { richTextColumnModelConfig } from './define.js';

function toggleStyle(
  inlineEditor: AffineInlineEditor,
  attrs: AffineTextAttributes
): void {
  const inlineRange = inlineEditor.getInlineRange();
  if (!inlineRange) return;

  const root = inlineEditor.rootElement;
  if (!root) {
    return;
  }

  const deltas = inlineEditor.getDeltasByInlineRange(inlineRange);
  let oldAttributes: AffineTextAttributes = {};

  for (const [delta] of deltas) {
    const attributes = delta.attributes;

    if (!attributes) {
      continue;
    }

    oldAttributes = { ...attributes };
  }

  const newAttributes = Object.fromEntries(
    Object.entries(attrs).map(([k, v]) => {
      if (
        typeof v === 'boolean' &&
        v === (oldAttributes as Record<string, unknown>)[k]
      ) {
        return [k, !v];
      } else {
        return [k, v];
      }
    })
  );

  inlineEditor.formatText(inlineRange, newAttributes, {
    mode: 'merge',
  });
  root.blur();

  inlineEditor.syncInlineRange();
}

@customElement('affine-database-rich-text-cell')
export class RichTextCell extends BaseCellRenderer<Text> {
  static override styles = css`
    affine-database-rich-text-cell {
      display: flex;
      align-items: center;
      width: 100%;
      user-select: none;
    }

    .affine-database-rich-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      width: 100%;
      height: 100%;
      outline: none;
      font-size: var(--data-view-cell-text-size);
      line-height: var(--data-view-cell-text-line-height);
      word-break: break-all;
    }

    .affine-database-rich-text v-line {
      height: 100%;
      width: 100%;
    }

    .affine-database-rich-text v-line > div {
      flex-grow: 1;
    }
  `;

  override render() {
    if (!this.service) return nothing;
    if (!this.value || !(this.value instanceof Text)) {
      return html`<div class="affine-database-rich-text"></div>`;
    }
    return keyed(
      this.value,
      html`<rich-text
        .yText=${this.value}
        .attributesSchema=${this.attributesSchema}
        .attributeRenderer=${this.attributeRenderer}
        .embedChecker=${this.inlineManager?.embedChecker}
        .markdownShortcutHandler=${this.inlineManager?.markdownShortcutHandler}
        .readonly=${true}
        class="affine-database-rich-text inline-editor"
      ></rich-text>`
    );
  }

  get attributeRenderer() {
    return this.inlineManager?.getRenderer();
  }

  get attributesSchema() {
    return this.inlineManager?.getSchema();
  }

  get inlineEditor() {
    assertExists(this._richTextElement);
    const inlineEditor = this._richTextElement.inlineEditor;
    assertExists(inlineEditor);
    return inlineEditor;
  }

  get inlineManager() {
    return this.service?.inlineManager;
  }

  get service() {
    return this.view
      .getContext(HostContextKey)
      ?.std.spec.getService('affine:database');
  }

  get topContenteditableElement() {
    const databaseBlock =
      this.closest<DatabaseBlockComponent>('affine-database');
    return databaseBlock?.topContenteditableElement;
  }

  @query('rich-text')
  private accessor _richTextElement: RichText | null = null;
}

@customElement('affine-database-rich-text-cell-editing')
export class RichTextCellEditing extends BaseCellRenderer<Text> {
  _cancel: (() => void) | null = null;

  static override styles = css`
    affine-database-rich-text-cell-editing {
      display: flex;
      align-items: center;
      width: 100%;
      min-width: 1px;
      cursor: text;
    }

    .affine-database-rich-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      width: 100%;
      height: 100%;
      outline: none;
    }

    .affine-database-rich-text v-line {
      height: 100%;
      width: 100%;
    }

    .affine-database-rich-text v-line > div {
      flex-grow: 1;
    }
  `;

  override firstUpdated() {
    this.openRichTextPopup();
  }

  override onExitEditMode() {
    super.onExitEditMode();
    this._cancel?.();
    this._cancel = null;
  }

  openRichTextPopup() {
    const richTextPopup = new RichTextPopup();
    richTextPopup.cell = this;
    this._cancel = createPopup(this, richTextPopup);
  }

  override render() {
    return null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-rich-text-cell-editing': RichTextCellEditing;
  }
}

@customElement('affine-database-rich-text-popup')
class RichTextPopup extends WithDisposable(ShadowlessElement) {
  private _handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      if (event.key === 'Tab') {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
    }

    if (event.key === 'Enter' && !event.isComposing) {
      if (event.shiftKey) {
        // soft enter
        this._onSoftEnter();
      } else {
        // exit editing
        console.log('exit');
        this.cell.selectCurrentCell(false);
      }
      event.preventDefault();
      return;
    }

    const inlineEditor = this.inlineEditor;

    switch (event.key) {
      // bold ctrl+b
      case 'B':
      case 'b':
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          toggleStyle(this.inlineEditor, { bold: true });
        }
        break;
      // italic ctrl+i
      case 'I':
      case 'i':
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          toggleStyle(this.inlineEditor, { italic: true });
        }
        break;
      // underline ctrl+u
      case 'U':
      case 'u':
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          toggleStyle(this.inlineEditor, { underline: true });
        }
        break;
      // strikethrough ctrl+shift+s
      case 'S':
      case 's':
        if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
          event.preventDefault();
          toggleStyle(inlineEditor, { strike: true });
        }
        break;
      // inline code ctrl+shift+e
      case 'E':
      case 'e':
        if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
          event.preventDefault();
          toggleStyle(inlineEditor, { code: true });
        }
        break;
      default:
        break;
    }
  };

  private _initYText = (text?: string) => {
    const yText = new Text(text);
    this.cell.onChange(yText);
  };

  private _onSoftEnter = () => {
    if (this.cell.value && this.inlineEditor) {
      const inlineRange = this.inlineEditor.getInlineRange();
      assertExists(inlineRange);

      const text = new Text(this.inlineEditor.yText);
      text.replace(inlineRange.index, inlineRange.length, '\n');
      this.inlineEditor.setInlineRange({
        index: inlineRange.index + 1,
        length: 0,
      });
    }
  };

  static override styles = css`
    affine-database-rich-text-popup {
      position: absolute;
      border: 1px solid beige;
      background-color: #47caff;
    }

    .affine-database-rich-text {
      display: flex;
      flex-direction: column;
      justify-content: center;
      width: 100%;
      height: 100%;
      outline: none;
    }

    .affine-database-rich-text v-line {
      align-items: center;
      height: 100%;
      width: 100%;
    }

    .affine-database-rich-text v-line > div {
      flex-grow: 1;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();

    if (!this.cell.value || typeof this.cell.value === 'string') {
      this._initYText(this.cell.value);
    }

    const selectAll = (e: KeyboardEvent) => {
      if (e.key === 'a' && (IS_MAC ? e.metaKey : e.ctrlKey)) {
        e.stopPropagation();
        e.preventDefault();
        this.inlineEditor.selectAll();
      }
    };
    this.disposables.addFromEvent(this, 'keydown', selectAll);
  }

  protected override firstUpdated(_changedProperties: PropertyValues) {
    super.firstUpdated(_changedProperties);
    this._richTextElement?.updateComplete
      .then(() => {
        this.disposables.add(
          this.inlineEditor.slots.keydown.on(this._handleKeyDown)
        );

        this.inlineEditor.focusEnd();
      })
      .catch(console.error);
    this.style.width = `${this.cell.getBoundingClientRect().width}px`;
  }

  override render() {
    if (!this.service) return nothing;
    return html`<rich-text
      .yText=${this.cell.value}
      .attributesSchema=${this.attributesSchema}
      .attributeRenderer=${this.attributeRenderer}
      .embedChecker=${this.inlineManager?.embedChecker}
      .markdownShortcutHandler=${this.inlineManager?.markdownShortcutHandler}
      class="affine-database-rich-text inline-editor"
    ></rich-text>`;
  }

  get attributeRenderer() {
    return this.inlineManager?.getRenderer();
  }

  get attributesSchema() {
    return this.inlineManager?.getSchema();
  }

  get inlineEditor() {
    assertExists(this._richTextElement);
    const inlineEditor = this._richTextElement.inlineEditor;
    assertExists(inlineEditor);
    return inlineEditor;
  }

  get inlineManager() {
    return this.service?.inlineManager;
  }

  get service() {
    return this.cell.view
      .getContext(HostContextKey)
      ?.std.spec.getService('affine:database');
  }

  @query('rich-text')
  private accessor _richTextElement: RichText | null = null;

  @property({ attribute: false })
  accessor cell!: RichTextCellEditing;
}

export const richTextColumnConfig = richTextColumnModelConfig.renderConfig({
  icon: createIcon('TextIcon'),

  cellRenderer: {
    view: createFromBaseCellRenderer(RichTextCell),
    edit: createFromBaseCellRenderer(RichTextCellEditing),
  },
});
