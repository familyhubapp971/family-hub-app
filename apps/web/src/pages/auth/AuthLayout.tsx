import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@familyhub/ui';

// Shared shell for all auth screens — centred, single column, brand
// background, neo-brutalist card. Keeps the per-page components focused
// on the form + copy.
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative min-h-full">
      {/* Brand link top-left — clicks back to the homepage. White text
          on the kingdom-purple page background. */}
      <Link
        to="/"
        className="absolute left-6 top-6 font-heading text-2xl text-white transition-opacity hover:opacity-90 sm:left-10 sm:top-8"
      >
        FamilyHub
      </Link>
      {/* Vertical-centered card sat slightly below true-centre so it
          doesn't align with the brand link in the top-left corner of
          the page. pt-24 on small viewports + items-center + a small
          downward translate on md+ ≅ the visual sweet-spot the design
          calls for. */}
      <main className="flex min-h-full items-center justify-center px-4 pb-10 pt-24 md:pt-32">
        <Card className="w-full max-w-md translate-y-4 border-4 border-white p-8 text-gray-900 shadow-neo-lg md:translate-y-8">
          <h1 className="font-display text-3xl text-kingdom-bg">{title}</h1>
          <div className="mt-6">{children}</div>
        </Card>
      </main>
    </div>
  );
}
