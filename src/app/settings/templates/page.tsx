'use client';

import { useMode } from '../../context/ModeContext';
import { Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '../../components/ui/card';

// 사업장 공정활동데이터 스키마 컬럼 (Tier0Detail과 동일)
const PROCESS_ACTIVITY_SCHEMA_HEADERS = [
  '공정명',
  '투입 자재 카테고리',
  '투입자재명',
  '투입자재량',
  '투입 수량 단위',
  '자재 재활용 비율(%)',
  '투입 에너지 유형',
  '에너지 사용량',
  '에너지 단위',
  '운송유형',
  '운송수단',
  '제품 표준 중량',
  '순중량 실측치',
  '산출물(양품)',
  '손실량(Scrap)',
  '산출 폐기물',
  '배출계수',
];

function downloadProcessActivitySchemaExcel() {
  const BOM = '\uFEFF';
  const headerRow = PROCESS_ACTIVITY_SCHEMA_HEADERS.join(',');
  const csvContent = BOM + headerRow + '\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '사업장_공정활동데이터_스키마.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function TemplateManagementPage() {
  const { mode } = useMode();
  const isPcfView = mode === 'pcf';

  const handleDownloadSchema = () => {
    downloadProcessActivitySchemaExcel();
    toast.success('공정활동데이터 스키마 파일을 다운로드합니다');
  };

  if (!isPcfView) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">템플릿 관리</h1>
          <p className="text-gray-600">템플릿 관리는 ESG 직무에서만 이용할 수 있습니다</p>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-gray-500">우측 상단에서 &quot;ESG 직무&quot;로 전환하면 템플릿 관리 기능을 이용할 수 있습니다.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">템플릿 관리</h1>
        <p className="text-gray-600">사업장 데이터 입력용 템플릿을 다운로드합니다</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--aifix-secondary-light)' }}
            >
              <FileSpreadsheet className="w-6 h-6" style={{ color: 'var(--aifix-primary)' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">공정활동데이터 스키마</h3>
              <p className="text-sm text-gray-600">사업장의 공정활동데이터 입력 양식 (Excel/CSV)</p>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-[#5B3BFA] to-[#00B4FF] text-white px-4 py-3">
              <span className="text-sm font-semibold">포함 컬럼</span>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {PROCESS_ACTIVITY_SCHEMA_HEADERS.map((col, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={handleDownloadSchema}
            className="flex items-center gap-2 px-6 py-3 text-white font-medium rounded-xl transition-all hover:opacity-90"
            style={{
              background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
            }}
          >
            <Download className="w-5 h-5" />
            엑셀 템플릿 다운로드
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
