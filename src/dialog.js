import { css, html, LitElement, render } from 'lit';
import { isTemplateResult } from 'lit/directive-helpers.js';
import { SlotMixin, ScopedStylesController } from '@lion/core';
import {
  computePosition,
  offset,
  flip,
  shift,
  arrow,
  autoUpdate,
} from '@floating-ui/dom';

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
    .map(elem => elem.getAnimations().map(anim => anim.finished))
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
          z-index: 1;
          animation: var(--animation-slide-in-up) forwards;
          overflow: visible;
        }

        .${scope}[position-strategy='fixed'] dialog {
          position: fixed;
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
      hasArrow: {
        type: Boolean,
        reflect: true,
        attribute: 'has-arrow',
      },
      positionStrategy: {
        type: String,
        reflect: true,
        attribute: 'position-strategy',
      },
    };
  }

  get slots() {
    return {
      // Don't need a key event since native dialog already listens to escape key to close
      // eslint-disable-next-line lit-a11y/click-events-have-key-events
      dialog: () => html` <dialog @click=${this.lightDismiss}></dialog> `,
    };
  }

  constructor() {
    super();
    this.isModal = false;
    this.closesOnOutsideClick = false;
    this.dialogMargin = 16;
    this.hasArrow = false;
    this.floatingCleanup = () => {};
    /** @type {import('@floating-ui/dom').Placement} */
    this.placement = 'top';
    /** @type {import('@floating-ui/dom').Strategy} */
    this.positionStrategy = 'absolute';
    this.boundOpen = this.open.bind(this);
    this.boundOnInsideMouseDown = this.onInsideMouseDown.bind(this);
    this.boundOnInsideMouseUp = this.onInsideMouseUp.bind(this);
    this.boundOnDocumentMouseUp = this.onDocumentMouseUp.bind(this);
    this.boundSetLocalPosition = this.doComputePosition.bind(this);
    this.boundEscKeyHandler = this.escKeyHandler.bind(this);
    this.scopedStylesController = new ScopedStylesController(this);
  }

  // TODO: check if firstUpdated() runs when `this` gets moved across the DOM
  // or if we need to re-setup compute position..
  firstUpdated() {
    this.invokerNode?.addEventListener('click', this.boundOpen);
    this.setupMutationObserver();
    this.setupComputePosition();
  }

  /**
   * @param {import('@lion/core').PropertyValues} changedProperties
   */
  updated(changedProperties) {
    if (changedProperties.has('placement') && this.opened) {
      this.doComputePosition();
    }
    if (changedProperties.has('closesOnOutsideClick') && this.opened) {
      this.setupCloseOnOutsideClick();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.floatingCleanup();
  }

  render() {
    return html`
      <slot name="dialog"></slot>
      <slot name="invoker"></slot>
      <slot @slotchange=${this.onContentSlotChange} name="content"></slot>
    `;
  }

  /**
   * @returns {HTMLDialogElement | null}
   */
  get dialogNode() {
    return this.querySelector('[slot="dialog"]');
  }

  /**
   * @returns {HTMLElement | null}
   */
  get invokerNode() {
    return this.querySelector('[slot="invoker"]');
  }

  /**
   * @param {HTMLElement | HTMLTemplateElement | import('@lion/core').TemplateResult} templOrNode
   */
  renderDialogContent(templOrNode) {
    if (!this.dialogNode) return;
    this.dialogNode.innerHTML = '';
    if (isTemplateResult(templOrNode)) {
      render(templOrNode, this.dialogNode);
    } else if (templOrNode instanceof HTMLTemplateElement) {
      this.dialogNode.appendChild(templOrNode.cloneNode(true));
    } else if (templOrNode instanceof HTMLElement) {
      this.dialogNode.appendChild(templOrNode);
    }

    if (this.opened) {
      this.doComputePosition();
    }
  }

  /**
   * @param {HTMLElement | null} node
   */
  set invokerNode(node) {
    if (!node) return;
    if (this.invokerNode) {
      // move current invoker node out back into parent
      this.invokerNode.removeEventListener('click', this.boundOpen);
      this.parentElement?.appendChild(this.invokerNode);

      // move itself next to new invoker
      node.insertAdjacentElement('afterend', this);
    }
    // inject new invoker into itself
    // we know this.invokerNode will now not be null sinec we just appended it
    this.appendChild(node);
    node.setAttribute('slot', 'invoker');
    this.invokerNode?.addEventListener('click', this.boundOpen);

    if (this.opened) {
      this.doComputePosition();
    }
  }

  get opened() {
    return this.hasAttribute('opened');
  }

  set opened(val) {
    if (val) {
      this._open();
    } else {
      this._close();
    }
  }

  /**
   * With showModal() it's easy, we can just catch click event on the dialog node
   * With show() (not modal) it's harder... :(
   */
  setupCloseOnOutsideClick() {
    if (this.closeOnOutsideClickIsSet) {
      return;
    }
    this.addOrRemoveOutsideClickHandlers('add');
  }

  onInsideMouseDown() {
    this.wasMouseDownInside = true;
  }

  onInsideMouseUp() {
    this.wasMouseUpInside = true;
  }

  onDocumentMouseUp() {
    setTimeout(() => {
      if (!this.wasMouseDownInside && !this.wasMouseUpInside) {
        this.close();
        this.addOrRemoveOutsideClickHandlers('remove');
      }
      this.wasMouseDownInside = false;
      this.wasMouseUpInside = false;
    });
  }

  /**
   * @param {'add' | 'remove'} phase
   */
  addOrRemoveOutsideClickHandlers(phase) {
    this.wasMouseDownInside = false;
    this.wasMouseUpInside = false;

    if (this.dialogNode) {
      this.dialogNode[`${phase}EventListener`](
        'mousedown',
        this.boundOnInsideMouseDown,
        true,
      );
      this.dialogNode[`${phase}EventListener`](
        'mouseup',
        this.boundOnInsideMouseUp,
        true,
      );
    }

    if (this.invokerNode) {
      this.invokerNode[`${phase}EventListener`](
        'mousedown',
        this.boundOnInsideMouseDown,
        true,
      );
      this.invokerNode[`${phase}EventListener`](
        'mouseup',
        this.boundOnInsideMouseUp,
        true,
      );
    }
    document.documentElement[`${phase}EventListener`](
      'mouseup',
      this.boundOnDocumentMouseUp,
      true,
    );
    this.closeOnOutsideClickIsSet = phase === 'add';
  }

  /** @param {KeyboardEvent} ev */
  escKeyHandler(ev) {
    if (ev.key === 'Escape') {
      this.close();
    }
  }

  setupCloseOnEsc() {
    document.addEventListener('keyup', this.boundEscKeyHandler);
  }

  setupMutationObserver() {
    const dialogAttrObserver = new MutationObserver(mutations => {
      mutations.forEach(async mutation => {
        if (mutation.attributeName === 'open') {
          const isOpen = this.dialogNode?.hasAttribute('open');
          if (!isOpen && !this.isClosing) {
            this.close();
          }
        }
      });
    });
    if (this.dialogNode) {
      dialogAttrObserver.observe(this.dialogNode, {
        attributes: true,
      });
    } else {
      throw new Error(
        'Attempting to register MutationObserver to dialogNode, but dialogNode does not exist',
      );
    }
  }

  autoFocusTarget() {
    /** @type {HTMLElement | undefined | null} */
    const focusTarget = this.dialogNode?.querySelector('[autofocus]');
    if (focusTarget) {
      focusTarget.focus();
    }
  }

  /**
   * @param {Event} ev
   */
  onContentSlotChange(ev) {
    const [slottable] = /** @type {HTMLSlotElement} */ (
      ev.target
    ).assignedNodes();
    if (slottable && this.dialogNode) {
      this.dialogNode.appendChild(slottable);
    }
  }

  /** @param {Event} ev */
  lightDismiss(ev) {
    if (
      ev.target &&
      ev.target === this.dialogNode &&
      this.closesOnOutsideClick
    ) {
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

  async _open() {
    if (!this.dialogNode) return;
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
    this.doComputePosition();
    window.addEventListener('resize', this.boundSetLocalPosition);
    this.dispatchEvent(dialogOpeningEvent);
    await animationsComplete([this.dialogNode]);
    this.dispatchEvent(dialogOpenedEvent);
  }

  async _close() {
    if (!this.dialogNode) return;
    this.dialogNode.close();
    window.removeEventListener('resize', this.boundSetLocalPosition);
    document.removeEventListener('keyup', this.boundEscKeyHandler);
    this.dispatchEvent(dialogClosingEvent);
    await animationsComplete([this.dialogNode]);
    this.dispatchEvent(dialogClosedEvent);
    this.isClosing = false;
  }

  /** Using @floating-ui/dom */
  setupComputePosition() {
    if (!this.invokerNode || !this.dialogNode) return;
    this.floatingCleanup = autoUpdate(this.invokerNode, this.dialogNode, () => {
      this.doComputePosition();
    });
  }

  doComputePosition() {
    if (!this.dialogNode || !this.invokerNode) return;
    const arrowEl =
      /** @type {import('./dialog-arrow').RiotsDialogArrow | null} */ (
        this.querySelector('[riots-dialog-arrow]')
      );
    computePosition(this.invokerNode, this.dialogNode, {
      strategy: this.positionStrategy,
      placement: this.placement,
      middleware: [
        offset(this.dialogMargin),
        flip(),
        shift(),
        ...(arrowEl
          ? [
              arrow({
                element: arrowEl,
              }),
            ]
          : []),
      ], // TODO: allow passing own middleware array
    }).then(({ x, y, placement, middlewareData }) => {
      if (this.dialogNode) {
        Object.assign(this.dialogNode.style, {
          left: `${x}px`,
          top: `${y}px`,
        });
      }

      if (!middlewareData.arrow || !arrowEl) {
        return;
      }
      // Arrow styling
      const { x: xArrow, y: yArrow } = middlewareData.arrow;
      const primaryAxis =
        /** @type {'top'|'bottom'|'left'|'right'} */ placement.split('-')[0];
      const arrowProps = {
        top: {
          side: 'bottom',
          rotation: 0,
          staticMargin: arrowEl.height, // height of the dialog-arrow
        },
        right: {
          side: 'left',
          rotation: 90,
          // take into account width and height diff, when rotating quarter or 3 quarter
          // this diff displaces the box by half the diff
          staticMargin: arrowEl.height + (arrowEl.width - arrowEl.height) / 2,
        },
        bottom: {
          side: 'top',
          rotation: 180,
          staticMargin: arrowEl.height, // height of the dialog-arrow
        },
        left: {
          side: 'right',
          rotation: 270,
          // take into account width and height diff, when rotating quarter or 3 quarter
          // this diff displaces the box by half the diff
          staticMargin: arrowEl.height + (arrowEl.width - arrowEl.height) / 2,
        },
      }[primaryAxis];

      if (arrowProps) {
        Object.assign(arrowEl.style, {
          left: xArrow != null ? `${xArrow}px` : '',
          top: yArrow != null ? `${yArrow}px` : '',
          right: '',
          bottom: '',
          [arrowProps.side]: `-${arrowProps.staticMargin}px`,
          transform: `rotate(${arrowProps.rotation}deg)`,
        });
      }
    });
  }
}
