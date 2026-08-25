import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      name: 'sadivacloset-api',
      status: 'ok',
      docs: '/health',
    };
  }
}
