import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};


function exposeNext(nextConfig: NextConfig) {
  console.log(nextConfig);

  return nextConfig;
}

export default exposeNext(nextConfig);