import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "mammoth",
    "docxtemplater",
    "pizzip",
  ],
};

export default nextConfig;
