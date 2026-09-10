import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private getUserFromToken(token?: string): { sub: string; email?: string; role?: string } | null {
    if (!token) return null;
    try {
      const raw = token.replace(/^Bearer\s+/i, '').trim();
      const secret = this.config.get<string>('jwt.secret') ?? this.config.get<string>('JWT_SECRET');
      if (!secret) return null;
      const payload = this.jwt.verify(raw, { secret }) as any;
      if (!payload?.sub) return null;
      return { sub: String(payload.sub), email: payload.email, role: payload.role };
    } catch {
      return null;
    }
  }

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string) ??
      (client.handshake.headers?.authorization as string) ??
      (client.handshake.query?.token as string) ??
      undefined;
    const user = this.getUserFromToken(token);
    if (user) {
      (client as any).userId = user.sub;
      await client.join(`buyer:${user.sub}`);
      if (user.role === 'ADMIN' || user.role === 'admin') {
        await client.join('admins');
      }
      this.logger.log(`WS connected ${client.id} -> buyer:${user.sub} ${user.role ?? ''}`);
      client.emit('connected', { userId: user.sub, message: 'Conectado ao realtime' });
    } else {
      this.logger.log(`WS connected ${client.id} (anon) - aguardando auth:join`);
      client.emit('connected', { message: 'Conectado - envie auth:join com token para receber pagamentos' });
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`WS disconnected ${client.id}`);
  }

  @SubscribeMessage('auth:join')
  async handleAuthJoin(@MessageBody() data: { token?: string } | string, @ConnectedSocket() client: Socket) {
    const token = typeof data === 'string' ? data : data?.token;
    const user = this.getUserFromToken(token);
    if (!user) {
      client.emit('error', { message: 'Token inválido' });
      return { ok: false, message: 'Token inválido' };
    }
    (client as any).userId = user.sub;
    await client.join(`buyer:${user.sub}`);
    if (user.role === 'ADMIN' || user.role === 'admin') await client.join('admins');
    client.emit('joined', { userId: user.sub, rooms: [`buyer:${user.sub}`] });
    return { ok: true, userId: user.sub };
  }

  // Chamada pelo PaymentsService quando pagamento vira PAID
  emitPaymentConfirmed(buyerId: string, payload: { orderId: string; paymentId: string; amount: number; gateway: string; externalReference?: string; orderStatus?: string }) {
    const event = {
      type: 'payment:confirmed',
      ...payload,
      confirmedAt: new Date().toISOString(),
    };
    this.logger.log(`Emit payment:confirmed buyer:${buyerId} order:${payload.orderId} amount:${payload.amount}`);
    this.server.to(`buyer:${buyerId}`).emit('payment:confirmed', event);
    this.server.to(`buyer:${buyerId}`).emit('payment:paid', event); // alias curto
    this.server.to('admins').emit('payment:confirmed', event); // admins também recebem
  }

  emitPaymentFailed(buyerId: string, payload: { orderId: string; paymentId: string; gateway: string; reason?: string }) {
    const event = { type: 'payment:failed', ...payload, failedAt: new Date().toISOString() };
    this.server.to(`buyer:${buyerId}`).emit('payment:failed', event);
    this.server.to('admins').emit('payment:failed', event);
  }
}
