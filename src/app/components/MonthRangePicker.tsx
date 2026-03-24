import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface MonthRangePickerProps {
  startMonth: string | null; // Format: "2025-01"
  endMonth: string | null;   // Format: "2025-12"
  onChange: (start: string | null, end: string | null) => void;
  error?: string;
  disabled?: boolean;
}

export default function MonthRangePicker({ startMonth, endMonth, onChange, error, disabled }: MonthRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [tempStartMonth, setTempStartMonth] = useState<string | null>(startMonth);
  const [tempEndMonth, setTempEndMonth] = useState<string | null>(endMonth);
  const [hoverMonth, setHoverMonth] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const monthsKo = [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ];

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
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

  const formatMonthKey = (year: number, monthIndex: number): string => {
    const month = (monthIndex + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  };

  const parseMonthKey = (key: string): { year: number; month: number } | null => {
    if (!key) return null;
    const [year, month] = key.split('-').map(Number);
    return { year, month };
  };

  const getDisplayText = (): string => {
    if (!startMonth || !endMonth) {
      return '기간을 선택하세요';
    }
    const start = parseMonthKey(startMonth);
    const end = parseMonthKey(endMonth);
    if (!start || !end) return '기간을 선택하세요';
    
    return `${start.year}년 ${start.month}월 ~ ${end.year}년 ${end.month}월`;
  };

  const handleMonthClick = (year: number, monthIndex: number) => {
    const monthKey = formatMonthKey(year, monthIndex);

    if (!tempStartMonth || tempEndMonth) {
      // Start new selection
      setTempStartMonth(monthKey);
      setTempEndMonth(null);
    } else {
      // Complete selection
      const start = parseMonthKey(tempStartMonth);
      const end = parseMonthKey(monthKey);

      if (!start || !end) return;

      // Auto-correct if end is before start
      const startDate = new Date(start.year, start.month - 1);
      const endDate = new Date(end.year, end.month - 1);

      if (endDate < startDate) {
        // Swap
        setTempStartMonth(monthKey);
        setTempEndMonth(tempStartMonth);
        onChange(monthKey, tempStartMonth);
      } else {
        setTempStartMonth(tempStartMonth);
        setTempEndMonth(monthKey);
        onChange(tempStartMonth, monthKey);
      }

      // Close picker
      setIsOpen(false);
    }
  };

  const isMonthInRange = (year: number, monthIndex: number): boolean => {
    if (!tempStartMonth) return false;

    const monthKey = formatMonthKey(year, monthIndex);
    const start = parseMonthKey(tempStartMonth);
    const current = parseMonthKey(monthKey);
    const end = tempEndMonth ? parseMonthKey(tempEndMonth) : (hoverMonth ? parseMonthKey(hoverMonth) : null);

    if (!start || !current) return false;

    const startDate = new Date(start.year, start.month - 1);
    const currentDate = new Date(current.year, current.month - 1);

    if (!end) {
      return currentDate.getTime() === startDate.getTime();
    }

    const endDate = new Date(end.year, end.month - 1);

    // Handle auto-correct preview
    const actualStart = startDate < endDate ? startDate : endDate;
    const actualEnd = startDate < endDate ? endDate : startDate;

    return currentDate >= actualStart && currentDate <= actualEnd;
  };

  const isMonthStart = (year: number, monthIndex: number): boolean => {
    if (!tempStartMonth) return false;
    const monthKey = formatMonthKey(year, monthIndex);
    
    if (!tempEndMonth && !hoverMonth) {
      return monthKey === tempStartMonth;
    }

    const start = parseMonthKey(tempStartMonth);
    const end = tempEndMonth ? parseMonthKey(tempEndMonth) : (hoverMonth ? parseMonthKey(hoverMonth) : null);
    
    if (!start || !end) return false;

    const startDate = new Date(start.year, start.month - 1);
    const endDate = new Date(end.year, end.month - 1);

    const actualStart = startDate < endDate ? tempStartMonth : (tempEndMonth || hoverMonth || tempStartMonth);

    return monthKey === actualStart;
  };

  const isMonthEnd = (year: number, monthIndex: number): boolean => {
    if (!tempStartMonth || (!tempEndMonth && !hoverMonth)) return false;

    const monthKey = formatMonthKey(year, monthIndex);
    const start = parseMonthKey(tempStartMonth);
    const end = tempEndMonth ? parseMonthKey(tempEndMonth) : (hoverMonth ? parseMonthKey(hoverMonth) : null);
    
    if (!start || !end) return false;

    const startDate = new Date(start.year, start.month - 1);
    const endDate = new Date(end.year, end.month - 1);

    const actualEnd = startDate < endDate ? (tempEndMonth || hoverMonth || tempStartMonth) : tempStartMonth;

    return monthKey === actualEnd;
  };

  const handleClear = () => {
    setTempStartMonth(null);
    setTempEndMonth(null);
    onChange(null, null);
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setTempStartMonth(startMonth);
    setTempEndMonth(endMonth);
    
    // Set current year to the start month's year or current year
    if (startMonth) {
      const parsed = parseMonthKey(startMonth);
      if (parsed) {
        setCurrentYear(parsed.year);
      }
    }
  };

  return (
    <div className="relative" ref={pickerRef}>
      {/* Input Field */}
      <div
        onClick={handleOpen}
        className={`flex items-center justify-between px-4 py-2.5 border rounded-xl transition-all ${
          disabled
            ? 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60'
            : `cursor-pointer hover:border-[#5B3BFA] ${error ? 'border-red-500' : 'border-gray-300'} ${isOpen ? 'border-[#5B3BFA] ring-2 ring-purple-100' : ''}`
        }`}
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className={`text-sm ${startMonth && endMonth ? 'text-gray-900' : 'text-gray-400'}`}>
            {getDisplayText()}
          </span>
        </div>
        {startMonth && endMonth && !disabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-3 h-3 text-gray-500" />
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {/* Popup */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-50"
          style={{ width: '420px' }}
        >
          {/* Year Navigation */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <button
              onClick={() => setCurrentYear(currentYear - 1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-lg font-bold text-gray-900">{currentYear}년</div>
            <button
              onClick={() => setCurrentYear(currentYear + 1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Month Grid */}
          <div className="p-4">
            {/* 3열 x 4행(12개월) 구조 */}
            <div className="grid grid-cols-3 gap-2">
              {months.map((month, index) => {
                const isInRange = isMonthInRange(currentYear, index);
                const isStart = isMonthStart(currentYear, index);
                const isEnd = isMonthEnd(currentYear, index);

                return (
                  <button
                    key={month}
                    onClick={() => handleMonthClick(currentYear, index)}
                    onMouseEnter={() => {
                      if (tempStartMonth && !tempEndMonth) {
                        setHoverMonth(formatMonthKey(currentYear, index));
                      }
                    }}
                    onMouseLeave={() => setHoverMonth(null)}
                    className={`
                      px-4 py-2 rounded-lg text-xs font-semibold transition-all
                      ${isStart || isEnd
                        ? 'text-white shadow-md'
                        : isInRange
                        ? 'bg-purple-100 text-[#5B3BFA]'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }
                    `}
                    style={
                      isStart || isEnd
                        ? {
                            background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                          }
                        : undefined
                    }
                  >
                    {monthsKo[index]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-xs text-gray-500">
              {tempStartMonth && !tempEndMonth && '종료 월을 선택하세요'}
              {tempStartMonth && tempEndMonth && '선택 완료'}
            </div>
            <button
              onClick={() => {
                setTempStartMonth(null);
                setTempEndMonth(null);
              }}
              className="text-xs text-gray-600 hover:text-gray-900 font-medium"
            >
              초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
}