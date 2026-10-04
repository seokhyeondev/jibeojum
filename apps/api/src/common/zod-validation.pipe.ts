import { PipeTransform } from "@nestjs/common";
import type { ZodType, ZodTypeDef } from "zod";
import { ApiException } from "./api-exception.js";

/**
 * 웹과 같은 zod 스키마(@zipazum/shared)로 요청 본문을 검증한다.
 * 입력값 자체는 응답·로그에 남기지 않는다. 스키마에 한국어 메시지가 있으면 그걸, 없으면 틀린 필드 이름을 알려준다.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (parsed.success) return parsed.data;
    const korean = parsed.error.issues.find((issue) => /[가-힣]/.test(issue.message));
    if (korean) throw new ApiException(400, "invalid_input", korean.message);
    const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".") || "body"))];
    throw new ApiException(400, "invalid_input", `입력값을 확인해주세요: ${fields.join(", ")}`);
  }
}
