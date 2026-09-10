import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#161512',
        surface: '#262421',
        'surface-hover': '#32302c',
        'surface-light': '#363430',
        board: {
          light: '#eeeed2',
          dark: '#769656',
          woodLight: '#f0d9b5',
          woodDark: '#b58863',
          highlight: 'rgba(255, 255, 0, 0.4)',
          selected: 'rgba(20, 85, 30, 0.5)',
        },
        eval: {
          white: '#ffffff',
          black: '#1f1e1b',
        },
        badge: {
          brilliant: '#26c2a3',
          great: '#5b8baf',
          best: '#81b64c',
          excellent: '#96bc4b',
          good: '#96bc4b',
          book: '#d5a47d',
          inaccuracy: '#f0c15c',
          mistake: '#e58f2a',
          blunder: '#ca3431',
          miss: '#ff5757',
        }
      },
    },
  },
  plugins: [],
};

export default config;
