import { create } from 'zustand';

/** The ⌘K search palette, opened from the keyboard or the sidebar's Search button. */
export const usePalette = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));
