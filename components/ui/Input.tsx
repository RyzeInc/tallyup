"use client";

import React, { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = "", error = false, leftIcon, rightIcon, ...props },
  ref
) {
  const baseClass = "w-full h-10 rounded-lg border bg-[var(--surface)] text-[var(--text)] text-sm placeholder:text-[var(--text-placeholder)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed";
  const errorClass = error ? "border-[var(--danger)] focus:ring-[var(--danger)]" : "border-[var(--border)]";
  const paddingClass = leftIcon ? "pl-10" : rightIcon ? "pr-10" : "px-3";

  if (leftIcon || rightIcon) {
    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={`${baseClass} ${errorClass} ${paddingClass} ${className}`}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      className={`${baseClass} ${errorClass} px-3 ${className}`}
      {...props}
    />
  );
});

export default Input;
