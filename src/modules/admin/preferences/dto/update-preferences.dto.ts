import { ApiHideProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ description: 'Notify new orders', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  @IsBoolean()
  notifyNewOrders?: boolean;

  @ApiHideProperty()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean({ message: 'notifyNewOrders must be a boolean' })
  notificarNovosPedidos?: boolean;

  @ApiPropertyOptional({ description: 'Notify low stock', example: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean()
  notifyLowStock?: boolean;

  @ApiHideProperty()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean({ message: 'notifyLowStock must be a boolean' })
  notificarStockBaixo?: boolean;

  @ApiPropertyOptional({ description: 'Notify new messages', example: true })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean()
  notifyNewMessages?: boolean;

  @ApiHideProperty()
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' || value === '1' ? true : value === 'false' || value === '0' ? false : value,
  )
  @IsBoolean({ message: 'notifyNewMessages must be a boolean' })
  notificarNovasMensagens?: boolean;

  @ApiPropertyOptional({ description: 'Default delivery fee (AOA)', example: 2500, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultDeliveryFee?: number;

  @ApiHideProperty()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'defaultDeliveryFee must be an integer' })
  @Min(0, { message: 'defaultDeliveryFee cannot be negative' })
  taxaEntregaPadrao?: number;

  @ApiPropertyOptional({
    description: 'Active payment methods',
    example: ['multicaixa_express', 'transferencia'],
    enum: PaymentMethod,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => normalizePaymentMethods(value))
  @IsArray()
  @IsEnum(PaymentMethod, { each: true })
  activePaymentMethods?: PaymentMethod[];

  @ApiHideProperty()
  @IsOptional()
  @Transform(({ value }) => normalizePaymentMethods(value))
  @IsArray({ message: 'activePaymentMethods must be an array' })
  @IsEnum(PaymentMethod, {
    each: true,
    message: `each method must be one of: ${Object.values(PaymentMethod).join(', ')}`,
  })
  metodosPagamentoAtivos?: PaymentMethod[];

  get notifyNewOrdersNormalized(): boolean | undefined {
    return this.notifyNewOrders ?? this.notificarNovosPedidos;
  }

  get notifyLowStockNormalized(): boolean | undefined {
    return this.notifyLowStock ?? this.notificarStockBaixo;
  }

  get notifyNewMessagesNormalized(): boolean | undefined {
    return this.notifyNewMessages ?? this.notificarNovasMensagens;
  }

  get defaultDeliveryFeeNormalized(): number | undefined {
    return this.defaultDeliveryFee ?? this.taxaEntregaPadrao;
  }

  get activePaymentMethodsNormalized(): PaymentMethod[] | undefined {
    return this.activePaymentMethods ?? this.metodosPagamentoAtivos;
  }
}

// legacy alias
export const UpdatePreferenciasDto = UpdatePreferencesDto;
export type UpdatePreferenciasDtoType = UpdatePreferencesDto;
