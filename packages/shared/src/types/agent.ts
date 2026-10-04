export interface Agent {
  id: string;
  name: string;
  /** 사무소가 없으면 빈 문자열 */
  officeName: string;
  /** 중개사무소 등록번호 (승인된 공인중개사만) */
  registrationNo?: string | null;
  photoUrl?: string | null;
}
