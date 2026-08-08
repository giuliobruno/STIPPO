import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL || "http://localhost:3000";
const allowCleartext =
  serverUrl.startsWith("http://") && !serverUrl.includes("https://");

const config: CapacitorConfig = {
  appId: "ai.stippo.app",
  appName: "Stippo",
  webDir: "out",
  server: {
    url: serverUrl,
    // Cleartext only for local LAN testing — never for https production URLs.
    cleartext: allowCleartext,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
    },
  },
};

export default config;
