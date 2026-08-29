import { Module, Global } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController, AuditController } from './auditoria.controller';

@Global()
@Module({
  controllers: [AuditoriaController, AuditController],
  providers: [AuditoriaService],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}

export const AuditModule = AuditoriaModule;
