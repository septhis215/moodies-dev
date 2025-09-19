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

  @Get('featured')
  async featured() {
    return this.allService.getFeatured(25); // number of items in the carousel row
  }
  
  @Get('trending')
  async trending() {
    return this.allService.getTrending(25);
  }

  @Get('trailers')
  async trailers() {
    return this.allService.getTrailers(25);
  }

  @Get('favorites')
  async favorites() {
    return this.allService.getFavorites(25);
  }
  @Get('koreaTrending')
  async koreaTrending() {
    return this.allService.getKoreaTrending(25);
  }
  @Get('peoples')
  async peoples() {
    return this.allService.getPeople(25);
  }
}
