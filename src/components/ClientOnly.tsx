"use client";

import { useEffect, useState } from "react";

// SSR 차단 래퍼 — react-day-picker #418 회피용. 서버 렌더 제외, 클라 마운트 후에만 children 렌더.
export function ClientOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : <>{fallback ?? null}</>;
}
