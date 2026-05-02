import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Calendar, CheckSquare, BookOpen, NotebookPen } from 'lucide-react';
import { Button, Card } from '@familyhub/ui';

// Hero copy rotates between two ad pitches every 5 seconds, each
// targeting a different persona:
//   - Slide 1 — pitch to the COORDINATING parent (Sarah persona):
//     someone evaluating Family Hub to fix the mental load of running
//     a household.
//   - Slide 2 — pitch to the INVITED parent (Yusuf persona): someone
//     receiving the link from their partner. The inviter's name cycles
//     every 0.9s through a culturally diverse set so this slide reads
//     as "your partner just sent you a link" regardless of who's
//     looking — Sarah / Aisha / Maria / Priya / etc.
// Source design: Magic Patterns kudjspxd3xxroueg5jw11o pages/Welcome.tsx.

const inviterNames = [
  'Sarah',
  'Aisha',
  'Maria',
  'Priya',
  'Emma',
  'Fatima',
  'Sofia',
  'Yara',
  'Olivia',
  'Mei',
] as const;

const slides = [
  {
    id: 'sarah',
    headline: 'Your whole family, finally in sync.',
    subtitle:
      "One beautifully calm place for the schedules, tasks, meals, and learning that make family life hum — so everyone wakes up knowing what's on.",
    cta: 'Start free — no card needed',
  },
  {
    // 'invited-parent' = the secondary-parent ad slide (Yusuf-style
    // persona). Internal id; never shown to the user. Headline is
    // built dynamically from inviterNames so the partner name flashes
    // through several options while this slide is up — depicting a
    // wife inviting her husband to share the family's mental load.
    id: 'invited-parent',
    headline: null,
    subtitle:
      "From this week's meals to the kids' assignments, you'll both be looking at the same plan. Tap the link — let's run the week together.",
    cta: 'Join the family team',
  },
] as const;

interface FloatingElement {
  icon: string;
  top: string;
  left?: string;
  right?: string;
  delay: number;
}

const floatingElements: FloatingElement[] = [
  { icon: '📅', top: '15%', left: '10%', delay: 0 },
  { icon: '✅', top: '60%', left: '15%', delay: 1 },
  { icon: '⭐', top: '20%', right: '12%', delay: 0.5 },
  { icon: '🏠', top: '65%', right: '15%', delay: 1.5 },
];

const featureCards = [
  {
    accentBar: 'border-l-pink-400',
    headerBg: 'bg-yellow-200',
    cardBg: 'bg-yellow-50',
    iconColor: 'text-pink-500',
    Icon: Calendar,
    title: 'One calendar, every child',
    body: "School runs, swim class, dentist — see everyone's schedule in one place. Color-coded by kid.",
  },
  {
    accentBar: 'border-l-green-500',
    headerBg: 'bg-lime-200',
    cardBg: 'bg-lime-50',
    iconColor: 'text-green-600',
    Icon: CheckSquare,
    title: 'Tasks that actually stick',
    body: 'Assign chores, track habits, reward effort. No more nagging — the app does it for you.',
  },
  {
    accentBar: 'border-l-blue-500',
    headerBg: 'bg-cyan-200',
    cardBg: 'bg-cyan-50',
    iconColor: 'text-blue-600',
    Icon: BookOpen,
    title: 'Curious minds, every day',
    body: 'Quran, math, languages, world flags — culturally aware defaults baked in. Bite-sized, kid-friendly, parent-tracked.',
  },
  {
    accentBar: 'border-l-orange-400',
    headerBg: 'bg-pink-200',
    cardBg: 'bg-pink-50',
    iconColor: 'text-orange-500',
    Icon: NotebookPen,
    title: 'Memories that last',
    body: "A shared family journal — milestones, gratitude, the funny things the kids said. Your family's story, safe in one place.",
  },
] as const;

export function WelcomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [inviterIdx, setInviterIdx] = useState(0);
  const reduceMotion = useReducedMotion();

  // Auto-rotate slides every 5s. Skipped under prefers-reduced-motion.
  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [reduceMotion]);

  // Fast-cycle the partner name on the invited-parent slide so the
  // headline reads as "your partner just sent you a link" across many
  // cultures. Only ticks while that slide is visible.
  useEffect(() => {
    if (reduceMotion) return;
    if (slides[currentSlide]?.id !== 'invited-parent') return;
    const id = setInterval(() => {
      setInviterIdx((prev) => (prev + 1) % inviterNames.length);
    }, 900);
    return () => clearInterval(id);
  }, [currentSlide, reduceMotion]);

  const slide = slides[currentSlide]!;
  const inviterName = inviterNames[inviterIdx]!;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-kingdom-bg font-body text-white">
      {/* Subtle radial purple glow at the top of the hero. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.4),rgba(61,16,101,0)_60%)]" />

      {/* Floating decorative emojis — hidden on mobile to reduce noise.
          Static when the user prefers reduced motion. */}
      {!reduceMotion &&
        floatingElements.map((el, idx) => (
          <motion.div
            key={idx}
            className="pointer-events-none absolute hidden text-4xl opacity-50 md:block"
            style={{ top: el.top, left: el.left, right: el.right }}
            animate={{ y: [0, -20, 0], rotate: [0, 5, -5, 0] }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: el.delay,
            }}
          >
            {el.icon}
          </motion.div>
        ))}

      {/* Header — kept slim so the hero + feature cards both fit
          above the fold on a 1080p viewport. */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="font-heading text-2xl text-white transition-opacity hover:opacity-90"
        >
          FamilyHub
        </Link>
        <nav className="hidden items-center gap-8 font-bold md:flex">
          <Link to="/" className="text-yellow-300">
            Features
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-yellow-300">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link to="/login" className="font-bold transition-colors hover:text-yellow-300">
            Log in
          </Link>
          <Button onClick={() => navigate('/signup')} variant="primary">
            Start free
          </Button>
        </div>
      </header>

      {/* Hero — flex-1 absorbs leftover viewport height; gap controls
          vertical rhythm without pushing the feature row off-screen. */}
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-5 px-6 pb-6 text-center">
        {/* Cross-fading slide area */}
        <div className="relative flex min-h-[180px] w-full flex-col items-center justify-center md:min-h-[200px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <h1 className="mb-3 font-heading text-3xl leading-tight text-yellow-300 md:text-5xl lg:text-6xl">
                {slide.id === 'invited-parent' ? (
                  <>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={inviterName}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.25 }}
                        className="inline-block text-pink-300"
                      >
                        {inviterName}
                      </motion.span>
                    </AnimatePresence>{' '}
                    just teamed up with you on family life.
                  </>
                ) : (
                  slide.headline
                )}
              </h1>
              <p className="max-w-2xl text-base font-bold text-purple-100 md:text-lg">
                {slide.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <Button
          onClick={() => navigate('/signup')}
          variant="primary"
          size="lg"
          className="px-6 py-3 text-base md:text-lg"
        >
          {slide.cta}
        </Button>

        {/* Slider dots */}
        <div className="flex items-center gap-3">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => setCurrentSlide(idx)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                currentSlide === idx ? 'bg-yellow-300' : 'bg-purple-400 hover:bg-purple-300'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <p className="text-sm font-bold text-purple-200">
          Trusted by 2,400+ families in UAE, UK &amp; US
        </p>

        {/* Feature cards — 4 pillars: Calendar, Tasks, Learn, Journal.
            Cultural angle woven into the Learn card description. */}
        <div className="grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map(
            ({ accentBar, headerBg, cardBg, iconColor, Icon, title, body }, idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 * (idx + 1), duration: 0.4 }}
                whileHover={
                  reduceMotion ? undefined : { y: -6, rotate: -1, transition: { duration: 0.15 } }
                }
              >
                <Card
                  className={`h-full !p-0 !shadow-neo-lg hover:!shadow-[8px_8px_0_0_rgba(0,0,0,1)] transition-shadow duration-150 ${cardBg} text-black border-l-[6px] ${accentBar}`}
                >
                  <div className={`flex items-center justify-center p-3 ${headerBg}`}>
                    <div className="flex h-12 w-12 items-center justify-center rounded-md border-2 border-black bg-white shadow-neo">
                      <Icon className={iconColor} size={26} />
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="mb-1 font-heading text-base md:text-lg">{title}</h3>
                    <p className="text-xs font-bold text-gray-600 md:text-sm">{body}</p>
                  </div>
                </Card>
              </motion.div>
            ),
          )}
        </div>
      </main>
    </div>
  );
}
