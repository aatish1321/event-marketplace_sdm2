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
        canvas: '#F8F6F2',
        surface: '#FFFFFF',
        'surface-dark': '#252525',
        ink: '#17161C',
        muted: '#6C6872',
        border: '#E6E1D9',
        coral: '#FF5A47',
        'coral-strong': '#C9382E',
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
    },
  },
  plugins: [],
}
