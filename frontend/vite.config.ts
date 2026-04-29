import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/d3-")) return "d3";
          if (id.includes("node_modules/recharts")) return "recharts";
          if (id.includes("node_modules/@supabase")) return "supabase";
        },
      },
    },
  },
});
