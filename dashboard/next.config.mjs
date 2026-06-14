/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // slim, self-contained server for Cloud Run
  env: {
    NEXT_PUBLIC_AEGIS_API: process.env.NEXT_PUBLIC_AEGIS_API || "",
  },
};

export default nextConfig;
