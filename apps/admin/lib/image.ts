/**
 * 올리기 전에 브라우저에서 사진을 JPEG로 줄인다.
 * - square: 가운데를 정사각형으로 잘라 size×size (프로필)
 * - 아니면 긴 변을 size 이하로 (매물 사진)
 */
export async function resizeImage(file: File, { size, square = false, quality = 0.85 }: { size: number; square?: boolean; quality?: number }): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("이미지 파일을 골라주세요");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("이 사진은 열 수 없어요. JPG나 PNG로 올려주세요");
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const scale = square ? size / side : Math.min(1, size / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = square ? size : Math.round(bitmap.width * scale);
  canvas.height = square ? size : Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리할 수 없어요");
  if (square) ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  else ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("이미지를 처리할 수 없어요"))), "image/jpeg", quality));
}
