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

function readOprDepartmentNormalized(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (localStorage.getItem(OPR_DEPARTMENT_STORAGE_KEY) ?? '').trim().toLowerCase();
  } catch {
    return '';
  }
}

/** DB `opr_profiles.department === 'purchase'` 인 계정: ESG(PCF) 관점 전환 불가 */
export function readPurchasePerspectiveLocked(): boolean {
  return readOprDepartmentNormalized() === 'purchase';
}

/** DB `opr_profiles.department === 'esg'` 인 계정: 구매 관점 전환 불가 */
export function readEsgPerspectiveLocked(): boolean {
  return readOprDepartmentNormalized() === 'esg';
}

interface ModeContextType {
  mode: JobMode;
  setMode: (mode: JobMode) => void;
  toggleMode: () => void;
  /** 구매 직무 계정이면 true — ESG 직무로 전환 불가 */
  isPurchasePerspectiveLocked: boolean;
  /** ESG 직무 계정이면 true — 구매 직무로 전환 불가 */
  isEsgPerspectiveLocked: boolean;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeInternal] = useState<JobMode>('procurement');
  const [isPurchasePerspectiveLocked, setIsPurchasePerspectiveLocked] =
    useState(false);
  const [isEsgPerspectiveLocked, setIsEsgPerspectiveLocked] = useState(false);

  const syncLockFromStorage = useCallback(() => {
    const dept = readOprDepartmentNormalized();
    const purchaseLocked = dept === 'purchase';
    const esgLocked = dept === 'esg';
    setIsPurchasePerspectiveLocked(purchaseLocked);
    setIsEsgPerspectiveLocked(esgLocked);
    if (purchaseLocked) {
      setModeInternal('procurement');
    } else if (esgLocked) {
      /* 로그인 시 auth.ts 가 user.department 를 localStorage 에 넣음 — ESG 직무 고정 */
      setModeInternal('pcf');
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
    if (readEsgPerspectiveLocked() && next === 'procurement') {
      return;
    }
    setModeInternal(next);
  }, []);

  const toggleMode = useCallback(() => {
    if (readPurchasePerspectiveLocked() || readEsgPerspectiveLocked()) {
      return;
    }
    setModeInternal((prev: JobMode) =>
      prev === 'procurement' ? 'pcf' : 'procurement',
    );
  }, []);

  return (
    <ModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isPurchasePerspectiveLocked,
        isEsgPerspectiveLocked,
      }}
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
