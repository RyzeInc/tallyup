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
  const baseClass =
    "w-full h-11 rounded-xl bg-[var(--surface-subtle)] text-body placeholder:text-[var(--text-tertiary)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed";
  const errorClass = error ? "ring-2 ring-[var(--danger)]" : "";
  const paddingClass = leftIcon ? "pl-11" : rightIcon ? "pr-11" : "px-4";

  if (leftIcon || rightIcon) {
    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={`${baseClass} ${errorClass} ${paddingClass} ${className}`}
          style={{ color: "var(--text)" }}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }

  return (
    <input
      ref={ref}
      className={`${baseClass} ${errorClass} px-4 ${className}`}
      style={{ color: "var(--text)" }}
      {...props}
    />
  );
});

export default Input;
