import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Response } from "express";

/**
 * 모든 오류를 { error: { code, message } } 형태로 맞춘다.
 * 예상하지 못한 오류는 추적용 ID만 남기고 개인정보는 로그에 쓰지 않는다.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ApiException");

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "object") {
        response.status(status).json(body);
        return;
      }
      const code = status === 404 ? "not_found" : status < 500 ? "invalid_input" : "server_error";
      response.status(status).json({ error: { code, message: exception.message } });
      return;
    }

    const traceId = randomUUID();
    const message = exception instanceof Error ? exception.message : String(exception);
    this.logger.error(`trace=${traceId} ${message}`);
    response
      .status(500)
      .json({ error: { code: "server_error", message: "잠시 후 다시 시도해주세요.", traceId } });
  }
}
