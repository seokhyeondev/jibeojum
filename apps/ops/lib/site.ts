/** 사이트 공통 정보. 연락처는 아직 임시 값이다 (정해지면 여기만 바꾼다) */
export const SITE = {
  name: "집어줌",
  contactEmail: "hello@zipazum.com",
} as const;

/**
 * 푸터에 보이는 사업자 정보. 값이 있는 항목만 보인다.
 * 통신판매업 신고번호·전화가 생기면 채운다.
 */
export const COMPANY_NAME = "에이치코어";

export const COMPANY: { label: string; value: string | null }[] = [
  { label: "상호", value: COMPANY_NAME },
  { label: "대표", value: "김석현" },
  { label: "사업자등록번호", value: "765-86-03452" },
  { label: "통신판매업 신고", value: null },
  { label: "주소", value: "충청남도 천안시 서북구 2공단4로 40-11, 12층 9호" },
  { label: "전화", value: null },
  { label: "고객센터", value: "09:00~17:00 (주말·공휴일 휴무)" },
];

/** 사용자 웹 주소. 약관·개인정보처리방침·고객용 서비스 링크에 쓴다 */
export const WEB_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? "https://zipazum.com").replace(/\/$/, "");
