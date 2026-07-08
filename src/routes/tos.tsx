import { createFileRoute } from "@tanstack/react-router";

// 서비스 이용약관 — 공개(비로그인) 라우트. 카카오 비즈 심사용 정식 약관 문서.
//   app.drop.how/tos 로 로그인 없이 도달(BusinessFooter "이용약관" 링크). _user/_partner/_admin 아래 두지 말 것.
//   privacy.tsx 와 동일한 공개 정적 법무 문서 구조 미러링.
//   (가입 동의 화면 /terms[SignupTerms]와 별개 — 이쪽이 실제 약관 본문.)

type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] };
type Article = { title: string; blocks: Block[] };

const ARTICLES: Article[] = [
  {
    title: "제1조 (목적)",
    blocks: [
      {
        kind: "p",
        text: `이 약관은 피티아이티주식회사(이하 "회사")가 제공하는 LinkDrop 서비스(이하 "서비스")의 이용과 관련하여 회사와 회원 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.`,
      },
    ],
  },
  {
    title: "제2조 (정의)",
    blocks: [
      {
        kind: "p",
        text: `1. "서비스"란 회사가 제공하는, 링크된 콘텐츠의 정보를 카드 형태로 정리·공유하고 쿠폰·예약 등 행동으로 연결하는 플랫폼 및 관련 제반 서비스를 말합니다.`,
      },
      { kind: "p", text: `2. "회원"이란 이 약관에 동의하고 회사와 이용계약을 체결한 자를 말합니다.` },
      {
        kind: "p",
        text: `3. "메이커"란 서비스 내에서 매장·브랜드 정보를 등록하고 쿠폰·예약 등을 제공하는 회원을 말합니다.`,
      },
      {
        kind: "p",
        text: `4. "콘텐츠"란 회원이 서비스를 통해 생성·공유하는 정보 카드(이하 "드롭"), 텍스트, 링크, 이미지 등을 말합니다.`,
      },
      { kind: "p", text: `5. "쿠폰"이란 메이커가 제공하고 회원이 발급·사용할 수 있는 혜택을 말합니다.` },
      { kind: "p", text: `이 약관에서 정하지 않은 용어는 관계 법령 및 일반 관례에 따릅니다.` },
    ],
  },
  {
    title: "제3조 (약관의 게시와 개정)",
    blocks: [
      { kind: "p", text: `1. 회사는 이 약관을 회원이 쉽게 확인할 수 있도록 서비스 화면에 게시합니다.` },
      {
        kind: "p",
        text: `2. 회사는 관계 법령을 위반하지 않는 범위에서 이 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정사유를 명시하여 적용일 7일 전(회원에게 불리하거나 중대한 변경은 30일 전)부터 공지합니다.`,
      },
      { kind: "p", text: `3. 회원이 개정약관에 동의하지 않는 경우 이용계약을 해지할 수 있습니다.` },
    ],
  },
  {
    title: "제4조 (서비스의 제공 및 변경)",
    blocks: [
      { kind: "p", text: `1. 회사는 다음의 서비스를 제공합니다.` },
      {
        kind: "ul",
        items: [
          "링크된 콘텐츠 정보의 카드화 및 공유",
          "쿠폰 발급·사용 및 예약 신청 중개",
          "콘텐츠 공유에 따른 전환 성과 측정 및 보상",
          "기타 회사가 정하는 서비스",
        ],
      },
      { kind: "p", text: `2. 회사는 서비스의 내용을 변경할 수 있으며, 변경 시 그 내용을 사전에 공지합니다.` },
      {
        kind: "p",
        text: `3. 서비스는 연중무휴 제공을 원칙으로 하나, 시스템 점검·장애 등의 사유로 일시 중단될 수 있습니다.`,
      },
    ],
  },
  {
    title: "제5조 (이용계약의 성립)",
    blocks: [
      {
        kind: "p",
        text: `1. 이용계약은 이용자가 이 약관에 동의하고 회사가 정한 절차(카카오 계정을 통한 가입 등)에 따라 가입을 신청하며, 회사가 이를 승낙함으로써 성립합니다.`,
      },
      { kind: "p", text: `2. 회사는 다음의 경우 승낙을 거부하거나 사후에 이용계약을 해지할 수 있습니다.` },
      {
        kind: "ul",
        items: [
          "타인의 정보를 도용하거나 허위 정보를 기재한 경우",
          "관계 법령 또는 이 약관을 위반한 경우",
        ],
      },
    ],
  },
  {
    title: "제6조 (회원의 의무 및 금지행위)",
    blocks: [
      { kind: "p", text: `회원은 다음의 행위를 하여서는 안 됩니다.` },
      {
        kind: "ul",
        items: [
          "타인의 정보 도용, 허위 정보 등록",
          "회사 및 제3자의 지식재산권·초상권 등 권리 침해",
          "서비스를 부정한 목적(쿠폰·예약·보상의 부정 취득 등)으로 이용하는 행위",
          "허위·과장·비방 콘텐츠의 등록",
          "법령 또는 공서양속에 반하는 행위",
        ],
      },
    ],
  },
  {
    title: "제7조 (콘텐츠 및 지식재산권)",
    blocks: [
      {
        kind: "p",
        text: `1. 회원이 링크하는 원본 영상·게시물은 해당 외부 플랫폼(YouTube, Instagram 등)에 그대로 존재하며, 서비스는 원본 링크·공식 임베드·출처 및 회원이 정리한 정보 카드만을 표시합니다. 회사는 원본 콘텐츠를 무단으로 복제·다운로드·편집하지 않습니다.`,
      },
      {
        kind: "p",
        text: `2. 회원이 작성한 콘텐츠에 대한 권리는 회원에게 있으며, 회원은 서비스 운영·노출에 필요한 범위에서 회사가 이를 이용할 수 있도록 허락합니다.`,
      },
      {
        kind: "p",
        text: `3. 서비스 자체 및 회사가 제작한 화면·로고·디자인 등에 대한 권리는 회사에 귀속됩니다.`,
      },
    ],
  },
  {
    title: "제8조 (서비스 이용 제한 및 계약 해지)",
    blocks: [
      {
        kind: "p",
        text: `1. 회원은 언제든지 서비스 내 절차를 통해 이용계약을 해지(회원 탈퇴)할 수 있습니다.`,
      },
      {
        kind: "p",
        text: `2. 회사는 회원이 이 약관 또는 관계 법령을 위반한 경우 사전 통지 후(긴급한 경우 사후 통지) 서비스 이용을 제한하거나 이용계약을 해지할 수 있습니다.`,
      },
    ],
  },
  {
    title: "제9조 (쿠폰·예약 등 중개 서비스와 책임)",
    blocks: [
      {
        kind: "p",
        text: `1. 회사는 회원과 메이커(매장·브랜드) 간의 쿠폰·예약 등을 매개하는 플랫폼을 제공하며, 쿠폰의 실제 제공 및 예약의 이행은 해당 메이커의 책임으로 이루어집니다.`,
      },
      {
        kind: "p",
        text: `2. 회사는 메이커가 제공하는 정보·혜택의 진실성, 예약의 이행 등에 대하여 보증하지 않으며, 회원과 메이커 간 분쟁에 대해 책임을 지지 않습니다. 다만 회사는 분쟁 해결을 위해 합리적인 노력을 다합니다.`,
      },
    ],
  },
  {
    title: "제10조 (회사의 책임과 면책)",
    blocks: [
      {
        kind: "p",
        text: `1. 회사는 관계 법령에 따라 회원의 개인정보를 보호하며, 개인정보의 처리에 관한 사항은 별도의 개인정보처리방침에 따릅니다.`,
      },
      {
        kind: "p",
        text: `2. 회사는 천재지변, 불가항력, 회원의 귀책사유로 인한 서비스 장애 등에 대하여 책임을 지지 않습니다.`,
      },
      {
        kind: "p",
        text: `3. 회사는 회원이 서비스를 통해 게시·공유한 콘텐츠의 내용에 대하여 책임을 지지 않습니다.`,
      },
    ],
  },
  {
    title: "제11조 (손해배상)",
    blocks: [
      {
        kind: "p",
        text: `회사 또는 회원은 상대방의 귀책사유로 손해가 발생한 경우 관계 법령이 정하는 바에 따라 그 손해를 배상할 책임이 있습니다.`,
      },
    ],
  },
  {
    title: "제12조 (준거법 및 분쟁 해결)",
    blocks: [
      { kind: "p", text: `1. 이 약관 및 서비스 이용과 관련한 분쟁에는 대한민국 법령을 적용합니다.` },
      {
        kind: "p",
        text: `2. 서비스 이용으로 발생한 분쟁에 대해 소송이 필요한 경우 민사소송법상의 관할법원에 제소합니다.`,
      },
      { kind: "p", text: `3. 회사와 회원은 분쟁 해결을 위해 성실히 협의합니다.` },
    ],
  },
  {
    title: "제13조 (문의처)",
    blocks: [
      {
        kind: "ul",
        items: [
          "상호: 피티아이티주식회사 (대표 이현민)",
          "사업자등록번호: 125-86-19781",
          "주소: 경기도 평택시 용죽2로 30, 상가동 지하1층 B04호",
          "문의: 010-3981-1138 · dukebiz01@gmail.com",
        ],
      },
    ],
  },
  // 표준 초안 — 법무(변호사) 검수 후 확정
  {
    title: "제14조 (캐시(cash))",
    blocks: [
      {
        kind: "p",
        text: `회사가 제공하는 캐시(cash)는 링크드롭 콘텐츠 및 서비스 이용료 결제에만 사용되며, 현금으로 환급되지 않습니다. 캐시는 결제 취소 시에 한하여 미사용 잔액 범위 내에서 차감·취소되며, 반복적인 충전 취소 등 부정 이용 시 서비스 이용이 제한될 수 있습니다. 무상 지급된 캐시는 유효기간이 있을 수 있으며 기간 경과 시 소멸됩니다.`,
      },
    ],
  },
  // 표준 초안 — 법무(변호사) 검수 후 확정
  {
    title: "제15조 (정기결제 구독)",
    blocks: [
      {
        kind: "p",
        text: `비즈니스 구독은 매월 자동으로 결제되는 정기결제 상품입니다. 이용자가 등록한 결제수단으로 매월 결제일에 해당 요금이 자동 청구되며, 이용자는 언제든지 해지할 수 있습니다. 해지 시 다음 결제일부터 청구가 중단되며, 이미 결제된 당월 이용료는 환불되지 않습니다.`,
      },
    ],
  },
  {
    title: "부칙",
    blocks: [{ kind: "p", text: `이 약관은 2026년 6월 18일부터 시행합니다.` }],
  },
];

export const Route = createFileRoute("/tos")({
  head: () => ({ meta: [{ title: "서비스 이용약관 — LinkDrop" }] }),
  component: TosPage,
});

function TosPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg px-6 py-10 tracking-ko">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-text-strong">서비스 이용약관</h1>
      </header>

      <div className="space-y-8">
        {ARTICLES.map((article) => (
          <section key={article.title}>
            <h2 className="text-base font-bold text-text-strong">{article.title}</h2>
            <div className="mt-2 space-y-2">
              {article.blocks.map((block, i) =>
                block.kind === "p" ? (
                  <p key={i} className="text-sm font-medium leading-relaxed text-text-muted">
                    {block.text}
                  </p>
                ) : (
                  <ul key={i} className="space-y-2">
                    {block.items.map((item, j) => (
                      <li
                        key={j}
                        className="flex gap-2 text-sm font-medium leading-relaxed text-text-muted"
                      >
                        <span aria-hidden className="select-none text-text-subtle">
                          ·
                        </span>
                        <span className="min-w-0 flex-1">{item}</span>
                      </li>
                    ))}
                  </ul>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-10">
        <a
          href="/"
          className="text-xs font-medium text-text-subtle underline-offset-2 transition-colors hover:text-text-muted hover:underline"
        >
          ← 홈으로
        </a>
      </div>
    </main>
  );
}
