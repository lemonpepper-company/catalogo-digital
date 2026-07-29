import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: [...configDefaults.exclude, "**/.claude/worktrees/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      // `server-only` é resolvido pelo bundler do Next e não existe em
      // node_modules — sem este alias, todo teste de módulo server-only falha
      // na transformação do Vite.
      "server-only": resolve(__dirname, "test-utils/server-only.ts"),
    },
  },
});
