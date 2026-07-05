// 공용 이미지 업로드 유틸 — ProductRegisterForm 의 업로더 관례를 단일 출처로 추출(STUDIO-fix2 G5).
//   File → 가로 최대 1200px 비율유지 → image/jpeg 0.8 Blob. 캔버스 압축은 브라우저 전용.
//   소비처: ProductRegisterForm(상품 사진) · studio-build(대표 이미지). 동작 무변경 이동.

export const PRODUCT_IMAGE_MAX_WIDTH = 1200;

export async function resizeToJpegBlob(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 읽지 못했어요."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
    el.src = dataUrl;
  });

  const scale = img.width > PRODUCT_IMAGE_MAX_WIDTH ? PRODUCT_IMAGE_MAX_WIDTH / img.width : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지 처리에 실패했어요.");
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );
  if (!blob) throw new Error("이미지 압축에 실패했어요.");
  return blob;
}
