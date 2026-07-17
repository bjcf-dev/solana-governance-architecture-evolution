/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        solana: {
          purple: "#9945FF",
          "purple-dark": "#7A2FE0",
          "purple-glow": "rgba(153,69,255,0.3)",
          black: "#0D0E14",
          "black-2": "#14151E",
          "black-3": "#1C1D2A",
          "neon-green": "#00FF9D",
          cyan: "#00D4FF",
          white: "#F0F0F5",
          gray: "#8888A0",
        },
      },
      backdropBlur: {
        xs: "2px",
        glass: "8px",
      },
      boxShadow: {
        "purple-glow": "0 0 20px rgba(153,69,255,0.3)",
        "neon-glow": "0 0 20px rgba(0,255,157,0.3)",
      },
    },
  },
  plugins: [],
};
