import styles from 'open-props/style' assert { type: 'css' };
import normalize from 'open-props/normalize' assert { type: 'css' };
import button from 'open-props/buttons' assert { type: 'css' };
import '../dialog.js';

document.adoptedStyleSheets = [
  ...document.adoptedStyleSheets,
  styles,
  normalize,
  button,
];

function getElementReferences(selectors) {
  return selectors.map((sel) => document.querySelector(sel));
}

const [
  dialogEl,
  isModalBtnEl,
  isModalCurrEl,
  closesOutsideBtnEl,
  closesOutsideCurrEl,
  posCurrEl,
] = getElementReferences([
  '#modal',
  '[data-is-modal-btn]',
  '#curr-is-modal',
  '[data-closes-outside-btn]',
  '#curr-closes-outside',
  '#curr-pos',
]);
const posBtnEls = document.querySelectorAll('[data-pos-btn]');
posCurrEl.innerText = dialogEl.placement;
isModalCurrEl.innerText = dialogEl.isModal;
closesOutsideCurrEl.innerText = dialogEl.closesOnOutsideClick;

const placements = [
  'top-end',
  'top',
  'top-start',
  'right-end',
  'right',
  'right-start',
  'bottom-start',
  'bottom',
  'bottom-end',
  'left-start',
  'left',
  'left-end',
];

const switchPosition = () => {
  const currentPosition = dialogEl.placement;
  let newIndex = placements.findIndex((pos) => pos === currentPosition) + 1;
  if (newIndex >= placements.length) {
    newIndex = 0;
  }
  const newPos = placements[newIndex];
  dialogEl.placement = newPos;
  posCurrEl.innerText = newPos;
};

const switchIsModal = () => {
  dialogEl.isModal = !dialogEl.isModal;
  isModalCurrEl.innerText = dialogEl.isModal;
};

const switchClosesOutside = () => {
  dialogEl.closesOnOutsideClick = !dialogEl.closesOnOutsideClick;
  closesOutsideCurrEl.innerText = dialogEl.closesOnOutsideClick;
};

const onDialogEvent = ({ target: dialogEl, type }) => {
  console.log(type, dialogEl);
};

function setupDemoListeners() {
  posBtnEls.forEach((btn) => {
    btn.addEventListener('click', switchPosition);
  });

  isModalBtnEl.addEventListener('click', switchIsModal);

  closesOutsideBtnEl.addEventListener('click', switchClosesOutside);

  [
    'dialog-closing',
    'dialog-closed',
    'dialog-opening',
    'dialog-opened',
  ].forEach((ev) => {
    dialogEl.addEventListener(ev, onDialogEvent);
  });
}
setupDemoListeners();
