import { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface QuarterRangePickerProps {
  startQuarter: string | null; // Format: "2026-Q1"
  endQuarter: string | null;   // Format: "2026-Q3"
  onChange: (start: string | null, end: string | null) => void;
  error?: string;
}

export default function QuarterRangePicker({ startQuarter, endQuarter, onChange, error }: QuarterRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [tempStartQuarter, setTempStartQuarter] = useState<string | null>(startQuarter);
  const [tempEndQuarter, setTempEndQuarter] = useState<string | null>(endQuarter);
  const [hoverQuarter, setHoverQuarter] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const quartersKo = ['1분기', '2분기', '3분기', '4분기'];

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

  const formatQuarterKey = (year: number, quarterIndex: number): string => {
    return `${year}-${quarters[quarterIndex]}`;
  };

  const parseQuarterKey = (key: string): { year: number; quarter: number } | null => {
    if (!key) return null;
    const match = key.match(/(\d{4})-Q(\d)/);
    if (!match) return null;
    return { year: parseInt(match[1]), quarter: parseInt(match[2]) };
  };

  const getDisplayText = (): string => {
    if (!startQuarter || !endQuarter) {
      return '분기를 선택하세요';
    }
    const start = parseQuarterKey(startQuarter);
    const end = parseQuarterKey(endQuarter);
    if (!start || !end) return '분기를 선택하세요';
    
    return `${start.year}년 Q${start.quarter} ~ ${end.year}년 Q${end.quarter}`;
  };

  const handleQuarterClick = (year: number, quarterIndex: number) => {
    const quarterKey = formatQuarterKey(year, quarterIndex);

    if (!tempStartQuarter || tempEndQuarter) {
      // Start new selection
      setTempStartQuarter(quarterKey);
      setTempEndQuarter(null);
    } else {
      // Complete selection
      const start = parseQuarterKey(tempStartQuarter);
      const end = parseQuarterKey(quarterKey);

      if (!start || !end) return;

      // Auto-correct if end is before start
      const startValue = start.year * 10 + start.quarter;
      const endValue = end.year * 10 + end.quarter;

      if (endValue < startValue) {
        // Swap
        setTempStartQuarter(quarterKey);
        setTempEndQuarter(tempStartQuarter);
        onChange(quarterKey, tempStartQuarter);
      } else {
        setTempStartQuarter(tempStartQuarter);
        setTempEndQuarter(quarterKey);
        onChange(tempStartQuarter, quarterKey);
      }

      // Close picker
      setIsOpen(false);
    }
  };

  const isQuarterInRange = (year: number, quarterIndex: number): boolean => {
    if (!tempStartQuarter) return false;

    const quarterKey = formatQuarterKey(year, quarterIndex);
    const start = parseQuarterKey(tempStartQuarter);
    const current = parseQuarterKey(quarterKey);
    const end = tempEndQuarter ? parseQuarterKey(tempEndQuarter) : (hoverQuarter ? parseQuarterKey(hoverQuarter) : null);

    if (!start || !current) return false;

    const startValue = start.year * 10 + start.quarter;
    const currentValue = current.year * 10 + current.quarter;

    if (!end) {
      return currentValue === startValue;
    }

    const endValue = end.year * 10 + end.quarter;

    // Handle auto-correct preview
    const actualStart = startValue < endValue ? startValue : endValue;
    const actualEnd = startValue < endValue ? endValue : startValue;

    return currentValue >= actualStart && currentValue <= actualEnd;
  };

  const isQuarterStart = (year: number, quarterIndex: number): boolean => {
    if (!tempStartQuarter) return false;
    const quarterKey = formatQuarterKey(year, quarterIndex);
    
    if (!tempEndQuarter && !hoverQuarter) {
      return quarterKey === tempStartQuarter;
    }

    const start = parseQuarterKey(tempStartQuarter);
    const end = tempEndQuarter ? parseQuarterKey(tempEndQuarter) : (hoverQuarter ? parseQuarterKey(hoverQuarter) : null);
    
    if (!start || !end) return false;

    const startValue = start.year * 10 + start.quarter;
    const endValue = end.year * 10 + end.quarter;

    const actualStart = startValue < endValue ? tempStartQuarter : (tempEndQuarter || hoverQuarter || tempStartQuarter);

    return quarterKey === actualStart;
  };

  const isQuarterEnd = (year: number, quarterIndex: number): boolean => {
    if (!tempStartQuarter || (!tempEndQuarter && !hoverQuarter)) return false;

    const quarterKey = formatQuarterKey(year, quarterIndex);
    const start = parseQuarterKey(tempStartQuarter);
    const end = tempEndQuarter ? parseQuarterKey(tempEndQuarter) : (hoverQuarter ? parseQuarterKey(hoverQuarter) : null);
    
    if (!start || !end) return false;

    const startValue = start.year * 10 + start.quarter;
    const endValue = end.year * 10 + end.quarter;

    const actualEnd = startValue < endValue ? (tempEndQuarter || hoverQuarter || tempStartQuarter) : tempStartQuarter;

    return quarterKey === actualEnd;
  };

  const handleClear = () => {
    setTempStartQuarter(null);
    setTempEndQuarter(null);
    onChange(null, null);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setTempStartQuarter(startQuarter);
    setTempEndQuarter(endQuarter);
    
    // Set current year to the start quarter's year or current year
    if (startQuarter) {
      const parsed = parseQuarterKey(startQuarter);
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
        className={`flex items-center justify-between px-4 py-2.5 border rounded-xl cursor-pointer transition-all hover:border-[#5B3BFA] ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${isOpen ? 'border-[#5B3BFA] ring-2 ring-purple-100' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className={`text-sm ${startQuarter && endQuarter ? 'text-gray-900' : 'text-gray-400'}`}>
            {getDisplayText()}
          </span>
        </div>
        {startQuarter && endQuarter && (
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
          style={{ width: '360px' }}
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

          {/* Quarter Grid */}
          <div className="p-4">
            <div className="grid grid-cols-2 gap-3">
              {quarters.map((quarter, index) => {
                const isInRange = isQuarterInRange(currentYear, index);
                const isStart = isQuarterStart(currentYear, index);
                const isEnd = isQuarterEnd(currentYear, index);

                return (
                  <button
                    key={quarter}
                    onClick={() => handleQuarterClick(currentYear, index)}
                    onMouseEnter={() => {
                      if (tempStartQuarter && !tempEndQuarter) {
                        setHoverQuarter(formatQuarterKey(currentYear, index));
                      }
                    }}
                    onMouseLeave={() => setHoverQuarter(null)}
                    className={`
                      px-6 py-4 rounded-lg text-sm font-medium transition-all
                      ${isStart || isEnd
                        ? 'bg-[#5B3BFA] text-white shadow-md'
                        : isInRange
                        ? 'bg-purple-100 text-[#5B3BFA]'
                        : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <div className="text-xs mb-1 opacity-70">{quarter}</div>
                    <div className="font-semibold">{quartersKo[index]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 flex justify-between items-center">
            <div className="text-xs text-gray-500">
              {tempStartQuarter && !tempEndQuarter && '종료 분기를 선택하세요'}
              {tempStartQuarter && tempEndQuarter && '선택 완료'}
            </div>
            <button
              onClick={() => {
                setTempStartQuarter(null);
                setTempEndQuarter(null);
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
