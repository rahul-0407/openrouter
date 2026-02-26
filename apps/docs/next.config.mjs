import nextra from "nextra";

const withNextra = nextra({
  // empty — use defaults
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withNextra(nextConfig);
