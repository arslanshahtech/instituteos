import type { InputHTMLAttributes, ReactNode } from 'react';
import { useId } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  children?: ReactNode;
}

export function FormField({
  label,
  error,
  hint,
  id,
  children,
  ...inputProps
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? inputProps.name ?? generatedId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="form-field">
      <label htmlFor={fieldId}>{label}</label>
      {children ?? (
        <input
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...inputProps}
        />
      )}
      {hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
