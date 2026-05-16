# LinkDrop v0 디자인 통합 계획서

## 현재 상태 (사전 확인)

- Branch: main (commit 0f588a3 — @supabase/ssr cookie auth 적용 완료)
- v0 결과물 소스: `C:\Users\THE E&M\Downloads\info-drop-card-component__6_.zip`
  (만약 경로 다르면 Duke에게 정확한 경로 받기)
- 프레임워크: TanStack Start SSR (Next.js 아님 — "use client" 지시문 사용 X)
- 디자인 시스템: 흰 bg / 검정 텍스트 / 그레이톤 / #2563EB primary / #10B981 status / Lucide line / 이모지 X
- 5종 역할 (절대 변경 X): Creator / Maker / Friend / Local / LinkDrop
- 팔로우 기능 없음 (LinkDrop UX 모델 아님)
- 브랜드 모티프 SVG UI 안에 박지 마 (이전 실수 — 메모리에 정정 박힘)

---

## 작업 단계

### Step 1. v0 zip 압축 풀기

PowerShell (bash는 & 때문에 깨질 수 있음):

```powershell
$zipPath = "C:\Users\THE E&M\Downloads\info-drop-card-component__6_.zip"
$outPath = "C:\Users\THE E&M\Desktop\linkdrop-app\linkdrop-v0-integration"

if (Test-Path $zipPath) {
  Expand-Archive -Path $zipPath -DestinationPath $outPath -Force
  Write-Host "압축 풀기 완료: $outPath"
} else {
  Write-Host "ERROR: zip 파일 못 찾음. Duke에게 경로 확인 필요"
  Get-ChildItem "C:\Users\THE E&M\Downloads\" -Filter "*info-drop*"
}
```

zip이 없으면 작업 중단하고 Duke에게 알림.

### Step 2. 압축 결과 확인

```powershell
Get-ChildItem -Recurse "C:\Users\THE E&M\Desktop\linkdrop-app\linkdrop-v0-integration\components" |
  Select-Object FullName
```

기대 결과:
- `linkdrop-v0-integration/components/info-drop-page.tsx`
- `linkdrop-v0-integration/components/info-drop-card.tsx`
- `linkdrop-v0-integration/components/ui/*.tsx` (대략 56개)

### Step 3. 메인 컴포넌트 이식

#### 3-1. info-drop-page.tsx 복사 + 정리

```
복사:
linkdrop-v0-integration/components/info-drop-page.tsx
  → src/components/info-drop-page.tsx

수정:
- 첫 줄 "use client"; 제거 (TanStack Start는 Next.js X)
- import 경로 @/components/ui/* 그대로 유지 (LinkDrop tsconfig paths와 일치하는지 확인)
- 다른 모든 코드 그대로 유지
```

#### 3-2. info-drop-card.tsx 복사 + 정리

```
복사:
linkdrop-v0-integration/components/info-drop-card.tsx
  → src/components/info-drop-card.tsx

수정:
- "use client" 제거
- import 경로 검증
```

### Step 4. shadcn ui 컴포넌트 selective merge

각 파일에 대해:

1. `linkdrop-v0-integration/components/ui/{이름}.tsx`
2. `src/components/ui/{이름}.tsx` 이미 존재하는지 확인
3. **이미 존재 → SKIP (덮어쓰지 않음)** — LinkDrop 기존 커스터마이징 보존
4. **없음 → 복사**

처리 후 새로 추가된 파일 목록 출력. (예: `["badge.tsx", "skeleton.tsx", ...]`)

### Step 5. /d/$shareUuid 라우트 생성

#### 5-1. 메인 라우트 (anon 접근)

파일: `src/routes/d.$shareUuid.tsx` 또는 `src/routes/d/$shareUuid.tsx`
(기존 라우트 패턴 따름 — `_user.create.tsx` 같은 dot notation이면 dot, 폴더 구조면 폴더)

⚠ **_user 가드 X** — Friend가 카톡으로 받아 비로그인 상태로 클릭함

로직:
```tsx
import { createFileRoute } from '@tanstack/react-router';
import { InfoDropPage } from '@/components/info-drop-page';
// import { supabase } from '@/lib/supabase';

export const Route = createFileRoute('/d/$shareUuid')({
  head: () => ({ meta: [{ title: 'LinkDrop Drop' }] }),
  loader: async ({ params }) => {
    // TODO Phase 2: 실제 RPC 호출
    // const { data, error } = await supabase.rpc('public_drop_get', {
    //   p_share_uuid: params.shareUuid
    // });
    // if (error) throw new Error('Drop not found');
    // return data;
    
    // 현재: 더미 데이터 (RPC 미구현)
    return {
      shareUuid: params.shareUuid,
      // ... InfoDropPageProps에 맞는 더미 데이터
    };
  },
  component: DropPage,
});

function DropPage() {
  const data = Route.useLoaderData();
  return (
    <InfoDropPage
      videoThumbnailUrl="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800"
      videoDurationSec={154}
      videoSourceLabel="YouTube"
      maker={{ name: "Duke", droppedAgo: "2시간 전" }}
      makerMessage="여기 진짜 분위기 좋더라"
      title="여기 분위기 진짜 좋더라, 작업하기 딱이야"
      description="창가 자리에서 노을 보면서 커피 마시면 시간 가는 줄 몰라."
      intent="coupon"
      local={{
        name: "노을재 카페",
        category: "카페",
        distance: "0.8km",
        address: "서울 강남구",
        statusLabel: "영업중",
        hoursLabel: "22:00까지",
        rating: 4.8,
        reviewCount: 127,
      }}
      creator={{
        channelName: "카페탐방러",
        channelUrl: "https://youtube.com/@cafehunter"
      }}
      onPrimaryAction={() => console.log('[d] primary action: coupon')}
      onWatchOriginal={() => window.open('https://youtu.be/dQw4w9WgXcQ', '_blank')}
      onShare={() => console.log('[d] share')}
      onBack={() => window.history.back()}
      onSave={() => console.log('[d] save (Phase 2 wiring)')}
      onForward={() => console.log('[d] forward to friend')}
    />
  );
}
```

#### 5-2. 더미 미리보기 라우트

파일: `src/routes/d.test.tsx`
- 위와 동일한 InfoDropPage 렌더링 (하드코딩 더미)
- 디자인 검증용
- URL: `http://localhost:8080/d/test`로 접근

### Step 6. 정리 작업

#### 6-1. linkdrop-v0-integration/ 폴더 처리

```powershell
# 옵션 1: 삭제
Remove-Item -Recurse -Force "C:\Users\THE E&M\Desktop\linkdrop-app\linkdrop-v0-integration"

# 옵션 2: .gitignore 추가 (보존하되 커밋 안 함)
Add-Content "C:\Users\THE E&M\Desktop\linkdrop-app\.gitignore" "`nlinkdrop-v0-integration/"
```

**옵션 2 권장** — 나중에 재이식 필요할 때 참조 가능.

### Step 7. 검증

```powershell
# 타입 체크
bunx tsc --noEmit

# 린트
bun run lint

# 디자인 시스템 위반 검사
Select-String -Path "src/components/info-drop-page.tsx" -Pattern "🎯|⭐|❤️|👋|emoji|Motif" -CaseSensitive
# 결과 0건이어야 함
```

dev 서버:
```powershell
bun run dev
```

브라우저:
- `http://localhost:8080/d/test` (anon 접근)
- 로그인 X 상태에서도 페이지 렌더 확인

### Step 8. commit (별도 브랜치)

```powershell
git checkout -b feat/info-drop-page-v0
git add src/components/info-drop-page.tsx
git add src/components/info-drop-card.tsx
git add src/components/ui/  # 새로 추가된 파일들만
git add src/routes/d.*       # 새 라우트들
git add .gitignore           # linkdrop-v0-integration/ 무시 추가됐다면

git commit -m "feat(ui): integrate v0 info-drop-page design

- Add InfoDropPage + InfoDropCard from v0.app
- Add /d/\$shareUuid anon route (Friend entry point)
- Add /d/test dummy preview route
- Merge missing shadcn ui components (preserve existing)

Design system: white bg, black text, gray scale, #2563EB primary, #10B981 status
No motif, no follow, no emojis (refs: memories #20, #21)

Refs: §0 헌법 4-5단계, 5종 역할 (Creator/Maker/Friend/Local/LinkDrop)"

git push -u origin feat/info-drop-page-v0
```

---

## 보고 양식 (작업 끝나면)

```
- 압축 풀기: OK / 실패 (사유)
- 새로 추가된 src/components/ui/*: [파일명 목록]
- /d/test 렌더: OK / 에러 (1줄)
- bunx tsc --noEmit: 0 errors / N errors (파일명)
- bun run lint: 0 errors / N errors
- 디자인 시스템 위반 grep: 0건 / 발견 (어디)
- commit hash: xxxxxxx
- 브랜치: feat/info-drop-page-v0
- push: OK
```

---

## 금지 사항

- `"use client"` 디렉티브 유지 X (TanStack Start)
- 팔로우 UI / prop 추가 X (LinkDrop UX 모델 아님)
- 모티프 SVG 추가 X (이전 실수, 메모리 #21 참조)
- 이모지 추가 X
- 5종 역할 용어 변경 X (Creator/Maker/Friend/Local/LinkDrop)
- main 브랜치 직접 commit X (별도 브랜치)
- public_drop_get RPC 정식 구현 X (Phase 2 작업, 지금은 더미만)
- linkdrop-v0-integration/ 폴더 자체를 git commit X
- Project ref xukxtzjfqfwalqpmfidb 외 환각 X

---

## 막힐 때 보고

각 Step에서 막히면 Step 번호 + 1줄 에러 메시지로 Duke에게 알림.
추측으로 진행 X. 막힘 = 의논 대상.
