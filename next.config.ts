import type { NextConfig } from "next";

/**
 * Business logos are user-uploaded to Supabase Storage (`business-logos`
 * bucket), so next/image needs the project's storage host allow-listed.
 * Read from env at build time and guarded — a missing env must never break
 * the build; remote logos simply won't optimize until it is set.
 */
const supabaseStorageHost = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const host = new URL(raw).hostname;
    return host ? host : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: supabaseStorageHost
      ? [{ protocol: "https", hostname: supabaseStorageHost }]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
