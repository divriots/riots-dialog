import { css, html, LitElement, SlotMixin } from '@lion/core';

// custom events to be added to <dialog>
const dialogClosingEvent = new Event('closing');
const dialogClosedEvent = new Event('closed');
const dialogOpeningEvent = new Event('opening');
const dialogOpenedEvent = new Event('opened');
const dialogRemovedEvent = new Event('removed');

function animationsComplete(element) {
  return Promise.allSettled(
    element.getAnimations().map((animation) => animation.finished),
  );
}

export class MyDialog extends SlotMixin(LitElement) {
  static get styles() {
    return [
      css`
        ::slotted([slot='dialog']) {
          display: grid;
          background: var(--surface-2);
          color: var(--text-1);
          max-inline-size: min(90vw, var(--size-content-3));
          max-block-size: min(80vh, 100%);
          margin: auto;
          padding: 0;
          position: fixed;
          inset: 0;
          border-radius: var(--radius-3);
          box-shadow: var(--shadow-3);
          z-index: var(--layer-important);
          overflow: hidden;
          transition: opacity 0.5s var(--ease-3);
          animation-timing-function: var(--ease-squish-3);
          animation: var(--animation-slide-out-down) forwards;
          animation-timing-function: var(--ease-squish-2);
        }

        ::slotted([slot='dialog']:not([open])) {
          pointer-events: none;
          opacity: 0;
        }

        ::slotted([slot='dialog']::backdrop) {
          backdrop-filter: blur(0px) !important;
          transition: backdrop-filter 0.5s ease;
        }

        ::slotted([slot='dialog'][loading]) {
          visibility: hidden;
        }

        ::slotted([slot='dialog'][open]) {
          animation: var(--animation-slide-in-up) forwards;
        }
      `,
    ];
  }

  get slots() {
    return {
      dialog: () => html`
        <dialog
          data-dialog
          @click=${this.lightDismiss}
          @close=${this.dialogClose}
          loading
          inert
          id="modal"
        ></dialog>
      `,
    };
  }

  constructor() {
    super();
    this.boundShowModal = this.showModal.bind(this);
    this.popoverMargin = 8;
  }

  firstUpdated() {
    this.setupMutationObservers();
    this.invokerNode.addEventListener('click', this.boundShowModal);
    this.removeLoading();
  }

  render() {
    return html`
      <slot name="dialog"></slot>
      <slot name="invoker"></slot>
      <slot @slotchange=${this.onContentSlotChange} name="content"></slot>
    `;
  }

  get dialogNode() {
    return this.querySelector('dialog[data-dialog]');
  }

  get invokerNode() {
    return this.querySelector('[slot="invoker"]');
  }

  onContentSlotChange(ev) {
    const [slottable] = /** @type {HTMLSlotElement} */ (
      ev.target
    ).assignedNodes();
    if (slottable) {
      this.dialogNode.appendChild(slottable);
    }
  }

  async dialogClose() {
    this.dispatchEvent(dialogClosingEvent);
    await animationsComplete(this.dialogNode);
    this.dispatchEvent(dialogClosedEvent);
  }

  lightDismiss(ev) {
    if (ev.target.nodeName === 'DIALOG') {
      this.dialogNode.close('dismiss');
    }
  }

  setupMutationObservers() {
    const dialogDeleteObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((removedNode) => {
          if (removedNode.nodeName === 'DIALOG') {
            removedNode.dispatchEvent(dialogRemovedEvent);
          }
        });
      });
    });

    const dialogAttrObserver = new MutationObserver((mutations) => {
      mutations.forEach(async (mutation) => {
        if (mutation.attributeName === 'open') {
          const isOpen = this.dialogNode.hasAttribute('open');
          if (!isOpen) return;

          this.dialogNode.removeAttribute('inert');

          const focusTarget = this.dialogNode.querySelector('[autofocus]');
          if (focusTarget) {
            focusTarget.focus();
          }

          this.dialogNode.dispatchEvent(dialogOpeningEvent);
          await animationsComplete(this.dialogNode);
          this.dialogNode.dispatchEvent(dialogOpenedEvent);
        }
      });
    });

    dialogDeleteObserver.observe(document.body, {
      attributes: false,
      subtree: false,
      childList: true,
    });

    dialogAttrObserver.observe(this.dialogNode, {
      attributes: true,
    });
  }

  showModal() {
    this.dialogNode.showModal();
    this.setLocalPosition();
  }

  setLocalPosition() {
    const bounds = this.invokerNode.getBoundingClientRect();
    const modalHeight = this.dialogNode.offsetHeight;
    const left = bounds.left;
    this.dialogNode.style.marginTop =
      bounds.y - modalHeight - this.popoverMargin + 'px';
    this.dialogNode.style.marginLeft = left + 'px';
  }

  async removeLoading() {
    await animationsComplete(this.dialogNode);
    this.dialogNode.removeAttribute('loading');
  }
}
customElements.define('my-dialog', MyDialog);
