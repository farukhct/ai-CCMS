import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toCanonicalDate, toDisplayDate, isValidCalendarDate, isLeapYear } from '../../services/dateUtils';

interface DatePickerProps {
  value: string; // Canonical YYYY-MM-DD or empty
  onChange: (canonicalDate: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'dd-MM-yyyy',
  disabled = false,
  required = false
}) => {
  const [displayText, setDisplayText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calendar popover view state
  const [viewYear, setViewYear] = useState<number>(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) return parseInt(parts[0], 10);
    }
    return new Date().getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value) {
      const parts = value.split('-');
      if (parts.length === 3) return parseInt(parts[1], 10);
    }
    return new Date().getMonth() + 1; // 1-12
  });

  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync internal display when canonical value changes externally
  useEffect(() => {
    if (value) {
      setDisplayText(toDisplayDate(value, ''));
      setError(null);
    } else {
      setDisplayText('');
      setError(null);
    }
  }, [value]);

  // Click outside to close calendar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setDisplayText(text);

    if (!text.trim()) {
      setError(null);
      onChange('');
      return;
    }

    // Try parsing if complete (10 characters: DD-MM-YYYY)
    if (text.length >= 8) {
      const canonical = toCanonicalDate(text);
      if (canonical) {
        setError(null);
        onChange(canonical);
      } else {
        setError('Invalid date (use DD-MM-YYYY)');
      }
    } else {
      setError(null);
    }
  };

  const handleBlur = () => {
    if (!displayText.trim()) {
      setError(null);
      onChange('');
      return;
    }
    const canonical = toCanonicalDate(displayText);
    if (canonical) {
      setError(null);
      setDisplayText(toDisplayDate(canonical, ''));
      onChange(canonical);
    } else {
      setError('Invalid date. Format: DD-MM-YYYY');
    }
  };

  const handleSelectDay = (day: number) => {
    if (!isValidCalendarDate(day, viewMonth, viewYear)) return;
    const yStr = viewYear.toString().padStart(4, '0');
    const mStr = viewMonth.toString().padStart(2, '0');
    const dStr = day.toString().padStart(2, '0');
    const canonical = `${yStr}-${mStr}-${dStr}`;

    onChange(canonical);
    setDisplayText(`${dStr}-${mStr}-${yStr}`);
    setError(null);
    setIsOpen(false);
  };

  const handleClear = () => {
    setDisplayText('');
    setError(null);
    onChange('');
  };

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  // Days in month calculation
  const daysInViewMonth = [31, isLeapYear(viewYear) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][viewMonth - 1];
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="relative" ref={popoverRef}>
      {label && (
        <label className="block text-xs font-medium text-slate-700 mb-1">
          {label} {required && <span className="text-rose-600 font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          type="text"
          value={displayText}
          onChange={handleManualInput}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-2.5 py-1.5 text-xs bg-white border rounded font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-700 focus:border-teal-700 ${
            error ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300'
          }`}
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {displayText && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
              title="Clear Date"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className="text-slate-500 hover:text-teal-700 p-0.5 rounded"
            title="Open Calendar"
          >
            <CalendarIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-rose-600 mt-0.5">{error}</p>
      )}

      {/* Popover Calendar */}
      {isOpen && (
        <div className="absolute left-0 mt-1 z-50 bg-white border border-slate-300 rounded shadow-xl p-3 w-64 text-xs animate-in zoom-in-95 duration-75">
          {/* Header Month / Year Navigation */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-100">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-slate-800">
              {monthNames[viewMonth - 1]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 text-slate-600 hover:bg-slate-100 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-medium text-slate-400 text-[10px] mb-1">
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Days of month */}
            {Array.from({ length: daysInViewMonth }).map((_, i) => {
              const day = i + 1;
              const yStr = viewYear.toString().padStart(4, '0');
              const mStr = viewMonth.toString().padStart(2, '0');
              const dStr = day.toString().padStart(2, '0');
              const currentCanonical = `${yStr}-${mStr}-${dStr}`;
              const isSelected = value === currentCanonical;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-6 w-full rounded flex items-center justify-center font-mono text-[11px] transition-colors ${
                    isSelected
                      ? 'bg-teal-700 text-white font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Today Button */}
          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center text-[11px]">
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const y = today.getFullYear();
                const m = today.getMonth() + 1;
                const d = today.getDate();
                setViewYear(y);
                setViewMonth(m);
                handleSelectDay(d);
              }}
              className="text-teal-700 font-medium hover:underline"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
