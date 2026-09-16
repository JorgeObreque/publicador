import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => BigIntSerializerInterceptor.serialize(value)));
  }

  static serialize(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.serialize(inner);
      }
      return result;
    }
    return value;
  }
}
