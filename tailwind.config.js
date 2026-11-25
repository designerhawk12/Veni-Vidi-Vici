/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design Brief §14 tokens
        ink: '#14110F',
        charcoal: '#34312D',
        slate: '#7E7F83',
        sand: '#D9C5B2',
        mist: '#F3F3F4',
        'status-stale': '#E07A5F',
        'status-advice': '#E3B23C',
        'status-ok': '#8FB996',
      },
      borderRadius: {
        'card': '16px',
        'control': '12px',
      },
      spacing: {
        'space': '4px',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'caption': ['12px', { lineHeight: '1.4', letterSpacing: '0.3px' }],
        'body': ['14px', { lineHeight: '1.5', letterSpacing: '0' }],
        'card-body': ['16px', { lineHeight: '1.5', letterSpacing: '0' }],
        'card-title': ['20px', { lineHeight: '1.3', letterSpacing: '-0.02em' }],
        'screen-title': ['28px', { lineHeight: '1.2', letterSpacing: '-0.03em' }],
        'stage-readiness': ['40px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        'card': '0 2px 6px #17365306',
        'card-hover': '0 6px 15px #263d5b0b',
        'modal': '0 24px 70px #0e1b3370',
      },
      transitionDuration: {
        'motion': '150ms',
        'motion-slow': '250ms',
      },
      transitionTimingFunction: {
        'ease-out': 'ease-out',
      },
    },
  },
  plugins: [],
}