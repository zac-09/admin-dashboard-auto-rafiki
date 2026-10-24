import { create } from 'zustand';

/** The "Report a problem" dialog, opened from the sidebar or the keyboard. */
export const useReportDialog = create<{ open: boolean; setOpen: (open: boolean) => void }>(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);
