// custom events to be added to <dialog>
const dialogClosingEvent = new Event("closing");
const dialogClosedEvent = new Event("closed");
const dialogOpeningEvent = new Event("opening");
const dialogOpenedEvent = new Event("opened");
const dialogRemovedEvent = new Event("removed");

const dialogDeleteObserver = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.removedNodes.forEach((removedNode) => {
      if (removedNode.nodeName === "DIALOG") {
        removedNode.removeEventListener("click", lightDismiss);
        removedNode.removeEventListener("close", dialogClose);
        removedNode.dispatchEvent(dialogRemovedEvent);
      }
    });
  });
});

async function dialogClose({ target: dialogEl }) {
  dialogEl.dispatchEvent(dialogClosingEvent);
  await animationsComplete(dialogEl);
  dialogEl.dispatchEvent(dialogClosedEvent);
}

function lightDismiss({ target: dialogEl }) {
  if (dialogEl.nodeName === "DIALOG") {
    dialogEl.close("dismiss");
  }
}

const dialogAttrObserver = new MutationObserver((mutations) => {
  mutations.forEach(async (mutation) => {
    if (mutation.attributeName === "open") {
      const dialogEl = mutation.target;

      const isOpen = dialogEl.hasAttribute("open");
      if (!isOpen) return;

      dialogEl.removeAttribute("inert");

      // set focus
      const focusTarget = dialogEl.querySelector("[autofocus]");
      if (focusTarget) {
        focusTarget.focus();
      }

      dialogEl.dispatchEvent(dialogOpeningEvent);
      await animationsComplete(dialogEl);
      dialogEl.dispatchEvent(dialogOpenedEvent);
    }
  });
});

function animationsComplete(element) {
  return Promise.allSettled(
    element.getAnimations().map((animation) => animation.finished)
  );
}

/**
 *
 * @param {HTMLDialogElement} dialogEl
 * @param {HTMLElement} invokerEl
 */
export async function initDialog(dialogEl, invokerEl) {
  dialogEl.addEventListener("click", lightDismiss);
  dialogEl.addEventListener("close", dialogClose);
  invokerEl.addEventListener("click", (ev) => {
    dialogEl.showModal();

    const popoverMargin = 8;
    const bounds = invokerEl.getBoundingClientRect();
    // might want to include border sizes
    const modalHeight = dialogEl.offsetHeight;
    const left = bounds.left;
    dialogEl.style.marginTop = bounds.y - modalHeight - popoverMargin + "px";
    dialogEl.style.marginLeft = left + "px";
  });

  dialogDeleteObserver.observe(document.body, {
    attributes: false,
    subtree: false,
    childList: true,
  });

  dialogAttrObserver.observe(dialogEl, {
    attributes: true,
  });

  await animationsComplete(dialogEl);
  dialogEl.removeAttribute("loading");
}
