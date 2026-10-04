import { z } from "zod";
import { assetUrlSchema } from "./upload";

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

export const agentSignupSchema = z.object({
  loginId: agentLoginIdSchema,
  password: agentPasswordSchema,
  name: z.string().trim().min(2, "이름을 2자 이상 써주세요").max(20, "이름은 20자까지 쓸 수 있어요"),
  phone: agentPhoneSchema,
  /** 사무소 주소 */
  address: z.string().trim().min(5, "사무소 주소를 입력해주세요").max(120),
  photoUrl: agentPhotoSchema,
});

/** 운영자가 만들 때는 비밀번호를 비우면 임시 비밀번호를 만든다 */
export const adminCreateAgentSchema = agentSignupSchema.extend({
  password: agentPasswordSchema.nullable().default(null),
});

export const agentLoginSchema = z.object({
  loginId: agentLoginIdSchema,
  password: z.string().min(1, "비밀번호를 입력해주세요").max(64),
});

export type AgentSignupInput = z.infer<typeof agentSignupSchema>;
export type AdminCreateAgentInput = z.infer<typeof adminCreateAgentSchema>;
