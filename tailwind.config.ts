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
          black: "#050A1A",
          navy: "#0A1128",
          "navy-mid": "#101A38",
        },
        network: {
          primary: "#3B8CFF",
          "primary-light": "#8DB8FF",
          cyan: "#3B8CFF",
          "cyan-light": "#8DB8FF",
          aurora: "#3B8CFF",
          nebula: "#8DB8FF",
          gold: "#3B8CFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-comfortaa)", "system-ui", "sans-serif"],
        display: ["var(--font-comfortaa)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(59, 140, 255, 0.22)",
        "glow-cyan": "0 0 24px rgba(59, 140, 255, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
