import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,

  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "http://apbling-frontend-oxmtt4:3001/:path*",
      },
    ];
  },
};

export default nextConfig;
