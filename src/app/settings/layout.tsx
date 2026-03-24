import Layout from '../components/Layout';
import type { ReactNode } from 'react';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}

