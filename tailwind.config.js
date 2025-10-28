/** @type {import('tailwindcss').Config} */
// Dark theme update - gray-900 is white
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#111827',  // Navy blue
          700: '#0f172a',  // Darker navy
          800: '#0c1220',
          900: '#020617',
        },
        blue: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#111827',  // Navy blue - this overrides default Tailwind blue-600
          700: '#0f172a',
          800: '#0c1220',
          900: '#020617',
        },
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#d1d5db',  // Light gray for dark backgrounds
          700: '#e5e7eb',  // Lighter
          800: '#f3f4f6',  // Even lighter
          900: '#ffffff',  // White - for text on dark backgrounds
        },
        secondary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        }
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
