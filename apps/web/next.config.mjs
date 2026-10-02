/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `output: 'standalone'` genera `.next/standalone` con un servidor.js
  // autónomo y copia sólo las dependencias necesarias para producción.
  // Es el layout que consume la imagen Docker (apps/web/Dockerfile).
  output: 'standalone',
};

export default nextConfig;
