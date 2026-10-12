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
        tertiary: '#C85A17',
        neutral: '#74777C',
        canvas: '#D8DAE0',
        surface: '#ECEEF3',
        'surface-dark': '#17212B',
        ink: '#17212B',
        muted: '#243B53',
        border: '#C3C6CD',
        coral: '#C85A17',
        'coral-strong': '#C85A17',
        'tertiary-strong': '#C85A17',
        'tertiary-light': '#C85A17',
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
