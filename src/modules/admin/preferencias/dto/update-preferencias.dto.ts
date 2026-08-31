import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

function normalizePaymentMethods(value: any): PaymentMethod[] | undefined {
  if (value === undefined || value === null) return undefined;
  const arr = Array.isArray(value) ? value : [value];
  return arr
    .map((v) => String(v).trim().toLowerCase())
    .map((v) => {
      const map: Record<string, PaymentMethod> = {
        multicaixa_express: PaymentMethod.MULTICAIXA_EXPRESS,
        gpo: PaymentMethod.MULTICAIXA_EXPRESS,
        referencia_multicaixa: PaymentMethod.MULTICAIXA_REFERENCE,
        referencia: PaymentMethod.MULTICAIXA_REFERENCE,
        gpr: PaymentMethod.MULTICAIXA_REFERENCE,
        transferencia: PaymentMethod.BANK_TRANSFER,
        bank_transfer: PaymentMethod.BANK_TRANSFER,
        pagamento_entrega: PaymentMethod.CASH_ON_DELIVERY,
        cash_on_delivery: PaymentMethod.CASH_ON_DELIVERY,
        cartao: PaymentMethod.CARD,
        card: PaymentMethod.CARD,
      };
      return map[v] ?? v;
    })
    .filter(Boolean) as PaymentMethod[];
}

export class UpdatePreferenciasDto {
  @ApiPropertyOptional({ description: 'Notificar novos pedidos', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean({ message: 'notifyNewOrders must be a boolean' })
  notificarNovosPedidos?: boolean;

  @ApiPropertyOptional({ description: 'Alias notifyNewOrders' })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean()
  notifyNewOrders?: boolean;

  @ApiPropertyOptional({ description: 'Notificar stock baixo', example: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean({ message: 'notifyLowStock must be a boolean' })
  notificarStockBaixo?: boolean;

  @ApiPropertyOptional({ description: 'Alias notifyLowStock' })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean()
  notifyLowStock?: boolean;

  @ApiPropertyOptional({ description: 'Notificar novas mensagens', example: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean({ message: 'notifyNewMessages must be a boolean' })
  notificarNovasMensagens?: boolean;

  @ApiPropertyOptional({ description: 'Alias notifyNewMessages' })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean()
  notifyNewMessages?: boolean;

  @ApiPropertyOptional({ description: 'Taxa de entrega padrão (AOA)', example: 2500, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'defaultDeliveryFee must be an integer' })
  @Min(0, { message: 'defaultDeliveryFee cannot be negative' })
  taxaEntregaPadrao?: number;

  @ApiPropertyOptional({ description: 'Alias defaultDeliveryFee' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultDeliveryFee?: number;

  @ApiPropertyOptional({
    description: 'Métodos de pagamento ativos',
    example: ['multicaixa_express', 'transferencia'],
    enum: PaymentMethod,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => normalizePaymentMethods(value))
  @IsArray({ message: 'activePaymentMethods must be an array' })
  @IsEnum(PaymentMethod, {
    each: true,
    message: `each method must be one of: ${Object.values(PaymentMethod).join(', ')}`,
  })
  metodosPagamentoAtivos?: PaymentMethod[];

  @ApiPropertyOptional({ description: 'Alias activePaymentMethods' })
  @IsOptional()
  @Transform(({ value }) => normalizePaymentMethods(value))
  @IsArray()
  @IsEnum(PaymentMethod, { each: true })
  activePaymentMethods?: PaymentMethod[];

  get notifyNewOrdersNormalized(): boolean | undefined {
    return this.notificarNovosPedidos ?? this.notifyNewOrders;
  }

  get notifyLowStockNormalized(): boolean | undefined {
    return this.notificarStockBaixo ?? this.notifyLowStock;
  }

  get notifyNewMessagesNormalized(): boolean | undefined {
    return this.notificarNovasMensagens ?? this.notifyNewMessages;
  }

  get defaultDeliveryFeeNormalized(): number | undefined {
    return this.taxaEntregaPadrao ?? this.defaultDeliveryFee;
  }

  get activePaymentMethodsNormalized(): PaymentMethod[] | undefined {
    return this.metodosPagamentoAtivos ?? this.activePaymentMethods;
  }
}
