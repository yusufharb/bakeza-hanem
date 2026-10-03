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
        bg: "#FAF7F2",
        surface: "#FFFFFF",
        ink: "#2B2620",
        muted: "#8A7F72",
        accent: {
          DEFAULT: "#A9762F",
          dark: "#8A5F22",
          soft: "#F1E6D4",
        },
        sage: {
          DEFAULT: "#5C7A5E",
          soft: "#E7EFE6",
        },
        danger: {
          DEFAULT: "#B5495B",
          soft: "#F7E7EA",
        },
        border: "#E8E1D6",
      },
      fontFamily: {
        tajawal: ["Tajawal", "system-ui", "sans-serif"],
        cairo: ["Cairo", "system-ui", "sans-serif"],
      },
      boxShadow: {
        warm: "0 2px 10px rgba(43, 38, 32, 0.06)",
        "warm-md": "0 4px 16px rgba(43, 38, 32, 0.08)",
        "warm-lg": "0 8px 24px rgba(43, 38, 32, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
