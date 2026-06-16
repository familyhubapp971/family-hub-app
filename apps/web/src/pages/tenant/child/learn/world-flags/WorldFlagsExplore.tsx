import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Trophy,
  Lock,
  MapPin,
  Landmark as LandmarkIcon,
  Coins,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../../../../lib/auth-context';
import { useTenantSlug } from '../../../../../lib/tenant-context';
import { API_BASE } from '../../../../../lib/api';
import { COUNTRIES, CONTINENTS, type Country } from '../../../../../data/countries';
import { FlagImage } from './FlagImage';
import { CapitalMap } from './CapitalMap';
import { LandmarkImage } from './LandmarkImage';
import { CONTINENT_SOLID, continentId } from './shared';

// World Flags — Explore sub-tab.
//
// Tap a flashcard to cycle: flag image → name reveal → facts panel (capital
// map + landmark photo + currency + fun fact). Reaching the name-reveal state
// marks the flag as explored (POST /api/world-flags/explore). Progress bar
// and per-continent certificates are computed client-side.

type CardState = 'flag' | 'name' | 'facts';
type Status = 'loading' | 'ready' | 'error';

const ALL_CONTINENTS = ['All', ...CONTINENTS] as const;
type ContinentFilter = (typeof ALL_CONTINENTS)[number];

export function WorldFlagsExplore({ memberId }: { memberId: string }) {
  const slug = useTenantSlug();
  const { session } = useAuth();

  const [status, setStatus] = useState<Status>('loading');
  const [explored, setExplored] = useState<Set<string>>(new Set());
  const [selectedContinent, setSelectedContinent] = useState<ContinentFilter>('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardState, setCardState] = useState<CardState>('flag');
  const [certEarned, setCertEarned] = useState<string | null>(null);
  const certTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevComplete = useRef<Record<string, boolean>>({});

  const headers = useMemo(
    () =>
      session ? { Authorization: `Bearer ${session.access_token}`, 'x-tenant-slug': slug } : null,
    [session, slug],
  );

  const filteredCountries = useMemo<Country[]>(
    () =>
      selectedContinent === 'All'
        ? COUNTRIES
        : COUNTRIES.filter((c) => c.continent === selectedContinent),
    [selectedContinent],
  );

  const currentCountry = filteredCountries[currentIndex] ?? null;

  useEffect(() => {
    if (!headers) return;
    const ac = new AbortController();
    setStatus('loading');
    fetch(`${API_BASE}/api/world-flags?memberId=${memberId}`, { headers, signal: ac.signal })
      .then(async (res) => {
        if (!res.ok) {
          setStatus('error');
          return;
        }
        const body = (await res.json()) as { explored: string[] };
        const codes = new Set(body.explored ?? []);
        setExplored(codes);
        setStatus('ready');
        for (const cont of CONTINENTS) {
          const total = COUNTRIES.filter((c) => c.continent === cont).length;
          const done = COUNTRIES.filter((c) => c.continent === cont && codes.has(c.code)).length;
          prevComplete.current[cont] = done >= total;
        }
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setStatus('error');
      });
    return () => ac.abort();
  }, [headers, memberId]);

  useEffect(() => {
    setCurrentIndex(0);
    setCardState('flag');
  }, [selectedContinent]);

  // Clean up the cert badge timer on unmount.
  useEffect(
    () => () => {
      if (certTimerRef.current) clearTimeout(certTimerRef.current);
    },
    [],
  );

  const markExplored = useCallback(
    (code: string, continent: string) => {
      if (explored.has(code)) return;
      const next = new Set(explored);
      next.add(code);
      setExplored(next);
      if (headers) {
        void fetch(`${API_BASE}/api/world-flags/explore`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId, countryCode: code }),
        }).catch(() => {
          /* ignore — progress saved on next interaction */
        });
      }
      const continentCountries = COUNTRIES.filter((c) => c.continent === continent);
      const nowDone = continentCountries.filter((c) => next.has(c.code)).length;
      if (nowDone >= continentCountries.length && !prevComplete.current[continent]) {
        prevComplete.current[continent] = true;
        if (certTimerRef.current) clearTimeout(certTimerRef.current);
        setCertEarned(continent);
        certTimerRef.current = setTimeout(() => setCertEarned(null), 4000);
      }
    },
    [explored, headers, memberId],
  );

  const handleCardTap = useCallback(() => {
    if (!currentCountry) return;
    if (cardState === 'flag') {
      setCardState('name');
      markExplored(currentCountry.code, currentCountry.continent);
    } else if (cardState === 'name') {
      setCardState('facts');
    }
  }, [cardState, currentCountry, markExplored]);

  const handleNext = useCallback(() => {
    if (!filteredCountries.length) return;
    setCurrentIndex((i) => (i + 1) % filteredCountries.length);
    setCardState('flag');
  }, [filteredCountries.length]);

  const continentStats = useMemo(
    () =>
      CONTINENTS.map((cont) => {
        const total = COUNTRIES.filter((c) => c.continent === cont).length;
        const done = COUNTRIES.filter((c) => c.continent === cont && explored.has(c.code)).length;
        return { cont, done, total, certified: done >= total };
      }),
    [explored],
  );

  const exploredInFilter = filteredCountries.filter((c) => explored.has(c.code)).length;

  if (status === 'loading') {
    return (
      <p
        data-testid="world-flags-loading"
        aria-live="polite"
        aria-busy="true"
        className="text-sm font-bold text-white"
      >
        Loading world flags…
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p data-testid="world-flags-error" role="alert" className="text-sm font-bold text-red-300">
        Couldn&rsquo;t load — try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {certEarned && (
        <motion.div
          data-testid="world-cert-earned"
          initial={{ opacity: 0, scale: 0.7, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7 }}
          className="flex items-center gap-3 rounded-xl border-2 border-black bg-yellow-300 p-4 shadow-neo-sm"
          role="status"
          aria-live="polite"
        >
          <Trophy size={28} className="shrink-0" aria-hidden="true" />
          <div>
            <p className="font-heading text-lg uppercase tracking-wide">
              {certEarned} Certificate!
            </p>
            <p className="text-sm font-bold">All flags explored. Amazing work!</p>
          </div>
        </motion.div>
      )}

      {/* Continent filter bar */}
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Filter by continent"
      >
        {ALL_CONTINENTS.map((cont) => {
          const isActive = selectedContinent === cont;
          const colorClass = CONTINENT_SOLID[cont] ?? 'bg-gray-700';
          const id = continentId(cont);
          return (
            <button
              key={cont}
              data-testid={`world-continent-${id}`}
              type="button"
              onClick={() => setSelectedContinent(cont)}
              className={`min-h-[44px] shrink-0 rounded-xl border-2 border-black px-3 py-2 text-xs font-black whitespace-nowrap transition-transform motion-safe:hover:-translate-y-0.5 ${
                isActive ? `${colorClass} text-white shadow-neo-xs` : 'bg-white text-gray-600'
              }`}
            >
              {cont}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div
        data-testid="world-progress"
        className="rounded-xl border-2 border-black bg-white p-4 shadow-neo-xs"
        aria-label={`${exploredInFilter} of ${filteredCountries.length} flags explored`}
      >
        <div className="mb-2 flex items-center justify-between text-xs font-bold">
          <span>Flags explored</span>
          <span>
            {exploredInFilter} / {filteredCountries.length}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={exploredInFilter}
          aria-valuemin={0}
          aria-valuemax={filteredCountries.length}
          className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-gray-100"
        >
          <div
            className="h-full rounded-full bg-black transition-all duration-500"
            style={{
              width:
                filteredCountries.length > 0
                  ? `${(exploredInFilter / filteredCountries.length) * 100}%`
                  : '0%',
            }}
          />
        </div>
      </div>

      {/* Flash card */}
      {currentCountry ? (
        <div
          data-testid="world-flashcard"
          onClick={cardState !== 'facts' ? handleCardTap : undefined}
          role={cardState !== 'facts' ? 'button' : undefined}
          tabIndex={cardState !== 'facts' ? 0 : undefined}
          onKeyDown={(e) => {
            if (cardState !== 'facts' && (e.key === 'Enter' || e.key === ' ')) handleCardTap();
          }}
          aria-label={
            cardState === 'flag'
              ? `Flag of unknown country. Tap to reveal name.`
              : cardState === 'name'
                ? `${currentCountry.name}. Tap to see facts.`
                : `Facts for ${currentCountry.name}`
          }
          className={`rounded-xl border-2 border-black bg-white shadow-neo-sm transition-transform ${
            cardState !== 'facts'
              ? 'cursor-pointer motion-safe:hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-black'
              : ''
          }`}
        >
          {/* Flag section */}
          <div className="flex flex-col items-center gap-3 p-8">
            {explored.has(currentCountry.code) && cardState === 'flag' && (
              <div className="self-end rounded-full border-2 border-black bg-green-300 px-2 py-0.5 text-[10px] font-black">
                Explored
              </div>
            )}
            <FlagImage
              country={currentCountry}
              size="w320"
              className={`h-auto w-44 rounded-lg border-2 border-white/40 shadow-md sm:w-56 ${
                cardState === 'flag' ? 'motion-safe:animate-pulse' : ''
              }`}
              emojiClassName="text-8xl leading-none"
            />
            {cardState === 'flag' && (
              <p className="text-xs font-bold text-gray-500">Tap to reveal!</p>
            )}
          </div>

          {/* Name reveal */}
          {(cardState === 'name' || cardState === 'facts') && (
            <div className="border-t-2 border-black px-6 py-4 text-center">
              <h3
                data-testid="world-flag-name"
                className="font-heading text-3xl font-black text-gray-900"
              >
                {currentCountry.name}
              </h3>
              <p className="mt-1 text-sm font-bold text-gray-500">{currentCountry.continent}</p>
              {cardState === 'name' && (
                <p className="mt-3 text-xs font-bold text-purple-600">Tap for fun facts!</p>
              )}
            </div>
          )}

          {/* Facts panel */}
          {cardState === 'facts' && (
            <div
              data-testid="world-flag-facts"
              className="flex flex-col gap-3 border-t-2 border-black p-5"
            >
              {/* Landmark photo + capital map */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col overflow-hidden rounded-lg border-2 border-purple-200 bg-purple-50 p-1.5">
                  <div className="aspect-[4/3] overflow-hidden rounded bg-gray-900">
                    <LandmarkImage landmark={currentCountry.landmark} />
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-sm font-black leading-tight text-gray-900">
                    <LandmarkIcon
                      className="mr-1 inline-block h-3 w-3 align-text-bottom text-purple-500"
                      aria-hidden="true"
                    />
                    {currentCountry.landmark}
                  </p>
                </div>
                <div className="flex flex-col overflow-hidden rounded-lg border-2 border-blue-200 bg-blue-50 p-1.5">
                  <div className="aspect-[4/3] overflow-hidden rounded">
                    <CapitalMap country={currentCountry} />
                  </div>
                  <p className="mt-1.5 line-clamp-1 text-sm font-black leading-tight text-gray-900">
                    <MapPin
                      className="mr-1 inline-block h-3 w-3 align-text-bottom text-blue-500"
                      aria-hidden="true"
                    />
                    {currentCountry.capital}
                  </p>
                </div>
              </div>

              {/* Currency + fun fact */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2 rounded-lg border-2 border-green-200 bg-green-50 px-3 py-2">
                  <Coins className="h-5 w-5 shrink-0 text-green-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-lg font-black leading-none text-gray-900">
                      {currentCountry.currencySymbol}
                    </p>
                    <p className="truncate text-sm font-bold text-gray-500">
                      {currentCountry.currency}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-2">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                  <p className="text-xs font-bold leading-snug text-gray-800">
                    {currentCountry.funFact}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-black bg-white p-8 text-center shadow-neo-xs">
          <p className="text-4xl">🌍</p>
          <p className="mt-2 font-heading text-lg font-black">No countries found</p>
          <p className="text-sm text-gray-500">Try a different continent.</p>
        </div>
      )}

      {/* Next flag button */}
      {currentCountry && (
        <button
          data-testid="world-next-flag"
          type="button"
          onClick={handleNext}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border-2 border-black bg-black py-3 font-heading text-base font-black text-white shadow-neo-sm transition-transform motion-safe:hover:-translate-y-0.5"
        >
          Next flag <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}

      {/* Continent certificates (at-a-glance summary) */}
      <div className="rounded-xl border-2 border-black bg-white p-5 shadow-neo-xs">
        <h3 className="mb-4 font-heading text-lg uppercase tracking-wide">Continent Explorer</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {continentStats.map(({ cont, done, total, certified }) => (
            <div
              key={cont}
              data-testid={`world-cert-${continentId(cont)}`}
              className={`flex items-center gap-3 rounded-lg border-2 border-black p-3 ${
                certified ? 'bg-yellow-200' : 'bg-gray-50'
              }`}
            >
              {certified ? (
                <Trophy size={22} className="shrink-0 text-yellow-600" aria-label="Certified" />
              ) : (
                <Lock size={22} className="shrink-0 text-gray-400" aria-label="Not yet certified" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{cont}</p>
                <p className="text-xs text-gray-500">
                  {done}/{total} explored
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
