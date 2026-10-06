import { useEffect } from 'react';

const SUFFIX = 'AutoRafiki Ops';

/** Browser tab title: "Vetting · AutoRafiki Ops". Staff keep several tabs open. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : SUFFIX;
  }, [title]);
}
