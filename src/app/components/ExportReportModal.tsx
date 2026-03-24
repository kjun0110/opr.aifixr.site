import { useState } from 'react';
import { X, FileText, FileSpreadsheet } from 'lucide-react';

interface ExportReportModalProps {
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
}

interface ExportOptions {
  format: 'excel' | 'pdf';
  includeQueryConditions: boolean;
  includeResultTable: boolean;
  includeSupplyChainMap: boolean;
  template: 'internal' | 'customer';
}

export default function ExportReportModal({ onClose, onExport }: ExportReportModalProps) {
  const [format, setFormat] = useState<'excel' | 'pdf'>('excel');
  const [includeQueryConditions, setIncludeQueryConditions] = useState(true);
  const [includeResultTable, setIncludeResultTable] = useState(true);
  const [includeSupplyChainMap, setIncludeSupplyChainMap] = useState(false);
  const [template, setTemplate] = useState<'internal' | 'customer'>('internal');

  const handleExport = () => {
    onExport({
      format,
      includeQueryConditions,
      includeResultTable,
      includeSupplyChainMap,
      template,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white w-full max-w-2xl"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-2xl font-bold">보고서 내보내기</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-semibold mb-3">출력 형식</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setFormat('excel')}
                className={`p-4 border-2 rounded-xl transition-all flex items-center gap-3 ${
                  format === 'excel'
                    ? 'border-[#5B3BFA] bg-[#5B3BFA] bg-opacity-5'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileSpreadsheet
                  className={`w-6 h-6 ${format === 'excel' ? 'text-[#5B3BFA]' : 'text-gray-600'}`}
                />
                <div className="text-left">
                  <div className="font-semibold">Excel</div>
                  <div className="text-xs text-gray-500">.xlsx 형식</div>
                </div>
              </button>

              <button
                onClick={() => setFormat('pdf')}
                className={`p-4 border-2 rounded-xl transition-all flex items-center gap-3 ${
                  format === 'pdf'
                    ? 'border-[#5B3BFA] bg-[#5B3BFA] bg-opacity-5'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileText
                  className={`w-6 h-6 ${format === 'pdf' ? 'text-[#5B3BFA]' : 'text-gray-600'}`}
                />
                <div className="text-left">
                  <div className="font-semibold">PDF</div>
                  <div className="text-xs text-gray-500">.pdf 형식</div>
                </div>
              </button>
            </div>
          </div>

          {/* Include Options */}
          <div>
            <label className="block text-sm font-semibold mb-3">포함 옵션</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeQueryConditions}
                  onChange={(e) => setIncludeQueryConditions(e.target.checked)}
                  className="w-5 h-5 text-[#5B3BFA] rounded focus:ring-[#5B3BFA]"
                />
                <div>
                  <div className="font-medium">조회 조건 요약</div>
                  <div className="text-sm text-gray-500">선택한 필터 조건을 보고서에 포함합니다</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeResultTable}
                  onChange={(e) => setIncludeResultTable(e.target.checked)}
                  className="w-5 h-5 text-[#5B3BFA] rounded focus:ring-[#5B3BFA]"
                />
                <div>
                  <div className="font-medium">결과 테이블</div>
                  <div className="text-sm text-gray-500">현재 컬럼 구성 유지하여 결과를 포함합니다</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSupplyChainMap}
                  onChange={(e) => setIncludeSupplyChainMap(e.target.checked)}
                  className="w-5 h-5 text-[#5B3BFA] rounded focus:ring-[#5B3BFA]"
                />
                <div>
                  <div className="font-medium">공급망 MAP 포함</div>
                  <div className="text-sm text-gray-500">선택한 공급망 버전의 스냅샷을 포함합니다</div>
                </div>
              </label>
            </div>
          </div>

          {/* Template Selection */}
          <div>
            <label className="block text-sm font-semibold mb-3">출력 템플릿 선택</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTemplate('internal')}
                className={`p-4 border-2 rounded-xl transition-all text-left ${
                  template === 'internal'
                    ? 'border-[#5B3BFA] bg-[#5B3BFA] bg-opacity-5'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="font-semibold mb-1">내부 보고용</div>
                <div className="text-xs text-gray-500">전체 정보 포함</div>
              </button>

              <button
                onClick={() => setTemplate('customer')}
                className={`p-4 border-2 rounded-xl transition-all text-left ${
                  template === 'customer'
                    ? 'border-[#5B3BFA] bg-[#5B3BFA] bg-opacity-5'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="font-semibold mb-1">고객사 공유용</div>
                <div className="text-xs text-gray-500">민감정보 자동 마스킹</div>
              </button>
            </div>
          </div>

          {/* Warning */}
          {template === 'customer' && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="flex gap-3">
                <div className="text-yellow-600 mt-0.5">⚠️</div>
                <div className="text-sm text-yellow-800">
                  <div className="font-semibold mb-1">고객사 공유용 템플릿</div>
                  <div>Tax ID, DUNS 등 민감정보가 자동으로 마스킹됩니다.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleExport}
            className="px-6 py-3 text-white rounded-xl font-medium transition-all hover:scale-105"
            style={{
              background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
              boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
            }}
          >
            내보내기
          </button>
        </div>
      </div>
    </div>
  );
}
