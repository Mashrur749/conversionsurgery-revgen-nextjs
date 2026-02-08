'use client';

import * as React from 'react';

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({ open: false, onOpenChange: () => {} });

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(open);
  const isControlled = onOpenChange !== undefined;
  const actualOpen = isControlled ? open : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  return (
    <DialogContext.Provider value={{ open: actualOpen, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

export function DialogTrigger({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) {
  const { onOpenChange } = React.useContext(DialogContext);

  return (
    <button onClick={() => onOpenChange(true)} {...props}>
      {children}
    </button>
  );
}

export function DialogContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const { open, onOpenChange } = React.useContext(DialogContext);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50">
        <div
          className={`bg-white rounded-lg shadow-lg max-w-md w-[90vw] max-h-[85vh] overflow-y-auto ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}

export function DialogHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pb-4 ${className}`}>{children}</div>;
}

export function DialogTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-lg font-semibold ${className}`}>{children}</h2>;
}

export function DialogDescription({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-muted-foreground mt-2 ${className}`}>{children}</p>;
}

export function DialogFooter({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`p-6 pt-4 flex justify-end gap-2 border-t ${className}`}>
      {children}
    </div>
  );
}
