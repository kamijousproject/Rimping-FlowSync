import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
  async rewrites() {
    return [
      { source: "/manual", destination: "/manual.html" },
    ];
  },
};

export default nextConfig;
