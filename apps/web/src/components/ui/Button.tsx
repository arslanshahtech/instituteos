import type { ButtonHTMLAttributes } from 'react';
import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className = '', variant = 'secondary', iconOnly = false, ...props },
    ref,
  ) {
    const classes = [
      'button',
      `button-${variant}`,
      iconOnly ? 'button-icon' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return <button ref={ref} className={classes} {...props} />;
  },
);
