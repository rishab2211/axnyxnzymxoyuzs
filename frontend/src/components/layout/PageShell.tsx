import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface PageShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({ title, subtitle, children }) => {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 p-8 overflow-y-auto max-w-7xl w-full mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
};
