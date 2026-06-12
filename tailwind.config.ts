import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: "#0D0D0D",
        gold: "#C9A96E",
        "gold-hover": "#BD9A5C",
        ivory: "#F9F9F7",
        linen: "#F0EDE8",
        graphite: "#3D3D3D",
        sand: "#E2DFDA",
        "surface-hover": "#E7E2DB",
        success: "#1A9C6E",
        soldout: "#C47E00",
        error: "#C0392B",
        "error-surface": "#FDECEA",
        inactive: "#B0ADA8",
      },
      fontFamily: {
        display: ["var(--font-sora)", "sans-serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        btn: "8px",
        pill: "999px",
        input: "8px",
        modal: "20px",
      },
      maxWidth: {
        page: "1200px",
        content: "980px",
        form: "760px",
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "8": "32px",
        "12": "48px",
      },
      transitionDuration: {
        fast: "120ms",
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};

export default config;
