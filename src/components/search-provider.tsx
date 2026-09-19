'use client';

/**
 * Search Provider — wraps the app and provides the
 * Cmd+K / Ctrl+K keyboard shortcut to open Command Center.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { CommandCenter } from '@/components/command-center';

// ============================================
// SEARCH PROVIDER
// ============================================

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Global keyboard shortcut listener
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      setOpen((prev) => !prev);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {children}
      <CommandCenter open={open} onOpenChange={setOpen} />
    </>
  );
}
