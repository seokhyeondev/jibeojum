import type { ListingImage } from "@zipazum/shared";

const PLACEHOLDER: ListingImage = { src: "/listing-placeholder.svg", alt: "사진 준비 중" };

/** 사진이 없는 매물(공인중개사가 사진 없이 올린 경우)은 자리 그림을 쓴다 */
export function listingImages(images: ListingImage[]): ListingImage[] {
  return images.length ? images : [PLACEHOLDER];
}

/** 공인중개사가 넣은 외부 주소는 Next 이미지 최적화를 거치지 않는다 */
export const isExternal = (src: string) => /^https?:\/\//.test(src);
