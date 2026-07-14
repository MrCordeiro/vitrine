import { defineConfig } from "vitrine";

export default defineConfig({
  app: {
    packageName: "com.example.myapp",
    // apkPath: "./builds/app-release.apk", // optional; omit if already installed
  },
  device: {
    avd: "Pixel_7_API_34",
    locale: "en-US",
  },
  frame: {
    template: "gradient",
    background: ["#1a1a2e", "#16213e"],
    textColor: "#ffffff",
    font: "Inter",
  },
  publish: {
    serviceAccountKeyPath: "./secrets/play-service-account.json",
    track: "listing",
  },
  screens: [
    {
      id: "home",
      flow: "flows/home.yaml",
      caption: "Track everything in one place",
    },
    {
      id: "profile",
      flow: "flows/profile.yaml",
      caption: "Your data, your way",
    },
    {
      id: "settings",
      flow: "flows/settings.yaml",
      caption: "Make it yours",
    },
  ],
});
