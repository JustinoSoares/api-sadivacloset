import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../../common/dto/pagination.dto';

const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class FilterMembrosDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Pesquisa por nome ou email', example: 'joao' })
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

  @ApiPropertyOptional({ description: 'Filtro específico por nome' })
  @IsOptional()
  @Trim()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ description: 'Filtro específico por email' })
  @IsOptional()
  @Trim()
  @IsString()
  email?: string;

  get searchNormalized(): string | undefined {
    const v = this.q ?? this.search ?? this.pesquisa ?? this.nome ?? this.email;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get nomeNormalized(): string | undefined {
    const v = this.nome ?? this.q ?? this.search ?? this.pesquisa;
    return v && v.trim().length ? v.trim() : undefined;
  }

  get emailNormalized(): string | undefined {
    const v = this.email ?? this.q ?? this.search ?? this.pesquisa;
    return v && v.trim().length ? v.trim() : undefined;
  }
}
