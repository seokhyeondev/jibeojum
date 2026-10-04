import { z } from "zod";
import { assetUrlSchema, licenseKeySchema } from "./upload";

// 중개사 계정: 아이디, 이름, 사진, 전화번호, 사무소 주소 (+ 비밀번호)

export const agentLoginIdSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{4,20}$/, "아이디는 영문 소문자·숫자·_ 4~20자예요");

export const agentPasswordSchema = z.string().min(8, "비밀번호는 8자 이상이에요").max(64, "비밀번호는 64자까지예요");

export const agentPhoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[^\d]/g, ""))
  .refine((v) => /^0\d{8,10}$/.test(v), "전화번호를 확인해주세요");

/** 업로드한 프로필 사진 (CloudFront 주소) */
export const agentPhotoSchema = assetUrlSchema.nullable().default(null);

/** 중개사무소 등록번호 (예: 11680-2019-00123) */
export const registrationNoSchema = z
  .string({ required_error: "중개사무소 등록번호를 입력해주세요" })
  .trim()
  .min(5, "중개사무소 등록번호를 확인해주세요")
  .max(30, "중개사무소 등록번호를 확인해주세요")
  .regex(/^[0-9가-힣-]+$/, "등록번호는 숫자와 -로 입력해주세요");

export const agentSignupSchema = z.object({
  loginId: agentLoginIdSchema,
  password: agentPasswordSchema,
  name: z.string().trim().min(2, "이름을 2자 이상 써주세요").max(20, "이름은 20자까지 쓸 수 있어요"),
  phone: agentPhoneSchema,
  /** 사무소 주소 */
  address: z.string().trim().min(5, "사무소 주소를 입력해주세요").max(120),
  photoUrl: agentPhotoSchema,
  registrationNo: registrationNoSchema,
  /** 중개사무소 등록증(또는 사업자등록증) 사진. 운영자가 확인한 뒤 매물을 올릴 수 있다 */
  licenseImageKey: licenseKeySchema,
});

/** 반려된 뒤 등록증을 다시 낼 때 */
export const agentLicenseSchema = z.object({ registrationNo: registrationNoSchema, licenseImageKey: licenseKeySchema });
export type AgentLicenseInput = z.infer<typeof agentLicenseSchema>;

/** 운영자가 만들 때는 비밀번호를 비우면 임시 비밀번호를 만든다 */
export const adminCreateAgentSchema = agentSignupSchema.extend({
  password: agentPasswordSchema.nullable().default(null),
  // 운영자가 직접 만드는 계정은 운영자가 확인한 것으로 보고 등록증을 선택으로 받는다
  registrationNo: registrationNoSchema.nullable().default(null),
  licenseImageKey: licenseKeySchema.nullable().default(null),
});

export const agentLoginSchema = z.object({
  loginId: agentLoginIdSchema,
  password: z.string().min(1, "비밀번호를 입력해주세요").max(64),
});

export type AgentSignupInput = z.infer<typeof agentSignupSchema>;
export type AdminCreateAgentInput = z.infer<typeof adminCreateAgentSchema>;
