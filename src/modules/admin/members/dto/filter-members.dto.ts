import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class FilterMembersDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by name or email', example: 'joao' })
  @IsOptional()
  @Trim()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Alias search' })
  @IsOptional()
  @Trim()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Alias pesquisa' })
  @IsOptional()
  @Trim()
  @IsString()
  pesquisa?: string;

  @ApiPropertyOptional({ description: 'Specific filter by name' })
  @IsOptional()
  @Trim()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Alias nome' })
  @IsOptional()
  @Trim()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ description: 'Specific filter by email' })
  @IsOptional()
  @Trim()
  @IsString()
  email?: string;

  get searchNormalized(): string | undefined {
    const v = this.q ?? this.search ?? this.pesquisa ?? this.name ?? this.nome ?? this.email;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get nameNormalized(): string | undefined {
    const v = this.name ?? this.nome ?? this.q ?? this.search ?? this.pesquisa;
    return v && v.trim().length ? v.trim() : undefined;
  }

  // legacy alias
  get nomeNormalized(): string | undefined {
    return this.nameNormalized;
  }

  get emailNormalized(): string | undefined {
    const v = this.email ?? this.q ?? this.search ?? this.pesquisa;
    return v && v.trim().length ? v.trim() : undefined;
  }
}

// legacy alias
export const FilterMembrosDto = FilterMembersDto;
export type FilterMembrosDtoType = FilterMembersDto;
