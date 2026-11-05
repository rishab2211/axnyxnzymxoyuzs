import React, { useRef } from 'react';
import { formatDateUTC } from '@/lib/formatters';

interface DateInputProps {
  value: string; // ISO format 'YYYY-MM-DD'
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  min,
  max,
  className = '',
  disabled = false,
  'aria-label': ariaLabel = 'Select date',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Strictly formats 'YYYY-MM-DD' to 'DD-MM-YYYY'
  const displayDate = formatDateUTC(value) || value;

  const handleContainerClick = () => {
    if (disabled) return;
    try {
      if (inputRef.current && typeof inputRef.current.showPicker === 'function') {
        inputRef.current.showPicker();
      } else {
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <div
      onClick={handleContainerClick}
      className={`relative inline-flex items-center cursor-pointer select-none font-mono ${className}`}
      title="Click to change date"
    >
      <span className="text-xs font-semibold text-slate-800 tracking-tight">
        {displayDate}
      </span>
      {/* Invisible overlay native date input to capture interaction and trigger picker */}
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value) {
            onChange(e.target.value);
          }
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer pointer-events-auto"
        tabIndex={0}
        aria-label={ariaLabel}
      />
    </div>
  );
};
