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
        // Text roles: primary (ink), secondary, muted. Muted is about 5.8:1 on canvas, more on surface.
        primary: '#17212B',
        secondary: '#2B3744',
        muted: '#47515E',
        ink: '#17212B',
        // Surfaces and hairline.
        canvas: '#D8DAE0',
        surface: '#ECEEF3',
        'surface-dark': '#17212B',
        border: 'rgba(23, 33, 43, 0.12)',
        // The one accent. 5.5:1 with white text, 4.7:1 as text on surface.
        accent: '#B04A0B',
        success: '#0B6B4A',
        warning: '#B45309',
        danger: '#B42318',
        focus: '#2563EB',
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: "12px",
        control: "10px",
      },
      boxShadow: {
        card: "0 8px 24px rgba(23, 22, 28, 0.08)",
      },
    },
  },
  plugins: [],
}
