/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_AEGIS_API || "";

// Pragmatic CSP tuned for a Next.js + react-three-fiber app (WebGL workers, inline
// styles). Scripts allow 'unsafe-inline'/'unsafe-eval' because Next's runtime and some
// 3D libs need them; the rest is locked down (object-src none, frame-ancestors none).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${apiOrigin ? " " + apiOrigin : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // slim, self-contained server for Cloud Run
  poweredByHeader: false, // don't advertise the framework
  env: {
    NEXT_PUBLIC_AEGIS_API: apiOrigin,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
