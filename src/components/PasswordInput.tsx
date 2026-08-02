"use client";

import { Eye, EyeOff, X } from "lucide-react";
import { InputHTMLAttributes, useId, useState } from "react";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
};

export function PasswordInput({
  label,
  value,
  onValueChange,
  id,
  className,
  ...rest
}: PasswordInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="vm-label" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          className={`vm-input pr-20 ${className ?? ""}`}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          {...rest}
        />
        <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
          {value ? (
            <button
              type="button"
              className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
              onClick={() => onValueChange("")}
              aria-label="Clear password"
              title="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--ink-muted)] hover:bg-black/5 hover:text-[var(--ink)]"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            title={visible ? "Hide" : "Show"}
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
