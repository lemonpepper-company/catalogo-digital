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
        // NOTE: these read the "-rgb" CSS vars (raw "R G B" channels), not the hex
        // "--color-bg"/"--color-surface"/"--color-border" vars. Tailwind v3's alpha-
        // modifier syntax (e.g. `bg-sand/70`, `border-sand/50`) needs to inject an
        // alpha channel into the color value at class-generation time, which only
        // works with rgb()/hsl() + the special `<alpha-value>` placeholder — it
        // can't parse channels out of an opaque `var(--color-bg)` reference, so a
        // plain `var(...)` here would silently DROP every alpha-modified utility
        // (no CSS rule emitted at all, no build error). See app/globals.css for the
        // "-rgb" vars themselves and app/[slug]/CatalogoClient.tsx for how per-store
        // theme overrides also set the "-rgb" vars via hexToRgbChannels().
        ivory: "rgb(var(--color-bg-rgb) / <alpha-value>)",
        linen: "rgb(var(--color-surface-rgb) / <alpha-value>)",
        graphite: "#3D3D3D",
        sand: "rgb(var(--color-border-rgb) / <alpha-value>)",
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
        card: "var(--radius-card)",
        btn: "var(--radius-btn)",
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
