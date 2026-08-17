import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,

  async rewrites() {
    return [
      {
        source: "/backend/:path*",
        destination: "https://apiapbling.aptechinfo.com.br:75/:path*",
      },
    ];
  },
};

export default nextConfig;
