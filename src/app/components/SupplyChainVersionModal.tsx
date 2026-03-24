import { useState } from 'react';
import { X, ChevronRight, Network, Calendar, Users, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SupplyChainGroup {
  id: string;
  groupCode: string;
  groupName: string;
  productId: string;
}

interface SupplyChainVersion {
  id: string;
  groupId: string;
  versionCode: string;
  versionNumber: string;
  baseDate: string;
  isStructureChanged: boolean;
  changeType: 'structure-created' | 'info-modified' | 'structure-changed';
  changeReason: string;
  supplierCount: number;
  status: 'active' | 'inactive';
}

interface SupplyChainVersionModalProps {
  groups: SupplyChainGroup[];
  versions: SupplyChainVersion[];
  appliedVersion: SupplyChainVersion;
  onSelect: (version: SupplyChainVersion) => void;
  onClose: () => void;
}

export default function SupplyChainVersionModal({
  groups,
  versions,
  appliedVersion,
  onSelect,
  onClose,
}: SupplyChainVersionModalProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');

  // Filter versions by selected group
  const filteredVersions = versions.filter(v => v.groupId === selectedGroupId);

  // Get change type label and color
  const getChangeTypeInfo = (changeType: SupplyChainVersion['changeType']) => {
    switch (changeType) {
      case 'structure-created':
        return { label: '구조 생성', color: 'bg-blue-100 text-blue-700' };
      case 'structure-changed':
        return { label: '구조 변경', color: 'bg-red-100 text-red-700' };
      case 'info-modified':
        return { label: '정보 수정', color: 'bg-gray-100 text-gray-700' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{
          borderRadius: '20px',
        }}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">공급망 버전 선택</h2>
            <p className="text-sm text-gray-600 mt-1">
              적용할 공급망 버전을 선택하세요. 선택 시 조회 결과에 해당 버전의 공급망 구조가 적용됩니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Left-Right Panel Structure */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Supply Chain Groups */}
          <div className="w-80 border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Network className="w-4 h-4 text-[#5B3BFA]" />
                공급망 그룹 목록
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {groups.map(group => {
                const groupVersions = versions.filter(v => v.groupId === group.id);
                const isSelected = selectedGroupId === group.id;

                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroupId(group.id)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#5B3BFA] bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-bold text-[#5B3BFA]">{group.groupCode}</div>
                        <div className="text-sm text-gray-700 font-medium mt-1">{group.groupName}</div>
                      </div>
                      {isSelected && (
                        <ChevronRight className="w-5 h-5 text-[#5B3BFA]" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {groupVersions.length}개 버전
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel - Version Timeline */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#5B3BFA]" />
                버전 타임라인
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {filteredVersions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>해당 그룹의 버전이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredVersions.map((version, index) => {
                    const isSelected = version.id === appliedVersion.id;
                    const changeTypeInfo = getChangeTypeInfo(version.changeType);

                    return (
                      <div
                        key={version.id}
                        className={`p-5 border-2 rounded-xl transition-all ${
                          isSelected
                            ? 'border-[#5B3BFA] bg-purple-50 shadow-md'
                            : 'border-gray-200 hover:border-purple-300 hover:shadow-sm'
                        }`}
                      >
                        {/* Version Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-2xl font-bold text-[#5B3BFA]">
                                {version.versionNumber}
                              </span>
                              <span className="text-lg font-semibold text-gray-700">
                                ({version.versionCode})
                              </span>
                              
                              {isSelected && (
                                <span className="px-3 py-1 bg-[#5B3BFA] text-white rounded-full text-xs font-bold flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  적용중
                                </span>
                              )}
                              
                              {version.status === 'active' && !isSelected && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  활성
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Version Details Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="text-xs text-gray-600 mb-1">생성일</div>
                            <div className="font-medium text-sm">{version.baseDate}</div>
                          </div>
                          
                          <div>
                            <div className="text-xs text-gray-600 mb-1">협력사 수</div>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-[#5B3BFA]" />
                              <span className="font-bold text-[#5B3BFA]">{version.supplierCount}개</span>
                            </div>
                          </div>
                        </div>

                        {/* Change Type & Reason */}
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-600">변경 유형:</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${changeTypeInfo.color}`}>
                              {changeTypeInfo.label}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700">
                            <span className="text-gray-600">생성 사유:</span>{' '}
                            <span className="font-medium">{version.changeReason}</span>
                          </div>
                        </div>

                        {/* Structure Change Badge */}
                        {version.isStructureChanged && (
                          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center gap-2 text-yellow-700">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-xs font-medium">구조 변경이 포함된 버전입니다</span>
                            </div>
                          </div>
                        )}

                        {/* Action Button */}
                        <button
                          onClick={() => {
                            onSelect(version);
                            toast.success(`공급망 버전 ${version.versionCode}이(가) 적용되었습니다`);
                            onClose();
                          }}
                          className={`w-full px-4 py-2.5 text-sm rounded-lg font-medium transition-all ${
                            isSelected
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-[#5B3BFA] text-white hover:bg-[#4830c7] hover:scale-105'
                          }`}
                          disabled={isSelected}
                        >
                          {isSelected ? '현재 적용중인 버전' : '이 버전 선택'}
                        </button>

                        {/* Timeline Connection (not for last item) */}
                        {index < filteredVersions.length - 1 && (
                          <div className="flex justify-center mt-4">
                            <div className="w-px h-8 bg-gray-300"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-orange-600">※ 주의:</span> 수동으로 버전을 선택하면 자동 매칭이 해제됩니다.
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
