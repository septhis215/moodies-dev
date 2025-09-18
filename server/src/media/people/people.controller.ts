import { Controller, Get } from '@nestjs/common';
import { PeopleService } from './people.service';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get('trending/day')
  async getTrendingPeopleDay() {
    return this.peopleService.trending('day');
  }

  @Get('trending/week')
  async getTrendingPeopleWeek() {
    return this.peopleService.trending('week');
  }
}
