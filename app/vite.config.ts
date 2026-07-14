/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.tsx"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/utils/**", "src/hooks/**", "src/components/**", "src/context/**"],
      thresholds: {
        "src/utils/": { branches: 80, functions: 80, lines: 80 },
        "src/hooks/": { branches: 65, functions: 70, lines: 70 },
        "src/components/": { branches: 65, functions: 70, lines: 70 },
      },
    },
  },
});
