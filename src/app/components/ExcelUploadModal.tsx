import { useState } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ExcelUploadModalProps {
  onClose: () => void;
  onUpload?: () => void;
}

interface UploadResult {
  success: number;
  failed: number;
  errors: {
    row: number;
    field: string;
    message: string;
  }[];
}

export default function ExcelUploadModal({ onClose, onUpload }: ExcelUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel') {
        setSelectedFile(file);
      } else {
        toast.error('Excel 파일만 업로드 가능합니다 (.xlsx, .xls)');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('파일을 선택해주세요');
      return;
    }

    setUploading(true);

    // Mock upload process
    setTimeout(() => {
      // Mock result with some errors
      const mockResult: UploadResult = {
        success: 18,
        failed: 2,
        errors: [
          {
            row: 5,
            field: '자재코드',
            message: 'MAT-##### 형식이 아닙니다',
          },
          {
            row: 12,
            field: 'BOM ID',
            message: 'BOM-YYYY-### 형식이 아닙니다',
          },
        ],
      };

      setUploadResult(mockResult);
      setUploading(false);

      if (mockResult.failed === 0) {
        toast.success('모든 데이터가 성공적으로 업로드되었습니다');
      } else {
        toast.warning(`${mockResult.success}개 성공, ${mockResult.failed}개 실패`);
      }
    }, 2000);
  };

  const handleComplete = () => {
    if (uploadResult && uploadResult.failed === 0) {
      toast.success('업로드 완료');
      onUpload?.();
      onClose();
    } else {
      onClose();
    }
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
          <h3 className="text-2xl font-bold">엑셀 업로드</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!uploadResult ? (
            <>
              {/* File Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                  dragActive
                    ? 'border-[#5B3BFA] bg-[#5B3BFA] bg-opacity-5'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {selectedFile ? (
                  <div className="space-y-4">
                    <FileSpreadsheet className="w-16 h-16 mx-auto text-green-600" />
                    <div>
                      <div className="font-semibold text-lg">{selectedFile.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {(selectedFile.size / 1024).toFixed(2)} KB
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      파일 제거
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="w-16 h-16 mx-auto text-gray-400" />
                    <div>
                      <p className="text-lg font-medium mb-2">
                        파일을 드래그하거나 클릭하여 선택하세요
                      </p>
                      <p className="text-sm text-gray-500">Excel 파일 (.xlsx, .xls)</p>
                    </div>
                    <label className="inline-block">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <span className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium cursor-pointer transition-colors inline-block">
                        파일 선택
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Template Download */}
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="text-blue-600 mt-0.5">ℹ️</div>
                  <div className="flex-1">
                    <div className="font-semibold text-blue-900 mb-1">템플릿 다운로드</div>
                    <div className="text-sm text-blue-800 mb-2">
                      엑셀 업로드 형식에 맞춰 데이터를 입력하세요
                    </div>
                    <button className="text-sm text-blue-600 hover:text-blue-700 underline">
                      템플릿 다운로드
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Upload Result */}
              <div className="space-y-4">
                {/* Success/Failure Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="p-6 bg-green-50 border border-green-200 text-center"
                    style={{ borderRadius: '16px' }}
                  >
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-600" />
                    <div className="text-3xl font-bold text-green-900">{uploadResult.success}</div>
                    <div className="text-sm text-green-700 mt-1">성공</div>
                  </div>

                  <div
                    className="p-6 bg-red-50 border border-red-200 text-center"
                    style={{ borderRadius: '16px' }}
                  >
                    <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-600" />
                    <div className="text-3xl font-bold text-red-900">{uploadResult.failed}</div>
                    <div className="text-sm text-red-700 mt-1">실패</div>
                  </div>
                </div>

                {/* Error Details */}
                {uploadResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">오류 항목 미리보기</h4>
                    <div
                      className="border border-gray-200 rounded-xl overflow-hidden"
                      style={{ maxHeight: '300px', overflowY: 'auto' }}
                    >
                      <table className="w-full">
                        <thead className="bg-[#F6F8FB] sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold">행</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">필드</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold">오류 내용</th>
                          </tr>
                        </thead>
                        <tbody>
                          {uploadResult.errors.map((error, index) => (
                            <tr key={index} className="border-t border-gray-100">
                              <td className="px-4 py-3 text-sm">{error.row}</td>
                              <td className="px-4 py-3 text-sm font-medium">{error.field}</td>
                              <td className="px-4 py-3 text-sm text-red-600">{error.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Download Error Report */}
                {uploadResult.failed > 0 && (
                  <button className="w-full px-4 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">
                    오류 리포트 다운로드
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            {uploadResult ? '닫기' : '취소'}
          </button>
          
          {!uploadResult && (
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="px-6 py-3 text-white rounded-xl font-medium transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{
                background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
              }}
            >
              {uploading ? '업로드 중...' : '업로드'}
            </button>
          )}

          {uploadResult && uploadResult.failed === 0 && (
            <button
              onClick={handleComplete}
              className="px-6 py-3 text-white rounded-xl font-medium transition-all hover:scale-105"
              style={{
                background: 'linear-gradient(90deg, #5B3BFA 0%, #00B4FF 100%)',
                boxShadow: '0px 4px 12px rgba(91,59,250,0.2)',
              }}
            >
              완료
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
