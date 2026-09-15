import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  turbopack: { root: process.cwd() },
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "microphone=(self), camera=()" },
      { key: "X-Frame-Options", value: "DENY" },
    ] }];
  },
};
export default config;
