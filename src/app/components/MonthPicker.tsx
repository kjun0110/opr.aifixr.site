import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';

interface MonthPickerProps {
  selectedMonth: string | null; // YYYY-MM format
  onChange: (month: string | null) => void;
  placeholder?: string;
  /** 프로젝트 기간 내 월만 활성화. 미지정 시 모든 월 선택 가능 */
  enabledMonths?: string[]; // YYYY-MM format
  disabled?: boolean;
}

export default function MonthPicker({ selectedMonth, onChange, placeholder = '기간 선택', enabledMonths, disabled = false }: MonthPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(() => {
    if (selectedMonth) return parseInt(selectedMonth.split('-')[0]);
    if (enabledMonths && enabledMonths.length > 0) return parseInt(enabledMonths[0].split('-')[0]);
    return new Date().getFullYear();
  });
  
  const [tempSelectedMonth, setTempSelectedMonth] = useState<string | null>(selectedMonth);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown 열릴 때 currentYear를 enabledMonths 또는 selectedMonth에 맞춤
  useEffect(() => {
    if (isOpen) {
      if (selectedMonth) setCurrentYear(parseInt(selectedMonth.split('-')[0]));
      else if (enabledMonths && enabledMonths.length > 0) setCurrentYear(parseInt(enabledMonths[0].split('-')[0]));
    }
  }, [isOpen, selectedMonth, enabledMonths]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const months = [
    { label: '1월', value: '01' },
    { label: '2월', value: '02' },
    { label: '3월', value: '03' },
    { label: '4월', value: '04' },
    { label: '5월', value: '05' },
    { label: '6월', value: '06' },
    { label: '7월', value: '07' },
    { label: '8월', value: '08' },
    { label: '9월', value: '09' },
    { label: '10월', value: '10' },
    { label: '11월', value: '11' },
    { label: '12월', value: '12' },
  ];

  const handleYearPrev = () => {
    setCurrentYear(currentYear - 1);
  };

  const handleYearNext = () => {
    setCurrentYear(currentYear + 1);
  };

  const handleMonthClick = (monthValue: string) => {
    const newMonth = `${currentYear}-${monthValue}`;
    setTempSelectedMonth(newMonth);
  };

  const handleConfirm = () => {
    onChange(tempSelectedMonth);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempSelectedMonth(null);
    onChange(null);
    setIsOpen(false);
  };

  const formatDisplayValue = () => {
    if (!selectedMonth) return placeholder;
    const [y, m] = selectedMonth.split('-');
    if (y && m) return `${y}년 ${parseInt(m)}월`;
    return selectedMonth;
  };

  const isMonthSelected = (monthValue: string) => {
    if (!tempSelectedMonth) return false;
    const [year, month] = tempSelectedMonth.split('-');
    return parseInt(year) === currentYear && month === monthValue;
  };

  const isMonthEnabled = (monthValue: string) => {
    if (!enabledMonths || enabledMonths.length === 0) return true;
    const monthStr = `${currentYear}-${monthValue}`;
    return enabledMonths.includes(monthStr);
  };

  const { minYear, maxYear } = useMemo(() => {
    if (!enabledMonths || enabledMonths.length === 0) return { minYear: 2020, maxYear: 2030 };
    const years = enabledMonths.map(m => parseInt(m.split('-')[0]));
    return { minYear: Math.min(...years), maxYear: Math.max(...years) };
  }, [enabledMonths]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Input Field */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B3BFA] text-left flex items-center justify-between ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      >
        <span className={selectedMonth ? 'text-gray-900' : 'text-gray-400'}>
          {formatDisplayValue()}
        </span>
        <Calendar className="w-5 h-5 text-gray-400" />
      </button>

      {/* Dropdown Calendar */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 bg-white shadow-xl z-50 p-4"
          style={{
            borderRadius: '16px',
            width: '320px',
            border: '1px solid #E5E7EB',
          }}
        >
          {/* Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handleYearPrev}
              disabled={enabledMonths && currentYear <= minYear}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-lg font-bold">{currentYear}년</div>
            <button
              type="button"
              onClick={handleYearNext}
              disabled={enabledMonths && currentYear >= maxYear}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {months.map((month) => {
              const selected = isMonthSelected(month.value);
              const enabled = isMonthEnabled(month.value);
              return (
                <button
                  key={month.value}
                  type="button"
                  onClick={() => enabled && handleMonthClick(month.value)}
                  disabled={!enabled}
                  className={`py-3 rounded-lg font-medium transition-all ${
                    !enabled
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : selected
                        ? 'text-white'
                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                  }`}
                  style={
                    selected && enabled
                      ? {
                          background: 'linear-gradient(135deg, #5B3BFA 0%, #7C5EFF 100%)',
                        }
                      : {}
                  }
                >
                  {month.label}
                </button>
              );
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              선택 해제
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 text-sm text-white rounded-lg font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              }}
            >
              선택 완료
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
