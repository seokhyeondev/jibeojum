/** 집어줌 로고 기호 (흰 Z + 민트 점). 초록 바탕 위에 쓴다 */
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="12 14 76 72" aria-hidden>
      <path d="M24 26 L76 26 L24 74 L76 74" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="76" cy="26" r="9.5" fill="#fff" />
      <circle cx="76" cy="26" r="5.5" fill="#2EE6A6" />
      <circle cx="24" cy="74" r="9.5" fill="#fff" />
      <circle cx="24" cy="74" r="5.5" fill="#2EE6A6" />
    </svg>
  );
}
