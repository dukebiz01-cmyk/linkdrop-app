// Cloudflare Worker 의 live env/ctx 를 요청 단위로 흘리는 AsyncLocalStorage.
//
// 배경: `import { env } from "cloudflare:workers"` 가 TanStack Start 의
//   server route 핸들러 컨텍스트에서 undefined 로 잡히는 회색지대가 있어
//   env.KV 접근이 전부 스킵됐다. 워커 진입점(src/server.ts)이 fetch 인자로
//   받는 env 는 확실히 살아있으므로, 그 값을 ALS 에 담아 라우트 핸들러가
//   getWorkerEnv() 로 꺼내 쓴다. 동시요청 안전을 위해 모듈 전역 변수가
//   아니라 반드시 ALS 를 쓴다.
//
// .server.ts suffix → Vite 가 클라이언트 번들에서 제거.

import { AsyncLocalStorage } from "node:async_hooks";

export const workerEnvStore = new AsyncLocalStorage<{ env: unknown; ctx?: unknown }>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getWorkerEnv(): any | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (workerEnvStore.getStore()?.env as any) ?? null;
}
