/**
 * Shared Tailwind preset for the Family Hub design system.
 * Apps that consume @familyhub/ui import this preset so the design
 * tokens (fonts, neo-brutalist shadows, kingdom colour, shake
 * animation, xs breakpoint) stay consistent across surfaces.
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
        display: ['"Fredoka One"', 'cursive'],
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
        kingdom: {
          bg: '#3d1065',
        },
      },
      animation: {
        shake: 'shake 0.3s ease-in-out',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-8px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-6px)' },
          '80%': { transform: 'translateX(6px)' },
        },
      },
    },
  },
  plugins: [],
};
