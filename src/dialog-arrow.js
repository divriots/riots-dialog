import { LitElement, html, css } from '@lion/core';

export class RiotsDialogArrow extends LitElement {
  static get styles() {
    return [
      css`
        :host {
          position: absolute;
        }

        svg {
          display: block;
          width: 16px;
          color: var(--surface-1);
        }

        @media (prefers-color-scheme: dark) {
          svg {
            color: var(--surface-2);
          }
        }
      `,
    ];
  }

  constructor() {
    super();
    // Set these props for the RevDialog to compute the position
    // of the arrow properly in all positions
    this.width = 16;
    this.height = 12;
  }

  render() {
    return html`
      <svg viewBox="0 0 16 12">
        <path fill="currentColor" d="M 0,0 L 8,12 L 16,0"></path>
      </svg>
    `;
  }
}
