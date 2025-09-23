import type { NextConfig } from "next";
import { clientEnvConfig } from "./lib/config/envConfig";

clientEnvConfig.NEXT_PUBLIC_APP_ENV; // load env variables to validate if something is missing

const nextConfig: NextConfig = {
  /* config options here */
  // Disable React Strict Mode in development to prevent double-invocation of effects
  reactStrictMode: false,
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        hostname: "assets.coingecko.com",
      },
    ],
  },
};

export default nextConfig;
