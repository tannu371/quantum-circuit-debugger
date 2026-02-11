import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ["wholesome-heart-production.up.railway.app"],
};

export default nextConfig;
