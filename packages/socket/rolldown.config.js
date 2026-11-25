import { defineConfig } from "rolldown"

export default defineConfig({
  input: "src/index.ts",
  platform: "node",
  transform: {
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  },
  output: {
    file: "dist/index.cjs",
    format: "cjs",
    // Le pdf.js de unpdf est chargé par un import dynamique : tout reste dans index.cjs.
    codeSplitting: false,
    minify: true,
    sourcemap: true,
  },
})
