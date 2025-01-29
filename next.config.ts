import type { NextConfig } from "next";

const nextConfig: NextConfig = {
};

function exposeNext(nextConfig: NextConfig) {
  console.log(nextConfig);

  return nextConfig;
}

export default exposeNext(nextConfig);
