import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

type BackHandler = () => boolean | void;

// Stack to hold active modal/view dismiss callbacks (LIFO)
const handlerStack: BackHandler[] = [];

/**
 * Register a handler to be executed on Android hardware back button press.
 * Returns an unregister function to remove the handler when the modal/view unmounts or closes.
 */
export const registerBackHandler = (handler: BackHandler): (() => void) => {
  handlerStack.push(handler);
  return () => {
    const idx = handlerStack.lastIndexOf(handler);
    if (idx !== -1) {
      handlerStack.splice(idx, 1);
    }
  };
};

let isInitialized = false;

/**
 * Initialize Android hardware back button handling.
 * Calls modal dismiss handlers first; if stack is empty, delegates to router navigation or app exit.
 */
export const initBackButton = (
  onNavigateBack: () => void,
  onExitApp: () => void
) => {
  if (!Capacitor.isNativePlatform() || isInitialized) return;

  isInitialized = true;

  App.addListener('backButton', () => {
    // If a modal, bottom-sheet or drawer is open, dismiss it first
    if (handlerStack.length > 0) {
      const topHandler = handlerStack.pop();
      if (topHandler) {
        const handled = topHandler();
        if (handled !== false) {
          return;
        }
      }
    }

    // No modal is open - check current route navigation or exit
    const path = window.location.pathname;
    if (path === '/' || path === '/login') {
      onExitApp();
    } else {
      onNavigateBack();
    }
  });
};
