import React, { HTMLAttributes } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info';
  size?: 'sm' | 'md';
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'sm', className = '', children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center font-semibold rounded-full';

    const variants = {
      default: 'bg-tertiary text-primary',
      success: 'bg-green-900 text-green-100',
      error: 'bg-red-900 text-red-100',
      warning: 'bg-yellow-900 text-yellow-100',
      info: 'bg-blue-900 text-blue-100',
    };

    const sizes = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
    };

    return (
      <span
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
