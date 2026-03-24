'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import {
  AIFIXR_SESSION_UPDATED_EVENT,
  OPR_DEPARTMENT_STORAGE_KEY,
} from '@/lib/api/client';

export type JobMode = 'procurement' | 'pcf';

/** DB `opr_profiles.department === 'purchase'` 인 계정: PCF 관점 전환 불가 */
export function readPurchasePerspectiveLocked(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(OPR_DEPARTMENT_STORAGE_KEY) === 'purchase';
}

interface ModeContextType {
  mode: JobMode;
  setMode: (mode: JobMode) => void;
  toggleMode: () => void;
  /** 구매 직무 계정이면 true — 토글로 PCF 관점 불가 */
  isPurchasePerspectiveLocked: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeInternal] = useState<JobMode>('procurement');
  const [isPurchasePerspectiveLocked, setIsPurchasePerspectiveLocked] =
    useState(false);

  const syncLockFromStorage = useCallback(() => {
    const locked = readPurchasePerspectiveLocked();
    setIsPurchasePerspectiveLocked(locked);
    if (locked) {
      setModeInternal('procurement');
    }
  }, []);

  useEffect(() => {
    syncLockFromStorage();
    window.addEventListener(AIFIXR_SESSION_UPDATED_EVENT, syncLockFromStorage);
    return () =>
      window.removeEventListener(
        AIFIXR_SESSION_UPDATED_EVENT,
        syncLockFromStorage,
      );
  }, [syncLockFromStorage]);

  const setMode = useCallback((next: JobMode) => {
    if (readPurchasePerspectiveLocked() && next === 'pcf') {
      return;
    }
    setModeInternal(next);
  }, []);

  const toggleMode = useCallback(() => {
    if (readPurchasePerspectiveLocked()) {
      return;
    }
    setModeInternal((prev: JobMode) =>
      prev === 'procurement' ? 'pcf' : 'procurement',
    );
  }, []);

  return (
    <ModeContext.Provider
      value={{ mode, setMode, toggleMode, isPurchasePerspectiveLocked }}
    >
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}
