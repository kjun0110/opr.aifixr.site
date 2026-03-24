import { Users, Send, CheckCircle, AlertCircle, TrendingUp, Building, Calendar } from 'lucide-react';

export default function Dashboard() {
  const kpiCards = [
    {
      title: '등록된 1차 협력사',
      value: '124',
      unit: '개사',
      icon: Users,
      color: 'from-purple-500 to-purple-600',
    },
    {
      title: '초대 발송',
      value: '156',
      unit: '건',
      subtitle: '미가입: 32건',
      icon: Send,
      color: 'from-cyan-500 to-cyan-600',
    },
    {
      title: '데이터 제출 완료율',
      value: '87.3',
      unit: '%',
      icon: CheckCircle,
      color: 'from-teal-500 to-teal-600',
    },
    {
      title: '공급망 변동 발생',
      value: '12',
      unit: '건',
      subtitle: '최근 30일',
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
    },
  ];

  const suppliers = [
    { company: '(주)테크노소재', tier: '1차', inviteDate: '2026.02.15', joined: true, dataStatus: '완료', lastUpdate: '2026.03.01' },
    { company: '글로벌파트너스', tier: '1차', inviteDate: '2026.02.18', joined: true, dataStatus: '진행중', lastUpdate: '2026.02.28' },
    { company: '신소재산업(주)', tier: '1차', inviteDate: '2026.02.20', joined: true, dataStatus: '완료', lastUpdate: '2026.03.02' },
    { company: '한국부품제조', tier: '1차', inviteDate: '2026.02.22', joined: false, dataStatus: '미응답', lastUpdate: '-' },
    { company: '아시아컴포넌트', tier: '1차', inviteDate: '2026.02.25', joined: true, dataStatus: '진행중', lastUpdate: '2026.03.01' },
    { company: '(주)녹색소재', tier: '1차', inviteDate: '2026.02.28', joined: false, dataStatus: '미응답', lastUpdate: '-' },
  ];

  const notifications = [
    { type: 'success', title: '신규 데이터 제출', message: '(주)테크노소재의 2026년 2월 데이터가 제출되었습니다.', time: '10분 전' },
    { type: 'warning', title: '동의서 미동의', message: '한국부품제조의 제3자 제공 동의서 동의가 필요합니다.', time: '2시간 전' },
    { type: 'info', title: '계약 만료 예정', message: '글로벌파트너스의 계약이 15일 후 만료됩니다.', time: '1일 전' },
  ];

  const getStatusBadge = (status: string) => {
    const styles = {
      '완료': 'bg-teal-100 text-teal-700',
      '진행중': 'bg-purple-100 text-purple-700',
      '미응답': 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">대시보드</h1>
        <p className="text-gray-600">공급망 관리 현황을 한눈에 확인하세요</p>
      </div>

      {/* KPI 카드 영역 */}
      <div className="grid grid-cols-4 gap-6">
        {kpiCards.map((card, index) => (
          <div
            key={index}
            className="bg-white p-6 relative overflow-hidden"
            style={{
              borderRadius: '20px',
              boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
            }}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600 font-medium">{card.title}</p>
                <div className={`p-2 rounded-xl bg-gradient-to-br ${card.color} opacity-20`}>
                  <card.icon size={20} className="text-white" />
                </div>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-4xl font-bold text-gray-900">{card.value}</span>
                <span className="text-lg text-gray-500">{card.unit}</span>
              </div>
              {card.subtitle && (
                <p className="text-xs text-gray-500">{card.subtitle}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 공급망 구조 현황 */}
        <div
          className="bg-white p-6"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">공급망 구조 현황</h2>
            <Building className="text-gray-400" size={20} />
          </div>

          <div className="space-y-4">
            {[
              { product: '전기차 배터리 모듈', tier1: 8, tier2: 24 },
              { product: '디스플레이 패널', tier1: 5, tier2: 15 },
              { product: '반도체 칩', tier1: 6, tier2: 18 },
            ].map((item, idx) => (
              <div key={idx} className="pb-4 border-b border-gray-100 last:border-0">
                <p className="font-medium text-gray-900 mb-2">{item.product}</p>
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-600">1차: <strong>{item.tier1}</strong>개사</span>
                  <span className="text-gray-600">2차: <strong>{item.tier2}</strong>개사</span>
                </div>
              </div>
            ))}
          </div>

          <button
            className="mt-6 w-full py-2.5 text-center text-white font-medium"
            style={{
              background: 'linear-gradient(90deg, #5B3BFA, #00B4FF)',
              borderRadius: '12px',
            }}
          >
            공급망 상세 보기
          </button>
        </div>

        {/* 알림 영역 */}
        <div
          className="col-span-2 bg-white p-6"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-gray-900">최근 알림</h2>
            <AlertCircle className="text-gray-400" size={20} />
          </div>

          <div className="space-y-4">
            {notifications.map((notif, idx) => (
              <div key={idx} className="flex gap-4 p-4 bg-gray-50 rounded-xl">
                <div className={`
                  w-2 h-2 rounded-full mt-2 flex-shrink-0
                  ${notif.type === 'success' ? 'bg-teal-500' : ''}
                  ${notif.type === 'warning' ? 'bg-orange-500' : ''}
                  ${notif.type === 'info' ? 'bg-blue-500' : ''}
                `}></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 text-sm">{notif.title}</p>
                    <span className="text-xs text-gray-500">{notif.time}</span>
                  </div>
                  <p className="text-sm text-gray-600">{notif.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 협력사 온보딩 진행 현황 테이블 */}
      <div
        className="bg-white p-6"
        style={{
          borderRadius: '20px',
          boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-gray-900">협력사 온보딩 진행 현황</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar size={16} />
            <span>최근 30일</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">회사명</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">차수</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">초대일</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">가입 여부</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">데이터 제출 상태</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">마지막 수정일</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-4 text-sm font-medium text-gray-900">{supplier.company}</td>
                  <td className="py-4 px-4 text-sm text-gray-600">{supplier.tier}</td>
                  <td className="py-4 px-4 text-sm text-gray-600">{supplier.inviteDate}</td>
                  <td className="py-4 px-4 text-sm">
                    {supplier.joined ? (
                      <span className="text-teal-600 flex items-center gap-1">
                        <CheckCircle size={14} />
                        가입완료
                      </span>
                    ) : (
                      <span className="text-gray-400">미가입</span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-sm">{getStatusBadge(supplier.dataStatus)}</td>
                  <td className="py-4 px-4 text-sm text-gray-600">{supplier.lastUpdate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
