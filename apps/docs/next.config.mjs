import nextra from "nextra";

const withNextra = nextra({
  // empty — use defaults
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,
  images: {
    unoptimized: true, // Useful for static exports or simple deployments
  },
};

export default withNextra(nextConfig);
