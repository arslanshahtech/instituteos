import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button.js';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  className?: string;
  portal?: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({
  open,
  title,
  description,
  className,
  portal = false,
  onOpenChange,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const dialogElement = (
    <dialog
      ref={dialogRef}
      className={['dialog', className].filter(Boolean).join(' ')}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onOpenChange(false);
      }}
      onClose={() => onOpenChange(false)}
    >
      <div className="dialog-header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p id={descriptionId}>{description}</p>}
        </div>
        <Button
          aria-label="Close dialog"
          iconOnly
          onClick={() => onOpenChange(false)}
          variant="quiet"
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );

  return portal ? createPortal(dialogElement, document.body) : dialogElement;
}
