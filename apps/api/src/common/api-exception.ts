import { HttpException } from "@nestjs/common";

export type ApiErrorCode = "invalid_input" | "not_found" | "conflict" | "unauthorized" | "forbidden" | "server_error";

/** 프런트가 기대하는 { error: { code, message } } 형태의 오류 */
export class ApiException extends HttpException {
  constructor(status: number, code: ApiErrorCode, message: string) {
    super({ error: { code, message } }, status);
  }
}

export const notFound = () => new ApiException(404, "not_found", "요청한 정보를 찾을 수 없어요.");
