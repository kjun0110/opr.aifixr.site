import type { Metadata } from 'next';
import { ModeProvider } from './context/ModeContext';
import { Toaster } from './components/ui/sonner';
import '../styles/index.css';

export const metadata: Metadata = {
  title: 'opr portal',
  description: 'AI 기반 공급망 관리 플랫폼',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <ModeProvider>
          {children}
          <Toaster />
        </ModeProvider>
      </body>
    </html>
  );
}
