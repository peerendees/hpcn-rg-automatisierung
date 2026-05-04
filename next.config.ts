import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "mammoth",
    "docxtemplater",
    "pizzip",
  ],
  /** Chromium-Binärpakete für PDF (Serverless / File Tracing) mit ausliefern */
  outputFileTracingIncludes: {
    "/api/generate": [
      "./node_modules/@sparticuz/chromium/**/*",
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
};

export default nextConfig;
