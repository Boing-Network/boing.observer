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
        boing: {
          black: "#050c18",
          navy: "#0a1628",
          "navy-mid": "#0d1f3c",
        },
        network: {
          primary: "#7c3aed",
          "primary-light": "#a78bfa",
          cyan: "#00e8c8",
          "cyan-light": "#90e0ef",
          aurora: "#00b4d8",
          nebula: "#a78bfa",
          gold: "#fbbf24",
        },
      },
      fontFamily: {
        sans: ["var(--font-comfortaa)", "system-ui", "sans-serif"],
        display: ["var(--font-comfortaa)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(124, 58, 237, 0.22)",
        "glow-cyan": "0 0 24px rgba(0, 232, 200, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
