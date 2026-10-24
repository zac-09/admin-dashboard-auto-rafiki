import { create } from 'zustand';

export interface Toast {
  id: number;
  /** What happened, in a few words ("Payment recorded"). */
  title: string;
  /** Who or what it happened to. */
  body?: string;
  /** Where to see the result (usually the audit log or the record). */
  link?: { to: string; label: string };
  tone: 'success' | 'info';
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }) => number;
  dismiss: (id: number) => void;
}

/** At most this many on screen; older ones leave first. */
export const MAX_TOASTS = 3;
let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: ({ tone = 'success', ...toast }) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...toast, tone, id }].slice(-MAX_TOASTS) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Confirm that an action worked, from anywhere (not only components). */
export const toast = (t: Parameters<ToastState['push']>[0]) => useToasts.getState().push(t);
