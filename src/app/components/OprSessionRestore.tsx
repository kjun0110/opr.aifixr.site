'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { restoreOprSessionFromCookie, AIFIXR_SESSION_UPDATED_EVENT } from '@/lib/api/client';

/**
 * 새로고침 후 HttpOnly 리프레시 쿠키로 액세스 토큰·actor 를 복구합니다.
 * 로그인 전(/)에서는 쿠키가 없어 refresh 가 항상 401 이므로 호출하지 않습니다.
 */
export default function OprSessionRestore() {
  const pathname = usePathname();
  const router = useRouter();
  const ran = useRef(false);

  useEffect(() => {
    if (pathname === '/' || pathname === '') {
      ran.current = false;
      return;
    }
    if (ran.current) return;
    ran.current = true;
    void restoreOprSessionFromCookie().then((ok) => {
      if (ok && typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AIFIXR_SESSION_UPDATED_EVENT));
      } else if (!ok && pathname.startsWith('/dashboard')) {
        // 세션 복구 실패 시 로그인 페이지로 리다이렉트
        router.push('/');
      }
    });
  }, [pathname, router]);

  return null;
}
