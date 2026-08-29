import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController, AuditoriaController } from './audit.controller';

@Global()
@Module({
  controllers: [AuditController, AuditoriaController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

// Portuguese alias
export const AuditoriaModule = AuditModule;
