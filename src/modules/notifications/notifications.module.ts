import { Module } from '@nestjs/common';
import {
  PerfilNotificacoesController,
  ProfileNotificationsController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [PerfilNotificacoesController, ProfileNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

export const NotificacoesModule = NotificationsModule;
