import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Address, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AddressResponse {
  id: string;
  compradorId: string;
  buyerId: string;
  etiqueta: string;
  label: string;
  provincia: string;
  province: string;
  municipio: string;
  municipality: string;
  bairro: string;
  neighborhood: string;
  rua: string;
  street: string;
  referencia: string | null;
  reference: string | null;
  latitude: number | null;
  longitude: number | null;
  predefinida: boolean;
  isDefault: boolean;
}

function toResponse(a: Address): AddressResponse {
  return {
    id: a.id,
    compradorId: a.buyerId,
    buyerId: a.buyerId,
    etiqueta: a.label,
    label: a.label,
    provincia: a.province,
    province: a.province,
    municipio: a.municipality,
    municipality: a.municipality,
    bairro: a.neighborhood,
    neighborhood: a.neighborhood,
    rua: a.street,
    street: a.street,
    referencia: a.reference ?? null,
    reference: a.reference ?? null,
    latitude: a.latitude ?? null,
    longitude: a.longitude ?? null,
    predefinida: a.isDefault,
    isDefault: a.isDefault,
  };
}

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(buyerId: string): Promise<AddressResponse[]> {
    const addresses = await this.prisma.address.findMany({
      where: { buyerId },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    });
    return addresses.map(toResponse);
  }

  async create(
    buyerId: string,
    data: {
      etiqueta: string;
      provincia: string;
      municipio: string;
      bairro: string;
      rua: string;
      referencia?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
  ): Promise<AddressResponse> {
    const count = await this.prisma.address.count({ where: { buyerId } });
    const isDefault = count === 0 ? true : false;

    const created = await this.prisma.address.create({
      data: {
        buyerId,
        label: data.etiqueta,
        province: data.provincia,
        municipality: data.municipio,
        neighborhood: data.bairro,
        street: data.rua,
        reference: data.referencia ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        isDefault,
      },
    });
    return toResponse(created);
  }

  async update(
    buyerId: string,
    id: string,
    data: {
      etiqueta?: string;
      provincia?: string;
      municipio?: string;
      bairro?: string;
      rua?: string;
      referencia?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    },
  ): Promise<AddressResponse> {
    const existing = await this.prisma.address.findUnique({ where: { id } });
    if (!existing || existing.buyerId !== buyerId) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Endereço não encontrado' },
      });
    }

    const updated = await this.prisma.address.update({
      where: { id },
      data: {
        ...(data.etiqueta !== undefined ? { label: data.etiqueta } : {}),
        ...(data.provincia !== undefined ? { province: data.provincia } : {}),
        ...(data.municipio !== undefined ? { municipality: data.municipio } : {}),
        ...(data.bairro !== undefined ? { neighborhood: data.bairro } : {}),
        ...(data.rua !== undefined ? { street: data.rua } : {}),
        ...(data.referencia !== undefined ? { reference: data.referencia } : {}),
        ...(data.latitude !== undefined ? { latitude: data.latitude } : {}),
        ...(data.longitude !== undefined ? { longitude: data.longitude } : {}),
      },
    });
    return toResponse(updated);
  }

  async remove(buyerId: string, id: string): Promise<void> {
    const existing = await this.prisma.address.findUnique({ where: { id } });
    if (!existing || existing.buyerId !== buyerId) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Endereço não encontrado' },
      });
    }

    const count = await this.prisma.address.count({ where: { buyerId } });

    if (count === 1) {
      // validação simples: impede remover se for o único e houver pedidos pendentes ligados
      const pendingStatuses: OrderStatus[] = [
        OrderStatus.AWAITING_PAYMENT,
        OrderStatus.PAID,
        OrderStatus.PREPARING,
        OrderStatus.SHIPPING,
      ];

      const linkedPending = await this.prisma.delivery.findFirst({
        where: {
          addressId: id,
          order: {
            buyerId,
            status: { in: pendingStatuses },
          },
        },
      });

      if (linkedPending) {
        throw new BadRequestException({
          erro: {
            codigo: 'ENDERECO_EM_USO',
            mensagem: 'Não é possível remover o único endereço com pedidos pendentes associados',
            detalhes: { enderecoId: id },
          },
        });
      }
    }

    await this.prisma.address.delete({ where: { id } });

    // se era predefinido e restam endereços, promove o primeiro como novo predefinido
    if (existing.isDefault) {
      const remaining = await this.prisma.address.findFirst({
        where: { buyerId },
        orderBy: { id: 'asc' },
      });
      if (remaining) {
        await this.prisma.address.update({
          where: { id: remaining.id },
          data: { isDefault: true },
        });
      }
    }
  }

  async setDefault(buyerId: string, id: string): Promise<AddressResponse> {
    const existing = await this.prisma.address.findUnique({ where: { id } });
    if (!existing || existing.buyerId !== buyerId) {
      throw new NotFoundException({
        erro: { codigo: 'NAO_ENCONTRADO', mensagem: 'Endereço não encontrado' },
      });
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.address.updateMany({
        where: { buyerId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.address.update({
        where: { id },
        data: { isDefault: true },
      }),
    ]);

    return toResponse(updated);
  }
}

export const EnderecosService = AddressesService;
