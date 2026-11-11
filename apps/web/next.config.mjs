/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR lets a second build/dev server run beside an existing one without corrupting its .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
