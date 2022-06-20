import styles from 'open-props/style' assert { type: 'css' };
import normalize from 'open-props/normalize' assert { type: 'css' };
import button from 'open-props/buttons' assert { type: 'css' };
import { initDialog } from './dialog-copy.js';
import './dialog.js';

document.adoptedStyleSheets = [
  ...document.adoptedStyleSheets,
  styles,
  normalize,
  button,
];

/** @type {HTMLButtonElement} */
const invokerEl = document.getElementById('modal-invoker');
/** @type {HTMLDialogElement} */
const dialogEl = document.getElementById('modal');

const dialogClosing = ({ target: dialogEl }) => {
  console.log('Dialog closing', dialogEl);
};

const dialogClosed = ({ target: dialogEl }) => {
  console.log('Dialog closed', dialogEl);
  console.info('Dialog user action:', dialogEl.returnValue);

  // if (dialog.returnValue === "confirm") {
  //   const dialogFormData = new FormData(dialog.querySelector("form"));
  //   console.info(
  //     "Dialog form data",
  //     Object.fromEntries(dialogFormData.entries())
  //   );
  //   handleFile(dialogFormData);

  //   dialog.querySelector("form")?.reset();
  // }
};

const dialogOpened = ({ target: dialogEl }) => {
  console.log('Dialog open', dialogEl);
};

const dialogOpening = ({ target: dialogEl }) => {
  console.log('Dialog opening', dialogEl);
};

const dialogRemoved = ({ target: dialogEl }) => {
  // cleanup new/optional <dialog> events
  dialog.removeEventListener('closing', dialogClosing);
  dialog.removeEventListener('closed', dialogClosed);
  dialog.removeEventListener('opening', dialogOpening);
  dialog.removeEventListener('opened', dialogOpened);
  dialog.removeEventListener('removed', dialogRemoved);
  console.log('Dialog removed', dialogEl);
};

initDialog(dialogEl, invokerEl);
dialogEl.addEventListener('closing', dialogClosing);
dialogEl.addEventListener('closed', dialogClosed);
dialogEl.addEventListener('opening', dialogOpening);
dialogEl.addEventListener('opened', dialogOpened);
dialogEl.addEventListener('removed', dialogRemoved);
