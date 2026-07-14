import { defineConfig } from "../../src/index.js";

export default defineConfig({
  app: { packageName: "com.example.tsapp" },
  device: { avd: "Pixel_7_API_34" },
  frame: { template: "solid", background: "#101010" },
  publish: { serviceAccountKeyPath: "./secrets/key.json" },
  screens: [{ id: "home", flow: "flows/home.yaml", caption: "TS caption" }],
});
