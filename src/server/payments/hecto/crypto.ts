// 헥토파이낸셜(구 세틀뱅크) 표준결제창 v1 — 암호화/해시 유틸 (서버 전용).
//   - 금액 등 민감필드: AES-256-ECB + PKCS7 → Base64 (헥토 규격).
//     WebCrypto(SubtleCrypto)는 AES-ECB 를 지원하지 않으므로 순수 JS 구현(aes-js) 사용.
//   - 무결성 해시: SHA-256 hex (WebCrypto SubtleCrypto).
// 이 파일은 api/hecto/* 서버 핸들러와 scripts/hecto-verify.ts 에서만 import(클라 번들 유입 없음).
import aesjs from "aes-js";

/** Uint8Array → Base64 (Workers/Node/Bun 공통 btoa 사용). */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * AES-256-ECB + PKCS7 패딩 → Base64.
 * key 는 UTF-8 32바이트(헥토 암호화 키 = 32자)면 AES-256. 16/24바이트면 128/192.
 */
export function aesEcbEncryptBase64(plain: string, key: string): string {
  const keyBytes = aesjs.utils.utf8.toBytes(key);
  const textBytes = aesjs.utils.utf8.toBytes(plain);
  const padded = aesjs.padding.pkcs7.pad(textBytes);
  const ecb = new aesjs.ModeOfOperation.ecb(keyBytes);
  const encrypted = ecb.encrypt(padded);
  return bytesToBase64(encrypted);
}

/** SHA-256 → 소문자 hex. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}
