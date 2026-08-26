import { Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('perfil-notificacoes')
@ApiBearerAuth('bearer')
@Controller('perfil/notificacoes')
export class PerfilNotificacoesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista notificações do comprador (criadoEm ISO, lida boolean)' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const notifications = await this.notificationsService.findAll(user.sub);
    return { data: notifications, dados: notifications };
  }

  // IMPORTANTE: /lidas antes de /:id/lida para não capturar "lidas" como :id
  @Patch('lidas')
  @ApiOperation({ summary: 'Marca todas as notificações como lidas' })
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    const result = await this.notificationsService.marcarTodasComoLidas(user.sub);
    return { data: result, dados: result, mensagem: 'Todas as notificações marcadas como lidas' };
  }

  @Patch(':id/lida')
  @ApiOperation({ summary: 'Marca uma notificação como lida' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async markOneAsRead(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const notification = await this.notificationsService.marcarComoLida(user.sub, id);
    return { data: notification, dados: notification };
  }
}

@ApiTags('profile-notifications')
@ApiBearerAuth('bearer')
@Controller('profile/notifications')
export class ProfileNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List buyer notifications (createdAt ISO, isRead boolean)' })
  async findAll(@CurrentUser() user: JwtPayload) {
    const notifications = await this.notificationsService.findAll(user.sub);
    return { data: notifications, dados: notifications };
  }

  @Patch('read')
  @ApiOperation({ summary: 'Mark all notifications as read (alias)' })
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    const result = await this.notificationsService.marcarTodasComoLidas(user.sub);
    return { data: result, dados: result, message: 'All notifications marked as read' };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async markOneAsRead(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    const notification = await this.notificationsService.marcarComoLida(user.sub, id);
    return { data: notification, dados: notification };
  }
}
