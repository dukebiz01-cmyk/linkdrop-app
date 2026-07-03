// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // dev 포트 8080 고정. strictPort:true = 8080 점유 시 다른 포트로 silent 드리프트
  //   (8082 등) 하지 않고 에러로 멈춤 → 카카오 도메인 매칭 안정화.
  vite: {
    server: { port: 8080, strictPort: true, allowedHosts: [".trycloudflare.com", "dev.drop.how"] },
  },
});
