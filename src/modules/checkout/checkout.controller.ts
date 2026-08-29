import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutDto } from './dto/checkout.dto';

@ApiTags('checkout')
@ApiBearerAuth('bearer')
@Controller('checkout')
@Throttle({ checkout: { ttl: 60_000, limit: 10 } })
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria pedido a partir do carrinho (transação: valida stock, decrementa, cria pedido+entrega, esvazia carrinho)' })
  async checkout(@CurrentUser() user: JwtPayload, @Body() dto: CheckoutDto) {
    const tipo = dto.tipoNormalized;
    const dataAgendada = dto.dataAgendadaNormalized;
    const janelaHorario = dto.janelaHorarioNormalized;

    // validação obrigatórios — bilíngue
    const detalhes: { campo: string; erros: string[] }[] = [];
    if (!tipo) detalhes.push({ campo: 'tipo', erros: ['tipo é obrigatório (domicilio | levantamento_loja)'] });
    else if (!['domicilio', 'levantamento_loja'].includes(tipo)) detalhes.push({ campo: 'tipo', erros: ['tipo deve ser domicilio ou levantamento_loja'] });
    if (!dataAgendada) detalhes.push({ campo: 'data_agendada', erros: ['data_agendada é obrigatória (YYYY-MM-DD)'] });
    if (!janelaHorario) detalhes.push({ campo: 'janela_horario', erros: ['janela_horario é obrigatória'] });
    if (detalhes.length) {
      throw new BadRequestException({
        erro: { codigo: 'ERRO_VALIDACAO', mensagem: 'Erro de validação', detalhes },
      });
    }

    // Para domicilio, permitir sem endereco_id/zona mas serviço resolve fallback;
    // Se quiser estrito, descomentar:
    // if (tipo === 'domicilio' && !dto.enderecoIdNormalized && !dto.zonaEntregaIdNormalized) { ... }

    const result = await this.checkoutService.checkout(user.sub, {
      enderecoId: dto.enderecoIdNormalized,
      zonaEntregaId: dto.zonaEntregaIdNormalized,
      tipo: tipo!,
      dataAgendada: dataAgendada!,
      janelaHorario: janelaHorario!,
    });

    return { data: result, dados: result };
  }
}
