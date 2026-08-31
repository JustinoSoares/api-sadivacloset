import { PaginationDto, buildPaginatedResponse, buildPaginatedResult } from './pagination.dto';

describe('PaginationDto', () => {
  it('deve calcular skip e take corretamente', () => {
    const dto = new PaginationDto();
    dto.page = 2;
    dto.limit = 10;
    expect(dto.skip).toBe(10);
    expect(dto.take).toBe(10);
  });

  it('deve usar defaults (page 1, limit 20) quando não informado', () => {
    const dto = new PaginationDto();
    expect(dto.skip).toBe(0);
    expect(dto.take).toBe(20);
  });
});

describe('buildPaginatedResponse', () => {
  it('deve retornar {data, page, total, totalPages} (English-only)', () => {
    const dto = new PaginationDto();
    dto.page = 2;
    dto.limit = 10;
    const result = buildPaginatedResponse([{ id: 1 }, { id: 2 }] as any, 25, dto);
    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      page: 2,
      total: 25,
      totalPages: 3,
    });
  });

  it('deve calcular totalPages com teto', () => {
    const dto = new PaginationDto();
    dto.page = 1;
    dto.limit = 2;
    const result = buildPaginatedResponse([], 5, dto);
    expect(result.totalPages).toBe(3);
  });
});

describe('buildPaginatedResult (legado)', () => {
  it('deve retornar {data, meta}', () => {
    const dto = new PaginationDto();
    dto.page = 1;
    dto.limit = 2;
    const result = buildPaginatedResult([{ id: 1 }] as any, 10, dto);
    expect(result).toEqual({
      data: [{ id: 1 }],
      meta: { page: 1, limit: 2, total: 10, totalPages: 5 },
    });
  });
});
