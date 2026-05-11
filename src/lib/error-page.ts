export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>페이지를 불러오지 못했어요</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 "Pretendard Variable", system-ui, -apple-system, sans-serif; letter-spacing: -0.02em; word-break: keep-all; background: #ffffff; color: #0a0a0a; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 24px; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; font-weight: 700; margin: 0 0 8px; color: #0a0a0a; }
      p { color: #525252; font-weight: 500; margin: 0 0 24px; }
      .actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
      a, button { min-height: 44px; min-width: 44px; padding: 12px 24px; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #0a0a0a; color: #ffffff; }
      .secondary { background: #ffffff; color: #0a0a0a; border-color: #e5e5e5; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>페이지를 불러오지 못했어요</h1>
      <p>잠깐 문제가 생긴 것 같아요. 다시 시도해 주세요.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">다시 시도</button>
        <a class="secondary" href="/">홈으로</a>
      </div>
    </div>
  </body>
</html>`;
}
