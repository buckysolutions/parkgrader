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
  async redirects() {
    return [
      {
        source: "/terms",
        destination: "https://www.buckysolutions.com/terms-and-conditions/",
        permanent: true,
        basePath: false,
      },
      {
        source: "/privacy-policy",
        destination: "https://www.buckysolutions.com/privacy-policy/",
        permanent: true,
        basePath: false,
      },
      {
        source: "/cookie-policy",
        destination: "https://www.buckysolutions.com/cookie-policy/",
        permanent: true,
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
