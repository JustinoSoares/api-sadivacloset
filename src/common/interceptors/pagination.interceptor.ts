import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { PaginationDto, buildPaginatedResponse } from '../dto/pagination.dto';

/**
 * Optional pagination interceptor.
 * If handler returns { data: T[], total: number } and has query page/limit,
 * automatically transforms to { data, page, total, totalPages }.
 *
 * Usage:
 *   @UseInterceptors(PaginationInterceptor)
 *   @Get() findAll(@Query() q: PaginationDto) { return { data, total } }
 */
@Injectable()
export class PaginationInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      query: Record<string, unknown>;
    }>();
    const query = request.query ?? {};
    const dto = new PaginationDto();
    dto.page = query.page ? Number(query.page) : 1;
    dto.limit = query.limit ? Number(query.limit) : 20;

    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'data' in (data as Record<string, unknown>) &&
          'total' in (data as Record<string, unknown>)
        ) {
          const raw = data as { data: T[]; total: number };
          return buildPaginatedResponse(raw.data, raw.total, dto);
        }
        return data;
      }),
    );
  }
}
