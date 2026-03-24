'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Building2, Bell, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { useMode } from '../context/ModeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { mode, toggleMode, isPurchasePerspectiveLocked } = useMode();
  const pathname = usePathname();
  const router = useRouter();
  
  // Base navigation items (always visible)
  const baseNavItems = [
    { path: '/dashboard', label: '대시보드' },
    { path: '/dashboard/invite', label: '초대' },
    { path: '/dashboard/data-view', label: '데이터 관리' },
    { path: '/dashboard/simulation', label: '시뮬레이션' },
    { path: '/dashboard/data-contract', label: '제3자 제공 동의서' },
    { path: '/dashboard/certification', label: '인증 관리' },
  ];

  // Procurement-only navigation items (프로젝트/공급망은 대시보드 바로 다음에 위치)
  const procurementNavItems = [
    { path: '/dashboard/project-supply-chain', label: '프로젝트 / 공급망' },
  ];

  // PCF-only navigation items
  const pcfNavItems = [
    { path: '/dashboard/pcf-calculation', label: 'PCF 산정' },
  ];

  // Combine nav items based on mode (PCF 산정 탭은 항상 노출, 구매 직무에서 클릭 시 블러)
  const navItems = mode === 'pcf' 
    ? [baseNavItems[0], { path: '/dashboard/project-supply-chain', label: '프로젝트 / 공급망' }, ...baseNavItems.slice(1, 3), ...pcfNavItems, ...baseNavItems.slice(3)]
    : [baseNavItems[0], ...procurementNavItems, ...baseNavItems.slice(1, 3), ...pcfNavItems, ...baseNavItems.slice(3)];
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 네비게이션 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8">
          <div className="flex items-center justify-between h-20">
            {/* 로고 */}
            <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
              <Building2 size={32} className="text-purple-600" strokeWidth={2} />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-cyan-500 bg-clip-text text-transparent">
                AIFIX
              </h1>
            </Link>

            {/* 네비게이션 탭 */}
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.path === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`px-6 py-3 text-base font-medium transition-all rounded-xl ${
                      isActive
                        ? 'text-purple-600 bg-purple-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* 우측 유틸리티 */}
            <div className="flex items-center gap-4">
              {/* 직무 모드 토글 */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => mode !== 'procurement' && toggleMode()}
                  className={`px-4 py-2 rounded-md text-base font-medium transition-all ${
                    mode === 'procurement'
                      ? 'bg-white text-[#5B3BFA] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  } ${isPurchasePerspectiveLocked ? 'cursor-default' : ''}`}
                >
                  구매 직무
                </button>
                <div className="w-px h-4 bg-gray-300 mx-1"></div>
                <button
                  type="button"
                  onClick={() => mode !== 'pcf' && toggleMode()}
                  disabled={isPurchasePerspectiveLocked}
                  title={
                    isPurchasePerspectiveLocked
                      ? '구매 직무 계정은 ESG 직무로 전환할 수 없습니다.'
                      : undefined
                  }
                  className={`px-4 py-2 rounded-md text-base font-medium transition-all ${
                    mode === 'pcf'
                      ? 'bg-white text-[#00B4FF] shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  } ${
                    isPurchasePerspectiveLocked
                      ? 'opacity-50 cursor-not-allowed text-gray-400 hover:text-gray-400'
                      : ''
                  }`}
                >
                  ESG 직무
                </button>
              </div>

              <Link
                href="/dashboard/notifications"
                className="p-2.5 hover:bg-gray-100 rounded-lg transition-all relative"
              >
                <Bell size={22} className="text-gray-600" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </Link>
              <Link
                href="/settings"
                className="p-2.5 hover:bg-gray-100 rounded-lg transition-all"
                aria-label="설정으로 이동"
              >
                <SettingsIcon size={22} className="text-gray-600" />
              </Link>

              {/* 계정 정보 (원청사명/사용자명 + 아바타) */}
              <div className="flex items-center gap-3 ml-2">
                <div className="text-right">
                  <div className="font-semibold text-gray-900 text-base">원청사명</div>
                  <div className="text-sm text-gray-500">사용자명</div>
                </div>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
                      aria-label="계정 메뉴"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => router.push('/')}
                      className="cursor-pointer"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      로그아웃
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 메인 컨텐츠 */}
      <main className={`max-w-[1600px] mx-auto px-8 py-12 relative ${pathname.startsWith('/dashboard/pcf-calculation') && mode === 'procurement' ? 'blur-sm pointer-events-none select-none min-h-[400px]' : ''}`}>
        {pathname.startsWith('/dashboard/pcf-calculation') && mode === 'procurement' && (
          <div className="absolute inset-0 z-10 flex items-start justify-center pt-20 pointer-events-auto">
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-l-4 border-[#5B3BFA] p-6 rounded-xl shadow-lg max-w-md">
              <h3 className="font-semibold text-[#5B3BFA] mb-2">구매 직무 - PCF 산정 접근 제한</h3>
              <p className="text-sm text-gray-700">
                {isPurchasePerspectiveLocked ? (
                  <>
                    구매 직무로 등록된 계정은 PCF 산정 화면을 사용할 수 없습니다. 이 화면은
                    ESG 직무 계정에서만 이용 가능합니다.
                  </>
                ) : (
                  <>
                    PCF 산정 화면은 ESG 직무에서만 사용할 수 있습니다.
                    우측 상단에서 &quot;ESG 직무&quot;로 전환하면 이 화면을 이용할 수 있습니다.
                  </>
                )}
              </p>
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}