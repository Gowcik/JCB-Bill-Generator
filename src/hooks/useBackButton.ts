import { useEffect } from 'react';
import { registerBackHandler } from '../services/backButtonService';

/**
 * Hook to dismiss modals, sheets, or drawers when the Android back button is pressed.
 * Automatically registers when isOpen is true and unregisters when isOpen becomes false or unmounts.
 */
export const useBackButton = (isOpen: boolean, onBack: () => void) => {
  useEffect(() => {
    if (!isOpen) return;

    const unregister = registerBackHandler(() => {
      onBack();
      return true; // indicates event was handled
    });

    return unregister;
  }, [isOpen, onBack]);
};
