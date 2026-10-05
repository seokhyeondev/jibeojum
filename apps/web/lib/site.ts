/** 사이트 공통 정보. 연락처는 아직 임시 값이다 (정해지면 여기만 바꾼다) */
export const SITE = {
  name: "집어줌",
  contactEmail: "hello@zipazum.kr",
} as const;

/**
 * 푸터에 보이는 사업자 정보. 값이 있는 항목만 보인다.
 * 사업자 등록 후 상호·대표자·사업자등록번호·주소(필요하면 통신판매업 신고번호, 전화)를 채운다.
 */
export const COMPANY: { label: string; value: string | null }[] = [
  { label: "상호", value: null },
  { label: "대표", value: null },
  { label: "사업자등록번호", value: null },
  { label: "통신판매업 신고", value: null },
  { label: "주소", value: null },
  { label: "전화", value: null },
];
