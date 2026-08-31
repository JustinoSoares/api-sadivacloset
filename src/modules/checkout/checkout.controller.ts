import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';

@ApiTags('checkout')
@ApiBearerAuth('bearer')
@Controller('checkout')
@Throttle({ checkout: { ttl: 60_000, limit: 10 } })
@SkipThrottle({ default: true, auth: true, esqueci: true })
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create order from cart (transaction: validate stock, decrement, create order+delivery, clear cart)',
    description:
      'Creates order from cart in a transaction, validates stock, creates delivery and clears cart',
  })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  @ApiResponse({ status: 409, description: 'Conflict - insufficient stock' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async checkout(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto) {
    const tipo = dto.tipoNormalized;
    const dataAgendada = dto.dataAgendadaNormalized;
    const janelaHorario = dto.janelaHorarioNormalized;

    const details: { field: string; errors: string[] }[] = [];
    if (!tipo)
      details.push({
        field: 'type',
        errors: ['type is required (domicilio | levantamento_loja)'],
      });
    else if (!['domicilio', 'levantamento_loja'].includes(tipo))
      details.push({ field: 'type', errors: ['type must be domicilio or levantamento_loja'] });
    if (!dataAgendada)
      details.push({
        field: 'scheduledDate',
        errors: ['scheduledDate is required (YYYY-MM-DD)'],
      });
    if (!janelaHorario)
      details.push({ field: 'timeWindow', errors: ['timeWindow is required'] });
    if (details.length) {
      throw new BadRequestException({
        error: { code: 'VALIDATION_ERROR', message: 'Validation error', details },
      });
    }

    const result = await this.checkoutService.checkout(user.sub, {
      enderecoId: dto.enderecoIdNormalized,
      zonaEntregaId: dto.zonaEntregaIdNormalized,
      tipo: tipo!,
      dataAgendada: dataAgendada!,
      janelaHorario: janelaHorario!,
    });

    return { data: result };
  }
}
