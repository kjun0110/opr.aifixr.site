'use client';

import Link from 'next/link';
import { Bell, Shield, Globe, User, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { useMode } from '../context/ModeContext';

export default function SettingsPage() {
  const { mode } = useMode();
  const isPcfView = mode === 'pcf';
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1">설정</h1>
        <p className="text-gray-600">계정 및 시스템 설정을 관리합니다</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--aifix-secondary-light)' }}
              >
                <User className="w-6 h-6" style={{ color: 'var(--aifix-primary)' }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">계정 설정</h3>
                <p className="text-sm text-gray-600">사용자 프로필</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link href="/settings/notifications" className="block">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--aifix-secondary-light)' }}
                >
                  <Bell className="w-6 h-6" style={{ color: 'var(--aifix-primary)' }} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">알림 설정</h3>
                  <p className="text-sm text-gray-600">이메일/Slack 알림 연동</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--aifix-secondary-light)' }}
              >
                <Shield className="w-6 h-6" style={{ color: 'var(--aifix-primary)' }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">보안 설정</h3>
                <p className="text-sm text-gray-600">2단계 인증, 접근 권한 관리</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--aifix-secondary-light)' }}
              >
                <Globe className="w-6 h-6" style={{ color: 'var(--aifix-primary)' }} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">언어 및 지역</h3>
                <p className="text-sm text-gray-600">표시 언어, 시간대, 날짜 형식</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isPcfView && (
          <Link href="/settings/templates" className="block">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: 'var(--aifix-secondary-light)' }}
                  >
                    <FileSpreadsheet className="w-6 h-6" style={{ color: 'var(--aifix-primary)' }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">템플릿 관리</h3>
                    <p className="text-sm text-gray-600">공정활동데이터 스키마 엑셀 템플릿 다운로드</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>
    </div>
  );
}

