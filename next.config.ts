import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The mentor route (/api/mentor/hint) reads mission YAML at runtime via getMissionById, so the
  // mission files must be traced into that function's deployment bundle (phase 10).
  outputFileTracingIncludes: {
    "/api/mentor/hint": ["src/content/missions/**/*"],
  },
};

export default nextConfig;
