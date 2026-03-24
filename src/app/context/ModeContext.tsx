'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

export type JobMode = 'procurement' | 'pcf';

interface ModeContextType {
  mode: JobMode;
  setMode: (mode: JobMode) => void;
  toggleMode: () => void;
}

const ModeContext = createContext<ModeContextType | undefined>(undefined);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<JobMode>('procurement');

  const toggleMode = () => {
    setMode((prev) => (prev === 'procurement' ? 'pcf' : 'procurement'));
  };

  return (
    <ModeContext.Provider value={{ mode, setMode, toggleMode }}>
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
