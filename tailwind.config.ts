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
          black: "#050b16",
          navy: "#071222",
          "navy-mid": "#0c1c34",
        },
        network: {
          primary: "#ffe14a",
          "primary-light": "#fff3a8",
          cyan: "#ffe14a",
          "cyan-light": "#fff3a8",
          aurora: "#ffe14a",
          nebula: "#fff3a8",
          gold: "#ffe14a",
        },
      },
      fontFamily: {
        sans: ["var(--font-comfortaa)", "system-ui", "sans-serif"],
        display: ["var(--font-comfortaa)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(255, 225, 74, 0.22)",
        "glow-cyan": "0 0 24px rgba(255, 225, 74, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
