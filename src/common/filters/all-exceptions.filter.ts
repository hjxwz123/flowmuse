import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type ApiErrorResponse = {
  code: number;
  msg: string;
  data: unknown | null;
};

const GENERIC_CLIENT_ERROR = '请求处理失败，请检查后重试';
const GENERIC_SERVER_ERROR = '服务器内部错误，请稍后重试';

function normalizeMessage(payload: unknown, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (typeof payload !== 'object') return fallback;

  const obj = payload as Record<string, unknown>;
  const msg = obj.message;
  if (typeof msg === 'string') return msg;
  if (Array.isArray(msg)) return msg.filter((x) => typeof x === 'string').join(', ') || fallback;
  return fallback;
}

function normalizeData(payload: unknown): unknown | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const obj = payload as Record<string, unknown>;
  if ('data' in obj) {
    return obj.data ?? null;
  }

  const extraEntries = Object.entries(obj).filter(
    ([key]) => key !== 'message' && key !== 'statusCode' && key !== 'error',
  );

  return extraEntries.length > 0 ? Object.fromEntries(extraEntries) : null;
}

function stringifyForInspection(value: unknown) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function containsSensitiveSystemDetails(value: unknown) {
  const text = stringifyForInspection(value);
  if (!text) return false;

  return [
    /Invalid `prisma\.[^`]+` invocation/i,
    /PrismaClient/i,
    /Foreign key constraint violated/i,
    /Unique constraint failed/i,
    /Raw query failed/i,
    /\bP10\d{2}\b/i,
    /\bP20\d{2}\b/i,
    /\b(mysql|postgres|postgresql|sqlite|mongodb|database|sql)\b/i,
    /\b(node_modules|dist\/|src\/).+:\d+:\d+/i,
    /\bat\s+.+\(.+:\d+:\d+\)/i,
  ].some((pattern) => pattern.test(text));
}

function isPrismaException(exception: unknown) {
  return exception instanceof Prisma.PrismaClientKnownRequestError ||
    exception instanceof Prisma.PrismaClientUnknownRequestError ||
    exception instanceof Prisma.PrismaClientRustPanicError ||
    exception instanceof Prisma.PrismaClientInitializationError ||
    exception instanceof Prisma.PrismaClientValidationError;
}

function normalizePrismaError(exception: unknown) {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    if (exception.code === 'P2002') {
      return { status: HttpStatus.BAD_REQUEST, msg: '数据已存在，请检查后重试' };
    }

    if (exception.code === 'P2003') {
      return { status: HttpStatus.BAD_REQUEST, msg: '当前数据存在关联约束，无法完成操作' };
    }

    if (exception.code === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, msg: '请求的数据不存在' };
    }

    return { status: HttpStatus.BAD_REQUEST, msg: GENERIC_CLIENT_ERROR };
  }

  if (exception instanceof Prisma.PrismaClientValidationError) {
    return { status: HttpStatus.BAD_REQUEST, msg: '请求参数格式不正确' };
  }

  return { status: HttpStatus.INTERNAL_SERVER_ERROR, msg: GENERIC_SERVER_ERROR };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let msg = GENERIC_SERVER_ERROR;
    let data: unknown | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      msg = normalizeMessage(response, exception.message);
      data = normalizeData(response);
      if (containsSensitiveSystemDetails(msg) || containsSensitiveSystemDetails(data)) {
        msg = status >= HttpStatus.INTERNAL_SERVER_ERROR ? GENERIC_SERVER_ERROR : GENERIC_CLIENT_ERROR;
        data = null;
      }
    } else if (isPrismaException(exception)) {
      const normalized = normalizePrismaError(exception);
      status = normalized.status;
      msg = normalized.msg;
      this.logger.error(
        exception instanceof Error ? exception.message : 'Prisma error',
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (exception && typeof exception === 'object' && 'message' in exception) {
      this.logger.error(
        exception instanceof Error ? exception.message : 'Unhandled exception',
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ApiErrorResponse = {
      code: status,
      msg,
      data,
    };

    // Always return HTTP 200; frontends use `code` + `msg`.
    if (res?.status) res.status(200);
    return res.json(body);
  }
}
