import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Calendar, CheckSquare, Home } from 'lucide-react';
import { Button, Card } from '@familyhub/ui';

// Hero copy rotates between two persona pitches every 5 seconds:
//   - Sarah (the coordinating parent who buys/onboards)
//   - Yusuf (the secondary parent who arrives via an invite link)
// Source design: Magic Patterns kudjspxd3xxroueg5jw11o pages/Welcome.tsx.
const slides = [
  {
    id: 'sarah',
    headline: 'Stop juggling five apps for one family.',
    subtitle:
      'Family Hub is the operating system for family life — one place for schedules, tasks, meals, learning, and the mental load your family generates every single day.',
    cta: 'Start free — no card needed',
  },
  {
    id: 'yusuf',
    headline: "Sarah sent you a link. Click it. You're in.",
    subtitle:
      'No signup wizard. No preferences screen. Just tap the link, see your tasks, check the family calendar, and get on with your day.',
    cta: 'See how it works',
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
    accentBar: 'border-l-orange-400',
    headerBg: 'bg-cyan-200',
    cardBg: 'bg-cyan-50',
    iconColor: 'text-orange-500',
    Icon: Home,
    title: 'Built for your culture',
    body: 'Hijri calendar, Ramadan routines, culturally aware defaults. Family Hub fits your life, not the other way around.',
  },
] as const;

export function WelcomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);
  const reduceMotion = useReducedMotion();

  // Auto-rotate slides every 5s. Skipped when the user has
  // prefers-reduced-motion enabled (a11y).
  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-kingdom-bg font-body text-white">
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

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between p-6">
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

      {/* Hero */}
      <main className="relative z-10 mx-auto mt-12 flex w-full max-w-7xl flex-1 flex-col items-center justify-center p-6 text-center md:mt-24">
        {/* Cross-fading slide area */}
        <div className="relative mb-8 flex min-h-[320px] w-full flex-col items-center justify-center md:min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 flex flex-col items-center justify-center"
            >
              <h1 className="mb-6 font-heading text-5xl leading-tight text-yellow-300 md:text-7xl">
                {slides[currentSlide]!.headline}
              </h1>
              <p className="max-w-2xl text-xl font-bold text-purple-100 md:text-2xl">
                {slides[currentSlide]!.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mb-12 flex flex-col items-center gap-4 sm:flex-row">
          <Button
            onClick={() => navigate('/signup')}
            variant="primary"
            size="lg"
            className="px-8 py-4 text-xl"
          >
            {slides[currentSlide]!.cta}
          </Button>
        </div>

        {/* Slider dots */}
        <div className="mb-16 flex items-center gap-3">
          {slides.map((slide, idx) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlide(idx)}
              className={`h-3 w-3 rounded-full transition-colors ${
                currentSlide === idx ? 'bg-yellow-300' : 'bg-purple-400 hover:bg-purple-300'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        <p className="mb-16 font-bold text-purple-200">
          Trusted by 2,400+ families in UAE, UK &amp; US
        </p>

        {/* Feature cards */}
        <div className="grid w-full grid-cols-1 gap-8 text-left md:grid-cols-3">
          {featureCards.map(
            ({ accentBar, headerBg, cardBg, iconColor, Icon, title, body }, idx) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 * (idx + 1), duration: 0.5 }}
              >
                <Card className={`h-full !p-0 ${cardBg} text-black border-l-[6px] ${accentBar}`}>
                  <div className={`flex items-center justify-center p-5 ${headerBg}`}>
                    <div className="flex h-16 w-16 items-center justify-center rounded-md border-2 border-black bg-white shadow-neo-sm">
                      <Icon className={iconColor} size={32} />
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="mb-2 font-heading text-xl">{title}</h3>
                    <p className="text-sm font-bold text-gray-600">{body}</p>
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
