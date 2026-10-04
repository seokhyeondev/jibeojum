import { PipeTransform } from "@nestjs/common";
import { notFound } from "./api-exception.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 형식이 틀린 ID는 DB를 조회하지 않고 404로 돌려보낸다. */
export class UuidParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw notFound();
    return value;
  }
}
