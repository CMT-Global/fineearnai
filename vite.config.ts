import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname);
  const env = loadEnv(mode, envDir, "");
  return {
    envDir,
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(env.VITE_SUPABASE_URL ?? ""),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ""),
    },
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
  };
});
