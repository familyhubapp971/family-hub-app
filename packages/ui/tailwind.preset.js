/**
 * Shared Tailwind preset for the Family Hub design system.
 * Apps that consume @familyhub/ui import this preset so the design
 * tokens (fonts, neo-brutalist shadows, kingdom palette, animations,
 * xs breakpoint) stay consistent across surfaces.
 *
 * Usage in apps/<app>/tailwind.config.js:
 *   import preset from '@familyhub/ui/tailwind.preset.js';
 *   export default { presets: [preset], content: ['./src/**\/*.{ts,tsx}'] };
 *
 * @type {import('tailwindcss').Config}
 */
export default {
  // The preset itself doesn't declare `content`. Each consuming app
  // sets its own content paths so Tailwind's JIT compiler scans the
  // right files.
  theme: {
    extend: {
      screens: {
        xs: '375px',
      },
      fontFamily: {
        // `display` is the legacy alias; `heading` is the alias used by the
        // Magic Patterns design imported in FHS-220. Both resolve to the
        // same font so existing code and ported MP code coexist without a
        // find-and-replace sweep.
        display: ['"Fredoka One"', 'cursive'],
        heading: ['"Fredoka One"', 'cursive'],
        body: ['Nunito', 'sans-serif'],
      },
      boxShadow: {
        'neo-xs': '1px 1px 0px 0px rgba(0,0,0,1)',
        'neo-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
        neo: '3px 3px 0px 0px rgba(0,0,0,1)',
        'neo-md': '4px 4px 0px 0px rgba(0,0,0,1)',
        'neo-lg': '6px 6px 0px 0px rgba(0,0,0,1)',
      },
      colors: {
        // Kingdom is the canonical brand purple. The full scale gives
        // designers room to layer surfaces (ChildWorld uses 700/800/950
        // for layered cards over the 900 background). The `bg` alias is
        // kept so legacy `bg-kingdom-bg` keeps working unchanged.
        kingdom: {
          50: '#f3e8ff',
          100: '#e9d5ff',
          200: '#d8b4fe',
          300: '#c084fc',
          400: '#a855f7',
          500: '#9333ea',
          600: '#6b21a8',
          700: '#5a1d8a',
          800: '#4a1578',
          900: '#3d1065',
          950: '#2a0b46',
          bg: '#3d1065',
        },
      },
      animation: {
        shake: 'shake 0.3s ease-in-out',
        // Slow drifting starfield used by .space-bg to give the kingdom
        // background subtle motion without being distracting.
        'space-bg': 'space-move 60s linear infinite',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-6px)' },
          '80%': { transform: 'translateX(6px)' },
        },
        'space-move': {
          from: { backgroundPosition: '0 0, 40px 60px, 130px 270px' },
          to: { backgroundPosition: '550px 550px, 390px 410px, 380px 520px' },
        },
      },
    },
  },
  plugins: [],
};
