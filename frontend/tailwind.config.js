/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#17212B',
        secondary: '#243B53',
        tertiary: '#9A7652',
        neutral: '#F6F5F2',
        canvas: '#F6F5F2',
        surface: '#FFFFFF',
        'surface-dark': '#17212B',
        ink: '#17212B',
        muted: '#243B53',
        border: '#E6E1D9',
        coral: '#9A7652',
        'tertiary-strong': '#7A5A3B',
        success: '#0F8A5F',
        warning: '#B45309',
        danger: '#B42318',
        focus: '#2563EB',
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: "12px",
        pill: "9999px",
      },
      boxShadow: {
        card: "0 8px 24px rgba(23, 22, 28, 0.08)",
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 3s infinite',
        'float-slow': 'float 8s ease-in-out 1s infinite',
      },
    },
  },
  plugins: [],
}
