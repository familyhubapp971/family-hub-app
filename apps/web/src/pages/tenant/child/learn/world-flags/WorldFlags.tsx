import { useState } from 'react';
import { Globe, BookOpen, Trophy } from 'lucide-react';
import { WorldFlagsExplore } from './WorldFlagsExplore';
import { WorldFlagsPath } from './WorldFlagsPath';
import { WorldFlagsCertificates } from './WorldFlagsCertificates';

// World Flags subject — three sub-tabs:
//  • Explore      — free-browse flashcards (flag image → name → facts + map).
//  • Learn        — structured path: study 5-country sets, then a quiz.
//  • Certificates — per-continent certs + 60-second timed quizzes.

type SubTab = 'explore' | 'learn' | 'certificates';

const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'explore', label: 'Explore', icon: <Globe size={16} aria-hidden="true" /> },
  { id: 'learn', label: 'Learn', icon: <BookOpen size={16} aria-hidden="true" /> },
  { id: 'certificates', label: 'Awards', icon: <Trophy size={16} aria-hidden="true" /> },
];

// Exactly one of memberId / kidToken is supplied (never both).
type WorldFlagsProps =
  | { memberId: string; kidToken?: undefined }
  | { kidToken: string; memberId?: undefined };

export function WorldFlags({ memberId, kidToken }: WorldFlagsProps) {
  const [tab, setTab] = useState<SubTab>('learn');

  const subProps = kidToken ? { kidToken } : { memberId: memberId! };

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tab switcher */}
      <div
        role="tablist"
        aria-label="World Flags modes"
        className="flex gap-2 rounded-xl border-2 border-black bg-white p-1.5 shadow-neo-xs"
      >
        {SUB_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              data-testid={`world-subtab-${t.id}`}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-black transition-transform motion-safe:hover:-translate-y-0.5 ${
                active
                  ? 'border-black bg-black text-white shadow-neo-xs'
                  : 'border-transparent bg-white text-gray-600'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'explore' && <WorldFlagsExplore {...subProps} />}
      {tab === 'learn' && <WorldFlagsPath {...subProps} />}
      {tab === 'certificates' && <WorldFlagsCertificates {...subProps} />}
    </div>
  );
}
