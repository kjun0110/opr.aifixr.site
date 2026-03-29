'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Lock } from 'lucide-react';
import { restoreOprSessionFromCookie } from '@/lib/api/client';
import {
  getOprGoogleLinkAuthUrl,
  loginOprAndStoreSession,
  OprLoginFailedError,
} from '@/lib/api/auth';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!email) {
      setEmailError(true);
      return;
    }
    if (!password) {
      setPasswordError(true);
      return;
    }

    setSubmitting(true);
    try {
      await loginOprAndStoreSession(email, password);
      // Gmail OAuth는 호출하지 않음. 연동은 초대 발송 428 또는 아래 SSO 버튼에서만 진행.
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof OprLoginFailedError) {
        setLoginError(err.message);
      } else {
        setLoginError(
          err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** 회사 Google 계정 연동(Gmail 발송). 리프레시 쿠키가 있으면 비밀번호 없이 진행 가능 */
  const handleSSOLogin = async () => {
    setLoginError(null);
    setSubmitting(true);
    try {
      const restored = await restoreOprSessionFromCookie();
      if (!restored) {
        setLoginError(
          'Google 연동을 시작하려면 먼저 이메일·비밀번호로 로그인해 주세요.',
        );
        return;
      }
      const authUrl = await getOprGoogleLinkAuthUrl();
      window.location.assign(authUrl);
    } catch (e) {
      setLoginError(
        e instanceof Error ? e.message : 'Google 연동을 시작할 수 없습니다.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 좌측 브랜딩 영역 */}
      <div 
        className="flex-1 flex flex-col justify-center items-center p-12"
        style={{
          background: 'linear-gradient(135deg, #5B3BFA 0%, #00B4FF 100%)',
        }}
      >
        <div className="max-w-md text-white">
          <div className="flex items-center gap-3 mb-6">
            <Building2 size={48} strokeWidth={1.5} />
            <h1 className="text-5xl font-bold tracking-tight">AIFIX</h1>
          </div>
          <p className="text-xl mb-4 opacity-95">AI 기반 공급망 관리 플랫폼</p>
          <p className="text-base opacity-80 leading-relaxed">
            ESG 데이터 수집부터 공급망 분석까지,<br />
            스마트한 공급망 관리의 시작
          </p>
        </div>
      </div>

      {/* 우측 로그인 카드 */}
      <div className="flex-1 flex items-center justify-center p-12 bg-gray-50">
        <div 
          className="w-full max-w-md bg-white p-10"
          style={{
            borderRadius: '20px',
            boxShadow: '0px 4px 16px rgba(0,0,0,0.05)',
          }}
        >
          <h2 className="text-2xl font-bold mb-2">로그인</h2>
          <p className="text-gray-600 text-sm mb-8">구매직무 관리자 계정으로 로그인하세요</p>

          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                {loginError}
              </p>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(false);
                  }}
                  placeholder="이메일을 입력하세요"
                  className={`w-full pl-12 pr-4 py-3 border ${
                    emailError ? 'border-red-500' : 'border-gray-300'
                  } rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  autoComplete="email"
                  disabled={submitting}
                />
              </div>
              {emailError && (
                <p className="text-red-500 text-xs mt-1">이메일을 입력해주세요</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  placeholder="비밀번호를 입력하세요"
                  className={`w-full pl-12 pr-4 py-3 border ${
                    passwordError ? 'border-red-500' : 'border-gray-300'
                  } rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500`}
                  autoComplete="current-password"
                  disabled={submitting}
                />
              </div>
              {passwordError && (
                <p className="text-red-500 text-xs mt-1">비밀번호를 입력해주세요</p>
              )}
            </div>

            <button
              type="submit"
              disabled={!email || !password || submitting}
              className="w-full py-3 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: email && password && !submitting ? 'linear-gradient(90deg, #5B3BFA, #00B4FF)' : '#e5e7eb',
                borderRadius: '14px',
              }}
            >
              {submitting ? '로그인 중…' : '로그인'}
            </button>

            <div className="text-center">
              <a href="#" className="text-sm text-purple-600 hover:underline">
                비밀번호 찾기
              </a>
            </div>
          </form>

          {/* form 밖: 일부 환경에서 보조 버튼이 submit으로 처리되는 경우 방지 */}
          <button
            type="button"
            onClick={handleSSOLogin}
            disabled={submitting}
            className="w-full mt-5 py-3 text-gray-700 font-medium border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
            style={{ borderRadius: '14px' }}
          >
            회사 계정으로 로그인 (SSO)
          </button>

          <p className="text-xs text-gray-500 mt-6 text-center">
            본 시스템은 원청사 구매직무 전용입니다
          </p>
        </div>
      </div>
    </div>
  );
}