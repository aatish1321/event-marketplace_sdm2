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
        // Text roles: primary (ink), secondary, muted. Muted stays above 6:1 on the paper canvas and white surface.
        primary: '#17212B',
        secondary: '#2B3744',
        muted: '#47515E',
        ink: '#17212B',
        // Warm paper page, white cards, hairline borders.
        canvas: '#F4EFE7',
        surface: '#FFFFFF',
        'surface-dark': '#17212B',
        border: 'rgba(23, 33, 43, 0.12)',
        // The one accent. 5.5:1 with white text, 4.7:1 as text on surface.
        accent: '#B04A0B',
        // Poster colours for events without a cover photo; all keep 6:1+ with white text.
        'poster-teal': '#0E6B66',
        'poster-plum': '#6A2C5E',
        'poster-cobalt': '#1F4E8C',
        success: '#0B6B4A',
        warning: '#B45309',
        danger: '#B42318',
        focus: '#2563EB',
      },
      fontFamily: {
        // Self-hosted via @fontsource-variable/geist (imported in main.jsx).
        sans: ['"Geist Variable"', 'Inter', 'system-ui', 'sans-serif'],
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
