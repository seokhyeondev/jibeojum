export interface Agent {
  id: string;
  name: string;
  /** 사무소가 없으면 빈 문자열 */
  officeName: string;
  photoUrl?: string | null;
}
