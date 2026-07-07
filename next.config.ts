import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.buckysolutions.com",
      },
    ],
  },
};

export default nextConfig;
