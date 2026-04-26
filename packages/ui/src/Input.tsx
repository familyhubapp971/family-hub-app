import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  testId?: string;
}

// forwardRef so consumers can attach refs (focus management, react-hook-
// form register, scroll-into-view). Plus focus-visible ring for WCAG 2.4.7.
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', testId, ...props }, ref) => (
    <input
      ref={ref}
      data-testid={testId}
      className={[
        'w-full text-sm font-bold border-2 rounded-xl px-4 py-3 bg-gray-50 transition-colors',
        'outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
        error ? 'border-red-400' : 'border-gray-200 focus:border-pink-400',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  testId?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className = '', testId, ...props }, ref) => (
    <textarea
      ref={ref}
      data-testid={testId}
      className={[
        'w-full text-sm border-2 rounded-xl px-4 py-3 bg-gray-50 resize-none transition-colors',
        'outline-none focus-visible:ring-4 focus-visible:ring-pink-400 focus-visible:ring-offset-2',
        error ? 'border-red-400' : 'border-gray-200 focus:border-pink-400',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
