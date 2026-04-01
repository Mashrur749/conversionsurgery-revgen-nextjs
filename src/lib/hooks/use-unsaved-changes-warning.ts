'use client';

import { useEffect, useRef } from 'react';

/**
 * Shows the browser's native "Leave page?" dialog when the user tries to
 * navigate away while there are unsaved changes.
 *
 * @param isDirty - Whether the form has unsaved changes
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      e.preventDefault();
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
