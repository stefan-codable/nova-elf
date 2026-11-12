import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = "http://127.0.0.1:4311";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4310,
    proxy: { "/api": api, "/uploads": api },
  },
});
