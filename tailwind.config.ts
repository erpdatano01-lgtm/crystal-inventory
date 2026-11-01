import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        crystal: {
          50: '#f6f8fb',
          100: '#edf1f7',
          200: '#d7e1ee',
          300: '#b4c8df',
          400: '#8baacb',
          500: '#698fb7',
          600: '#52749d',
          700: '#435e80',
          800: '#3a4f6a',
          900: '#344358',
          950: '#222b39',
        },
        amethyst: {
          50: '#faf5ff',
          100: '#f3e8ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        },
        rose: {
          50: '#fff1f2',
          100: '#ffe4e6',
          500: '#f43f5e',
          600: '#e11d48',
        },
        citrine: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
        }
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Prompt', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
export default config;
