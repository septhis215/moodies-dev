import { Controller, Get } from '@nestjs/common';
import { AllService } from './all.service';

@Controller('all')
export class AllController {
  constructor(private readonly allService: AllService) {}

  @Get('trending/day')
  async getTrendingAllDay() {
    return this.allService.trending('day');
  }

  @Get('trending/week')
  async getTrendingAllWeek() {
    return this.allService.trending('week');
  }
}
