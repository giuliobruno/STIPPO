import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ai.visualmemory.app",
  appName: "Visual Memory",
  webDir: "out",
  server: {
    // Dev: point at Next.js. Production: host the Next app and use that URL,
    // or export a static shell that loads the remote app.
    url: process.env.CAPACITOR_SERVER_URL || "http://localhost:3000",
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;
