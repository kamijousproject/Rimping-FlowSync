import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/manual", destination: "/manual.html" },
    ];
  },
};

export default nextConfig;
