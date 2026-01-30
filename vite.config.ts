import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "profitchips.com",
      "www.profitchips.com",
    ],
  },
  preview: {
    allowedHosts: [
      "profitchips.com",
      "www.profitchips.com",
    ],
  },
  plugins: [react(), mode === "production" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
