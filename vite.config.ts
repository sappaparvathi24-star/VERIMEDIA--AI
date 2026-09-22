import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Resolves the HMR configuration for local vs. hosted reverse-proxy environments (such as AI Studio / Cloud Run).
 * 
 * In a hosted/proxied container environment, the public URL scheme and reverse-proxy port usually do not
 * terminate raw WebSocket connections on port 3000. When running in this context, we default to disabling
 * HMR (hmr: false) unless an explicit PUBLIC_HOST / HMR_CLIENT_PORT is specified. Full-page reload on save
 * prevents console spam and unhandled WebSocket closure errors.
 * 
 * To enable proxied HMR via your custom domain or reverse proxy, set:
 *   PUBLIC_HOST="your-service.run.app"
 *   HMR_CLIENT_PORT="443"
 *   HMR_PROTOCOL="wss"
 */
export function resolveHmrConfig() {
  // Explicit escape hatch via environment variable
  if (process.env.DISABLE_HMR === 'true') {
    return false;
  }

  // Explicit public host / port configuration for custom reverse-proxy setups
  const publicHost = process.env.PUBLIC_HOST || process.env.HMR_HOST;
  const clientPort = process.env.HMR_CLIENT_PORT ? parseInt(process.env.HMR_CLIENT_PORT, 10) : 443;
  const protocol = process.env.HMR_PROTOCOL || (clientPort === 443 ? 'wss' : 'ws');

  if (publicHost) {
    return {
      protocol,
      host: publicHost,
      clientPort,
    };
  }

  // Detect hosted / containerized / Cloud Run / AI Studio environment
  const isHostedOrProxied = Boolean(
    process.env.K_SERVICE ||
    process.env.CLOUD_RUN_JOB ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.CONTAINER ||
    process.env.AI_STUDIO ||
    process.env.DISABLE_HMR !== 'false' // default to disabled in hosted/proxied context
  );

  if (isHostedOrProxied) {
    // In hosted/proxied context without explicit public host, default to disabling HMR
    return false;
  }

  // Standard localhost development without reverse-proxy
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: resolveHmrConfig(),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})

