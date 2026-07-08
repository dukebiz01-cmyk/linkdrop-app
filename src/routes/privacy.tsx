import { createFileRoute } from "@tanstack/react-router";

// 개인정보처리방침 — 공개(비로그인) 라우트. 카카오 비즈 심사 + 「개인정보 보호법」 제30조 충족용.
//   app.drop.how/privacy 로 로그인 없이 도달(BusinessFooter 링크). _user/_partner/_admin 아래 두지 말 것.
//   terms.tsx / business-info.tsx 와 동일한 공개 라우트 구조 미러링.

type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] };
type Section = { n: number; title: string; blocks: Block[] };

const INTRO =
  `피티아이티주식회사(이하 "회사")는 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 관련 고충을 신속하게 처리하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다. 본 방침은 회사가 운영하는 LinkDrop 서비스(app.drop.how, drop.how, 이하 "서비스")에 적용됩니다.`;

const EFFECTIVE_DATE = "시행일: 2026년 6월 18일";

const SECTIONS: Section[] = [
  {
    n: 1,
    title: "처리하는 개인정보 항목",
    blocks: [
      {
        kind: "ul",
        items: [
          "회원가입 및 로그인(카카오 소셜 로그인): 카카오 계정 식별자, 닉네임, 프로필 이미지, 이메일 주소(이용자가 제공에 동의한 경우)",
          "예약 신청: 예약자 이름, 연락처(휴대전화번호), 예약 일정·인원 등 예약 내용",
          "쿠폰 발급 및 사용: 쿠폰 발급·사용 내역, 사용 매장 정보",
          "마케팅 정보 수신: 광고성 정보 수신 동의 여부 및 동의 일시",
          "자동 수집 정보: 서비스 이용 기록, 접속 로그, 접속 IP 주소, 쿠키, 기기·브라우저 정보",
        ],
      },
    ],
  },
  {
    n: 2,
    title: "개인정보의 수집 및 이용 목적",
    blocks: [
      {
        kind: "ul",
        items: [
          "회원 식별 및 관리, 서비스 제공 및 운영",
          "예약·쿠폰 등 서비스 제공 및 본인 확인",
          "콘텐츠 공유·전환 성과 측정 및 보상 정산",
          "광고성 정보 전송(수신에 동의한 이용자에 한함)",
          "서비스 개선, 부정 이용 방지, 고객 문의 응대",
        ],
      },
    ],
  },
  {
    n: 3,
    title: "개인정보의 보유 및 이용 기간",
    blocks: [
      {
        kind: "p",
        text: "회사는 원칙적으로 회원 탈퇴 또는 수집·이용 목적 달성 시 지체 없이 개인정보를 파기합니다. 다만 관계 법령에 따라 다음과 같이 보존합니다.",
      },
      {
        kind: "ul",
        items: [
          "계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래 등에서의 소비자보호에 관한 법률)",
          "대금결제 및 재화 등의 공급에 관한 기록: 5년 (동법)",
          "소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (동법)",
          "표시·광고에 관한 기록: 6개월 (동법)",
          "서비스 접속 기록(로그): 3개월 (통신비밀보호법)",
        ],
      },
    ],
  },
  {
    n: 4,
    title: "개인정보의 제3자 제공",
    blocks: [
      {
        kind: "p",
        text: "회사는 이용자의 개인정보를 제1조의 범위 내에서 처리하며, 다음의 경우에 한해 제3자에게 제공합니다.",
      },
      {
        kind: "ul",
        items: [
          "예약 서비스: 이용자가 예약을 신청한 경우, 예약 확인 및 이행을 위해 예약 시 입력한 정보(이름, 연락처)를 해당 예약 매장(파트너)에 제공합니다.",
          // 표준 초안 — 법무 검수 후 확정
          "결제 처리 및 정기결제를 위하여 결제대행사인 주식회사 헥토파이낸셜에 결제·거래에 필요한 정보(결제수단 정보 등)가 제공되며, 해당 정보는 결제 처리 목적으로만 이용·보관됩니다.",
        ],
      },
      {
        kind: "p",
        text: "그 외에는 정보주체의 동의 또는 법률의 특별한 규정이 있는 경우를 제외하고 개인정보를 제3자에게 제공하지 않습니다. 전환 성과 정산을 위해 제휴 매장·브랜드에 제공되는 정보는 개인을 식별할 수 없는 집계·통계 형태입니다.",
      },
    ],
  },
  {
    n: 5,
    title: "개인정보 처리의 위탁",
    blocks: [
      {
        kind: "p",
        text: "회사는 원활한 서비스 제공을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.",
      },
      {
        kind: "ul",
        items: [
          "Supabase Inc. (Amazon Web Services 서울 리전): 데이터 저장 및 시스템 운영",
          "주식회사 카카오: 소셜 로그인(카카오 계정) 인증",
          "Cloudflare, Inc.: 콘텐츠 전송(CDN) 및 호스팅",
          "토스페이먼츠 주식회사: 결제 처리(결제 서비스 운영 시)",
          // 표준 초안 — 법무 검수 후 확정
          "주식회사 헥토파이낸셜: 결제 처리 및 정기결제(결제수단 정보 등 결제·거래에 필요한 정보)",
        ],
      },
    ],
  },
  {
    n: 6,
    title: "정보주체의 권리·의무 및 행사 방법",
    blocks: [
      {
        kind: "p",
        text: "정보주체는 언제든지 개인정보 열람·정정·삭제·처리정지를 요구할 수 있으며, 마케팅 정보 수신 동의를 철회할 수 있습니다.",
      },
      {
        kind: "ul",
        items: [
          "마케팅 수신 철회: 서비스 내 마이페이지 > 구독한 메이커에서 언제든 무료로 가능",
          "기타 권리 행사: 아래 개인정보 보호책임자에게 서면 또는 이메일로 요청",
        ],
      },
    ],
  },
  {
    n: 7,
    title: "개인정보의 파기",
    blocks: [
      {
        kind: "p",
        text: "보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 파기합니다. 전자적 파일 형태의 정보는 복구가 불가능한 방법으로 영구 삭제하며, 출력물은 분쇄하거나 소각합니다.",
      },
    ],
  },
  {
    n: 8,
    title: "개인정보의 안전성 확보 조치",
    blocks: [
      {
        kind: "ul",
        items: [
          "전송 구간 암호화(HTTPS), 저장 데이터 접근 통제 및 권한 관리",
          "개인정보 접근 권한의 최소화, 접속 기록의 보관·점검",
          "해킹·악성코드 방지를 위한 보안 조치",
        ],
      },
    ],
  },
  {
    n: 9,
    title: "쿠키 등 자동 수집 장치의 운영",
    blocks: [
      {
        kind: "p",
        text: "회사는 로그인 세션 유지 및 서비스 이용 편의를 위해 쿠키를 사용합니다. 이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 로그인 등 일부 서비스 이용이 제한될 수 있습니다.",
      },
    ],
  },
  {
    n: 10,
    title: "만 14세 미만 아동의 개인정보",
    blocks: [
      {
        kind: "p",
        text: "회사는 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 만 14세 미만 아동이 서비스를 이용하고자 하는 경우 법정대리인의 동의가 필요합니다.",
      },
    ],
  },
  {
    n: 11,
    title: "개인정보 보호책임자",
    blocks: [
      {
        kind: "ul",
        items: ["책임자: 이현민 (대표)", "이메일: dukebiz01@gmail.com", "연락처: 010-3981-1138"],
      },
      {
        kind: "p",
        text: "정보주체는 서비스 이용 중 발생한 개인정보 보호 관련 문의·불만·피해 구제를 위 책임자에게 문의할 수 있으며, 회사는 지체 없이 답변·처리합니다.",
      },
    ],
  },
  {
    n: 12,
    title: "권익침해 구제 방법",
    blocks: [
      {
        kind: "p",
        text: "개인정보 침해로 인한 구제가 필요하신 경우 아래 기관에 문의하실 수 있습니다.",
      },
      {
        kind: "ul",
        items: [
          "개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)",
          "개인정보침해신고센터: 118 (privacy.kisa.or.kr)",
          "대검찰청 사이버수사과: 1301 (www.spo.go.kr)",
          "경찰청 사이버수사국: 182 (cyberbureau.police.go.kr)",
        ],
      },
    ],
  },
  {
    n: 13,
    title: "개인정보처리방침의 변경",
    blocks: [
      {
        kind: "p",
        text: "본 방침은 시행일로부터 적용되며, 법령·정책 또는 보안기술의 변경에 따라 내용이 추가·삭제·수정될 경우 변경 사항을 시행 7일 전부터 서비스 내 공지합니다.",
      },
    ],
  },
];

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "개인정보처리방침 — LinkDrop" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-bg px-6 py-10 tracking-ko">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-text-strong">개인정보처리방침</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-text-muted">{INTRO}</p>
        <p className="mt-2 text-xs font-medium text-text-subtle">{EFFECTIVE_DATE}</p>
      </header>

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.n}>
            <h2 className="text-base font-bold text-text-strong">
              {section.n}. {section.title}
            </h2>
            <div className="mt-2 space-y-2">
              {section.blocks.map((block, i) =>
                block.kind === "p" ? (
                  <p
                    key={i}
                    className="text-sm font-medium leading-relaxed text-text-muted"
                  >
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
