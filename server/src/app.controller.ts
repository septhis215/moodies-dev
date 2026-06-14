import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  health() {
    // RAILWAY_GIT_COMMIT_SHA is injected by Railway at deploy time. Exposing it
    // lets CI confirm the exact commit currently serving traffic.
    return {
      status: 'ok',
      commit: process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local',
    };
  }
}
