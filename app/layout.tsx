import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Sidebar } from '@/components/sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Prompt Arena',
    template: '%s | Prompt Arena',
  },
  description: 'Compare prompts, modelos, custos e latencia em uma unica interface.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
                <h1 className="text-base font-medium">Prompt Arena</h1>
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-y-auto p-4">{children}</main>
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}