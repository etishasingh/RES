/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', 'serif'],
        body: ['Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          deepBlue: '#003C5F',
          deepBlueHover: '#002E4A',
          deepBlueDark: '#002237',
          warmWhite: '#FDFBF7',
          warmWhiteMuted: '#F4EFE6',
          warmWhiteBorder: '#E6DEC9',
        },
        deepBlue: {
          DEFAULT: '#003C5F',
          hover: '#002E4A',
          dark: '#002237',
        },
        paper: {
          DEFAULT: '#FDFBF7',
          surface: '#FDFBF7',
          subtle: '#F6F3EC',
          muted: '#EDE7DC',
          border: 'rgba(0, 60, 95, 0.14)',
          text: '#003C5F',
          secondary: '#455A6A',
        },
        status: {
          success: '#3D7A5A',
          caution: '#A86315',
          error: '#A33E3E',
          neutral: '#64748B',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      keyframes: {
        'fade-rise': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-rise': 'fade-rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
};
