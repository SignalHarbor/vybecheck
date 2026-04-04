/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand ─────────────────────────────────────────
        vybe: {
          red:    { DEFAULT: '#F14573', dark: '#C91457' },
          blue:   { DEFAULT: '#539DC0', dark: '#3A7FA0' },
          yellow: { DEFAULT: '#FEC539', dark: '#B8860B' },
          purple: { DEFAULT: '#63688C', dark: '#4E5278' },
          gold:   '#9A7200',   // dark-gold text used on yellow tints
        },

        // ── Surfaces / Backgrounds ────────────────────────
        surface: {
          page:       '#F7F8FC',  // light page bg
          'page-dark': '#0E1020', // dark page bg
          card:       '#15182A',  // dark card / bottom-nav bg
          header:     '#1A1A2E',  // header gradient start & light-mode primary text
          'header-to': '#262646', // header gradient end
          sidebar:    '#17162A',  // sidebar bg (Root)
        },

        // ── Tints (soft colored badge / pill backgrounds) ─
        tint: {
          blue:   '#EAF4FB',  // info badges, "upcoming" pills
          yellow: '#FFF6D8',  // vybes-related badges, streak pills
          pink:   '#FDEAF1',  // live badges, active bottom-nav icon bg
          green:  '#DCFCE7',  // "free" badges, success states
          muted:  '#EEF0F6',  // neutral/inactive badges
        },

        // ── Borders ───────────────────────────────────────
        'border-light': '#E6EAF2', // light-mode card/section borders

        // ── Text (semantic helpers) ───────────────────────
        ink: {
          DEFAULT: '#1A1A2E', // primary text in light mode
          muted:   '#63688C', // secondary / muted text
        },

        // ── Status ────────────────────────────────────────
        status: {
          live:    '#E53935', // online / live dot
          success: { DEFAULT: '#22C55E', dark: '#16A34A' },
        },

        twitter: '#1DA1F2',
      },

      fontFamily: {
        sans: ['Nunito', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Segoe UI', 'Roboto', 'sans-serif'],
      },

      boxShadow: {
        // Existing
        'app':        '0 0 50px rgba(0, 0, 0, 0.3)',
        'card':       '0 2px 16px rgba(0, 0, 0, 0.08)',
        'card-sm':    '0 2px 12px rgba(0, 0, 0, 0.06)',
        'primary':    '0 4px 20px rgba(99, 102, 241, 0.4)',
        'primary-sm': '0 2px 12px rgba(99, 102, 241, 0.4)',
        'emerald':    '0 4px 16px rgba(16, 185, 129, 0.3)',
        'twitter':    '0 4px 20px rgba(29, 161, 242, 0.4)',
        'nav':        '0 -2px 20px rgba(0, 0, 0, 0.08)',
        'dialog':     '0 20px 60px rgba(0, 0, 0, 0.3)',

        // Brand glows (buttons & cards)
        'glow-red':      '0 6px 20px rgba(241, 69, 115, 0.27)',
        'glow-red-sm':   '0 4px 14px rgba(241, 69, 115, 0.27)',
        'glow-red-lg':   '0 8px 28px rgba(241, 69, 115, 0.4), 0 2px 10px rgba(0, 0, 0, 0.18)',
        'glow-blue':     '0 4px 14px rgba(83, 157, 192, 0.27)',
        'glow-yellow':   '0 4px 14px rgba(254, 197, 57, 0.33)',
        'glow-yellow-lg':'0 8px 26px rgba(254, 197, 57, 0.33)',
        'glow-muted':    '0 6px 18px rgba(99, 104, 140, 0.27)',

        // Subtle card shadows
        'card-muted':  '0 4px 20px rgba(99, 104, 140, 0.06)',
        'card-blue':   '0 4px 24px rgba(83, 157, 192, 0.08)',
        'card-pink':   '0 4px 20px rgba(241, 69, 115, 0.08)',
        'card-yellow': '0 4px 20px rgba(254, 197, 57, 0.2)',
        'card-dark':   '0 8px 32px rgba(26, 26, 46, 0.3)',

        // Phone frame (Root mockup shell)
        'phone': '0 0 0 1px rgba(255,255,255,0.08), 0 40px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.12)',
      },

      backgroundImage: {
        // Header / dark panels
        'gradient-header': 'linear-gradient(160deg, #1A1A2E 0%, #262646 100%)',
        'gradient-dark':   'linear-gradient(135deg, #1A1A2E 0%, #262646 100%)',

        // Brand button gradients
        'gradient-red':    'linear-gradient(135deg, #F14573 0%, #C91457 100%)',
        'gradient-blue':   'linear-gradient(135deg, #539DC0 0%, #3A7FA0 100%)',
        'gradient-yellow': 'linear-gradient(135deg, #B8860B 0%, #FEC539 100%)',
        'gradient-muted':  'linear-gradient(135deg, #63688C 0%, #4E5278 100%)',
      },

      animation: {
        'spin-fast': 'spin 0.8s linear infinite',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      maxWidth: {
        'app': '430px',
      },
    },
  },
  plugins: [],
}
