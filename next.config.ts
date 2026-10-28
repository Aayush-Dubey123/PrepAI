import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize barrel files / package imports to prevent loading 1500+ unneeded icons and heavy modules
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@clerk/nextjs",
      "ogl",
    ],
  },

  // Keep heavy backend/native packages external to avoid recompiling them on every route change
  serverExternalPackages: [
    "pg",
    "drizzle-orm",
    "dotenv",
    "@mediapipe/tasks-vision",
    "mammoth",
    "unpdf",
  ],
};

export default nextConfig;
