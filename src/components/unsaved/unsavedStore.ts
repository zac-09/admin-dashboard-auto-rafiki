import { useEffect, useId } from 'react';
import { create } from 'zustand';

interface UnsavedState {
  /** Ids of forms holding text that has not been saved. */
  dirty: ReadonlySet<string>;
  set: (id: string, dirty: boolean) => void;
}

export const useUnsavedStore = create<UnsavedState>((set) => ({
  dirty: new Set(),
  set: (id, isDirty) =>
    set((s) => {
      if (s.dirty.has(id) === isDirty) return s;
      const next = new Set(s.dirty);
      if (isDirty) next.add(id);
      else next.delete(id);
      return { dirty: next };
    }),
}));

/**
 * Marks this form as holding unsaved work while `dirty` is true (typically: a reason or note
 * has been typed and not yet saved). The shell's guard then asks before navigating away or
 * closing the tab. Unmounting clears it.
 */
export function useUnsaved(dirty: boolean): void {
  const id = useId();
  const set = useUnsavedStore((s) => s.set);
  useEffect(() => {
    set(id, dirty);
  }, [id, dirty, set]);
  useEffect(() => () => set(id, false), [id, set]);
}
