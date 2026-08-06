import React from 'react';

export interface AvatarTile {
  id: string;
  /** Display name shown under the avatar. */
  name: string;
  /** Optional role tag, e.g. "Mum", "Teen (14)", "Child (6)". */
  role?: string;
  /**
   * Tailwind background class for the round avatar disc, e.g.
   * "bg-pink-200", "bg-cyan-300". Picks up the persona colour wheel.
   */
  color: string;
  /**
   * What renders inside the avatar disc. Pass an emoji string, an
   * <img />, or any ReactNode. Falls back to the first letter of `name`.
   */
  avatar?: React.ReactNode;
}

interface AvatarGridProps {
  avatars: AvatarTile[];
  /** Fires with the clicked avatar's id. */
  onSelect?: (id: string) => void;
  /** When set, the matching tile renders with a yellow ring + neo-shadow. */
  selectedId?: string;
  /**
   * Tailwind grid-cols class: defaults to a responsive 2/3/4 layout
   * that handles 4-6 avatars cleanly. Override for non-standard counts
   * (e.g. 3-cols-only when there are exactly 3 avatars).
   */
  gridClassName?: string;
  testId?: string;
}

/**
 * Grid of avatar tiles. Used in two places:
 *   - Login kid-picker (Login.tsx: kid taps their face to start PIN entry)
 *   - Dashboard family-member row (Dashboard.tsx: admin sees the family
 *     at a glance)
 *
 * Each tile is a real <button> so keyboard users can Tab through and
 * activate with Enter or Space.
 */
export function AvatarGrid({
  avatars,
  onSelect,
  selectedId,
  gridClassName = 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4',
  testId,
}: AvatarGridProps) {
  return (
    <div data-testid={testId} className={gridClassName}>
      {avatars.map((a) => {
        const selected = a.id === selectedId;
        return (
          <button
            key={a.id}
            type="button"
            aria-pressed={selected}
            aria-label={a.role ? `${a.name}, ${a.role}` : a.name}
            onClick={() => onSelect?.(a.id)}
            className={[
              // FHS-573: the Magic Patterns design colours the whole tile and
              // sits a white avatar disc inside it, rather than a white tile
              // with a coloured disc. Only the kid sign-in uses this grid.
              'group flex flex-col items-center gap-3 rounded-xl border-2 border-black p-6 text-black transition-all duration-150',
              a.color,
              'focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400 focus-visible:ring-offset-2',
              selected
                ? 'shadow-neo-lg ring-4 ring-yellow-300 ring-offset-2 -translate-y-0.5'
                : 'shadow-neo motion-safe:hover:-translate-y-0.5 hover:shadow-neo-lg',
            ].join(' ')}
          >
            <div
              className={[
                'flex h-16 w-16 items-center justify-center rounded-full border-2 border-black bg-white text-3xl font-heading shadow-neo-xs',
              ].join(' ')}
              aria-hidden="true"
            >
              {a.avatar ?? a.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col items-center">
              <span className="font-heading text-lg">{a.name}</span>
              {a.role && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-black/60">
                  {a.role}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
