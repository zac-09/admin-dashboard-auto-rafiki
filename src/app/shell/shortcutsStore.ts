import { create } from 'zustand';

/** The ? keyboard-shortcuts sheet, opened from the keyboard or the sidebar. */
export const useShortcutsSheet = create<{ open: boolean; setOpen: (open: boolean) => void }>(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);
