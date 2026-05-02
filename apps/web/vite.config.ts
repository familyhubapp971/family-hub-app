import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Source-map upload only fires when the full Sentry CI bundle is
  // present. Locally we still emit source maps (build.sourcemap: true)
  // for in-browser debugging — just don't upload them anywhere.
  const sentryAuth: string | undefined = env.SENTRY_AUTH_TOKEN;
  const sentryOrg: string | undefined = env.SENTRY_ORG;
  const sentryProject: string | undefined = env.SENTRY_PROJECT_WEB;

  const sentryPlugin =
    sentryAuth && sentryOrg && sentryProject
      ? sentryVitePlugin({
          org: sentryOrg,
          project: sentryProject,
          authToken: sentryAuth,
          ...(env.VITE_SENTRY_RELEASE ? { release: { name: env.VITE_SENTRY_RELEASE } } : {}),
          telemetry: false,
        })
      : null;

  return {
    plugins: [react(), ...(sentryPlugin ? [sentryPlugin] : [])],
    build: {
      sourcemap: true,
    },
    server: {
      port: 5273,
      strictPort: true,
      proxy: {
        // Forward /api/* to the Hono API during dev so the browser sees
        // a single origin and we don't need CORS yet.
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      port: 5273,
      strictPort: true,
    },
  };
});
