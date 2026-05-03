import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Calendar, CheckSquare, BookOpen, NotebookPen } from 'lucide-react';
import {
  Button,
  DynamicCalendar,
  FeatureCard,
  FloatingDecorations,
  type FloatingDecoration,
} from '@familyhub/ui';

// Hero copy rotates between four ad pitches every 5 seconds, each
// targeting a different persona:
//   - Slide 1 — pitch to the COORDINATING parent (Sarah persona):
//     someone evaluating Family Hub to fix the mental load of running
//     a household.
//   - Slide 2 — pitch to the INVITED parent (Yusuf persona): someone
//     receiving the link from their partner. The inviter's name cycles
//     every 1.5s through a culturally diverse set so this slide reads
//     as "your partner just sent you a link" regardless of who's
//     looking — Sarah / Aisha / Sandra / Priya / etc.
//   - Slide 3 — pitch to the parent of a KID (Sarah-as-mum view): a
//     kid name cycles, framing the app as the place where the kid
//     racks up streaks for chores + lessons + rewards.
//   - Slide 4 — pitch to DADS as active participants (Yusuf-but-leading):
//     the dad name cycles. Aspirational, not duty-coded — implies
//     dads want IN on the wins (school run, bedtime, weekend plans),
//     not just ticking admin boxes.
// Source design: Magic Patterns kudjspxd3xxroueg5jw11o pages/Welcome.tsx.

const inviterNames = [
  'Jumi',
  'Aisha',
  'Maria',
  'Priya',
  'Emma',
  'Fatima',
  'Sofia',
  'Yara',
  'Olivia',
  'Sarah',
  'Sandra',
  'Mei',
] as const;

// Kid names — culturally diverse to mirror the inviter set. Used by
// the third slide to cycle through "<Kid> just earned their streak".
const kidNames = ['Iman', 'Faith', 'Noah', 'Ibrahim'] as const;

// Dad names — culturally diverse, used by the fourth slide. Pitched
// as the dad LEADING moments (school run, bedtime, weekend wins),
// not just receiving an invite from his partner.
const dadNames = ['Yusuf', 'Marcus', 'Olu', 'Raj', 'James', 'Mohammed'] as const;

const slides = [
  {
    id: 'sarah',
    headline: 'Your whole family, finally in sync.',
    subtitle:
      "One beautifully calm place for the schedules, tasks, meals, and learning that make family life hum — so everyone wakes up knowing what's on.",
    // Copy length matched across all 3 slides (~20 chars) so the CTA
    // button doesn't visibly resize during the cross-fade transition.
    cta: 'Start your free trial',
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
  {
    // 'kid' = parent-of-kid pitch. The kid name cycles through
    // kidNames so the slide reads as "your kid is the one earning
    // streaks here". Subtitle weaves the three concrete things kids
    // actually do in the app: lessons, chores, rewards (mirrors the
    // FeatureCards below).
    id: 'kid',
    headline: null,
    subtitle:
      'Lessons done, chores ticked, rewards unlocked — your kids see their own week, build streaks, and feel proud without you nagging.',
    cta: 'Add your kids today',
  },
  {
    // 'dad' = pitch dads as active participants. Aspirational, not
    // duty-coded — the headline frames the dad LANDING a moment
    // (school run / bedtime story / weekend plan) so the read is
    // "be the dad who's in the wins", not "here's another chore app".
    id: 'dad',
    headline: null,
    subtitle:
      'Be the dad your kids notice — not because you nagged, but because you showed up. Family Hub puts the wins on your radar so you can land them.',
    cta: 'Get in the loop',
  },
] as const;

// Calendar slot is a live component (always shows today's date) instead
// of the 📅 emoji, which is hard-coded to "JUL 17" by the OS glyph and
// looks stale on any other day. Positioned a little lower than the
// emoji-only set so the calendar doesn't crowd the brand link in the
// top-left corner of the hero.
const floatingElements: FloatingDecoration[] = [
  {
    icon: <DynamicCalendar testId="welcome-floating-calendar" />,
    top: '30%',
    left: '8%',
    delay: 0,
  },
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
  const [kidIdx, setKidIdx] = useState(0);
  const [dadIdx, setDadIdx] = useState(0);
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
  // cultures. Only ticks while that slide is visible. Resets to index
  // 0 (Jumi) every time the slide becomes visible so the cycle always
  // STARTS with Jumi rather than whatever value it left off on.
  useEffect(() => {
    if (slides[currentSlide]?.id !== 'invited-parent') return;
    setInviterIdx(0);
    if (reduceMotion) return;
    const id = setInterval(() => {
      setInviterIdx((prev) => (prev + 1) % inviterNames.length);
    }, 1500);
    return () => clearInterval(id);
  }, [currentSlide, reduceMotion]);

  // Same cycling pattern for the kid slide — name flashes through
  // Iman / Faith / Noah / Ibrahim while the slide is up.
  useEffect(() => {
    if (slides[currentSlide]?.id !== 'kid') return;
    setKidIdx(0);
    if (reduceMotion) return;
    const id = setInterval(() => {
      setKidIdx((prev) => (prev + 1) % kidNames.length);
    }, 1500);
    return () => clearInterval(id);
  }, [currentSlide, reduceMotion]);

  // Same cycling pattern for the dad slide — name flashes through
  // Yusuf / Marcus / Olu / Raj / James / Mohammed while the slide is up.
  useEffect(() => {
    if (slides[currentSlide]?.id !== 'dad') return;
    setDadIdx(0);
    if (reduceMotion) return;
    const id = setInterval(() => {
      setDadIdx((prev) => (prev + 1) % dadNames.length);
    }, 1500);
    return () => clearInterval(id);
  }, [currentSlide, reduceMotion]);

  const slide = slides[currentSlide]!;
  const inviterName = inviterNames[inviterIdx]!;
  const kidName = kidNames[kidIdx]!;
  const dadName = dadNames[dadIdx]!;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-kingdom-bg font-body text-white">
      {/* Subtle radial purple glow at the top of the hero. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.4),rgba(61,16,101,0)_60%)]" />

      {/* Floating decorative emojis — hidden on mobile, motion-safe. */}
      <FloatingDecorations elements={floatingElements} />

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
                ) : slide.id === 'kid' ? (
                  <>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={kidName}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.25 }}
                        className="inline-block text-pink-300"
                      >
                        {kidName}
                      </motion.span>
                    </AnimatePresence>{' '}
                    just earned their streak this week.
                  </>
                ) : slide.id === 'dad' ? (
                  <>
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={dadName}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.25 }}
                        className="inline-block text-pink-300"
                      >
                        {dadName}
                      </motion.span>
                    </AnimatePresence>{' '}
                    just won three rounds of dad-of-the-week.
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
                {...(reduceMotion
                  ? {}
                  : { whileHover: { y: -6, rotate: -1, transition: { duration: 0.15 } } })}
              >
                <FeatureCard
                  icon={<Icon size={26} />}
                  title={title}
                  body={body}
                  headerBg={headerBg}
                  cardBg={cardBg}
                  iconColor={iconColor}
                  accentBar={accentBar}
                />
              </motion.div>
            ),
          )}
        </div>
      </main>
    </div>
  );
}
