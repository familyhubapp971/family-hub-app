import type { ReactNode } from 'react';
import { Card } from '@familyhub/ui';

// Shared shell for all auth screens — centred, single column, brand
// background, neo-brutalist card. Keeps the per-page components focused
// on the form + copy.
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border-4 border-white p-8 text-gray-900 shadow-neo-lg">
        <h1 className="font-display text-3xl text-kingdom-bg">{title}</h1>
        <div className="mt-6">{children}</div>
      </Card>
    </main>
  );
}
