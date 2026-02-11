'use client';

import { useAdmin } from '@/lib/admin-context';

export function SwitchingOverlay({ children }: { children: React.ReactNode }) {
  const { isSwitching } = useAdmin();

  return (
    <div className="relative">
      {isSwitching && (
        <div className="absolute inset-0 bg-white/60 z-10 flex items-start justify-center pt-20">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="size-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            Switching client…
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
