import {
  css,
  html,
  LitElement,
  SlotMixin,
  ScopedStylesController,
} from '@lion/core';
import { computePosition, offset, flip, shift } from '@floating-ui/dom';

// TODO: [Tutorial Feature] Switching invoker node ref

// TODO: [Tutorial Feature] Switching content template (or Node) --> render to this.dialogNode

// TODO: [Tutorial Feature] A Lit-Element that takes content TemplateResults and invoker reference nodes
// to switch back and forth between different dialog contents that point to different invokers

// TODO: arrow element

// TODO: global positioning

// TODO: properly prefix private/protected/public methods/props

const dialogClosingEvent = new Event('dialog-closing');
const dialogClosedEvent = new Event('dialog-closed');
const dialogOpeningEvent = new Event('dialog-opening');
const dialogOpenedEvent = new Event('dialog-opened');

/**
 *
 * @param {HTMLElement[]} elements
 * @returns {Promise<PromiseSettledResult<Animation>[]>}
 */
function animationsComplete(elements) {
  const elemsAnimationsFinished = elements
    .map((elem) => elem.getAnimations().map((anim) => anim.finished))
    .flat();
  return Promise.allSettled(elemsAnimationsFinished);
}

export class RiotsDialog extends SlotMixin(LitElement) {
  /**
   * @param {import('lit').CSSResult} scope
   * @returns {import('lit').CSSResultGroup}
   */
  static scopedStyles(scope) {
    return [
      css`
        .${scope} dialog {
          /** override user agent styles */
          position: absolute;
          padding: 0;
          margin: 0;
          animation: var(--animation-slide-in-up) forwards;
        }

        .${scope} dialog::backdrop {
          backdrop-filter: blur(5px);
          background: rgba(0, 0, 0, 0.25);
          /** TODO: figure out why transitions don't work in chrome for ::backdrop */
        }
      `,
    ];
  }

  static get properties() {
    return {
      placement: {
        type: String,
        reflect: true,
      },
      opened: {
        type: Boolean,
        reflect: true,
      },
      isModal: {
        type: Boolean,
        reflect: true,
        attribute: 'is-modal',
      },
      closesOnOutsideClick: {
        type: Boolean,
        reflect: true,
        attribute: 'closes-on-outside-click',
      },
    };
  }

  get slots() {
    return {
      dialog: () => html` <dialog @click=${this.lightDismiss}></dialog> `,
    };
  }

  constructor() {
    super();
    this.placement = 'top';
    this.isModal = false;
    this.boundOpen = this.open.bind(this);
    this.__boundOnInsideMouseDown = this.__onInsideMouseDown.bind(this);
    this.__boundOnInsideMouseUp = this.__onInsideMouseUp.bind(this);
    this.__boundOnDocumentMouseUp = this.__onDocumentMouseUp.bind(this);
    this.boundSetLocalPosition = this.setLocalPosition.bind(this);
    this.popoverMargin = 16;
    this.scopedStylesController = new ScopedStylesController(this);
  }

  firstUpdated() {
    this.invokerNode.addEventListener('click', this.boundOpen);
    this.setupMutationObserver();
  }

  updated(changedProperties) {
    if (changedProperties.has('placement') && this.opened) {
      this.setLocalPosition();
    }
    if (changedProperties.has('closesOnOutsideClick') && this.opened) {
      this.setupCloseOnOutsideClick();
    }
  }

  render() {
    return html`
      <slot name="dialog"></slot>
      <slot name="invoker"></slot>
      <slot @slotchange=${this.onContentSlotChange} name="content"></slot>
    `;
  }

  get dialogNode() {
    return this.querySelector('[slot="dialog"]');
  }

  get invokerNode() {
    return this.querySelector('[slot="invoker"]');
  }

  get opened() {
    return this.hasAttribute('opened');
  }

  set opened(val) {
    if (val) {
      this.__open();
    } else {
      this.__close();
    }
  }

  /**
   * With showModal() it's easy, we can just catch click event on the dialog node
   * With show() (not modal) it's harder... :(
   */
  setupCloseOnOutsideClick() {
    if (this.__closeOnOutsideClickIsSet) {
      return;
    }
    this.__addOrRemoveOutsideClickHandlers('add');
  }

  __onInsideMouseDown() {
    this.__wasMouseDownInside = true;
  }

  __onInsideMouseUp() {
    this.__wasMouseUpInside = true;
  }

  __onDocumentMouseUp() {
    setTimeout(() => {
      if (!this.__wasMouseDownInside && !this.__wasMouseUpInside) {
        this.close();
        this.__addOrRemoveOutsideClickHandlers('remove');
      }
      this.__wasMouseDownInside = false;
      this.__wasMouseUpInside = false;
    });
  }

  __addOrRemoveOutsideClickHandlers(phase) {
    this.__wasMouseDownInside = false;
    this.__wasMouseUpInside = false;

    this.dialogNode[`${phase}EventListener`](
      'mousedown',
      this.__boundOnInsideMouseDown,
      true,
    );
    this.dialogNode[`${phase}EventListener`](
      'mouseup',
      this.__boundOnInsideMouseUp,
      true,
    );

    if (this.invokerNode) {
      this.invokerNode[`${phase}EventListener`](
        'mousedown',
        this.__boundOnInsideMouseDown,
        true,
      );
      this.invokerNode[`${phase}EventListener`](
        'mouseup',
        this.__boundOnInsideMouseUp,
        true,
      );
    }
    document.documentElement[`${phase}EventListener`](
      'mouseup',
      this.__boundOnDocumentMouseUp,
      true,
    );
    this.__closeOnOutsideClickIsSet = phase === 'add';
  }

  setupCloseOnEsc() {
    this.__escKeyHandler = (ev) => {
      if (ev.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keyup', this.__escKeyHandler);
  }

  setupMutationObserver() {
    const dialogAttrObserver = new MutationObserver((mutations) => {
      mutations.forEach(async (mutation) => {
        if (mutation.attributeName === 'open') {
          const isOpen = this.dialogNode.hasAttribute('open');
          if (!isOpen && !this.isClosing) {
            this.close();
          }
        }
      });
    });
    dialogAttrObserver.observe(this.dialogNode, {
      attributes: true,
    });
  }

  autoFocusTarget() {
    const focusTarget = this.dialogNode.querySelector('[autofocus]');
    if (focusTarget) {
      focusTarget.focus();
    }
  }

  onContentSlotChange(ev) {
    const [slottable] = /** @type {HTMLSlotElement} */ (
      ev.target
    ).assignedNodes();
    if (slottable) {
      this.dialogNode.appendChild(slottable);
    }
  }

  lightDismiss(ev) {
    if (ev.target.nodeName === 'DIALOG' && this.closesOnOutsideClick) {
      this.dialogNode.close('dismiss');
    }
  }

  open() {
    if (this.opened) {
      return;
    }
    this.setAttribute('opened', '');
  }

  close() {
    if (!this.opened) {
      return;
    }
    this.isClosing = true;
    this.removeAttribute('opened');
  }

  async __open() {
    if (this.isModal) {
      this.dialogNode.showModal();
    } else {
      this.dialogNode.show();
      this.setupCloseOnEsc();
      if (this.closesOnOutsideClick) {
        this.setupCloseOnOutsideClick();
      }
    }
    this.autoFocusTarget();
    this.setLocalPosition();
    window.addEventListener('resize', this.boundSetLocalPosition);
    this.dispatchEvent(dialogOpeningEvent);
    await animationsComplete([this.dialogNode]);
    this.dispatchEvent(dialogOpenedEvent);
  }

  async __close() {
    this.dialogNode.close();
    window.removeEventListener('resize', this.boundSetLocalPosition);
    document.removeEventListener('keyup', this.__escKeyHandler);
    this.dispatchEvent(dialogClosingEvent);
    await animationsComplete([this.dialogNode]);
    this.dispatchEvent(dialogClosedEvent);
    this.isClosing = false;
  }

  /** Using @floating-ui/dom */
  setLocalPosition() {
    computePosition(this.invokerNode, this.dialogNode, {
      placement: this.placement,
      middleware: [offset(16), flip(), shift()], // TODO: allow passing own middleware array
    }).then(({ x, y }) => {
      Object.assign(this.dialogNode.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  }
}
customElements.define('riots-dialog', RiotsDialog);
