import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  Post,
  Body,
} from '@nestjs/common';
import { CategoryService } from './category.service';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get('trending')
  async trending(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.categoryService.getTrending(page, limit);
  }

  @Get('fresh-off-the-screen')
  async newReleases(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.categoryService.getNewReleases(page, limit);
  }

  @Get('korean-hits')
  async koreanTrending(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.categoryService.getKoreaTrending(page, limit);
  }

  @Get('coming-soon')
  async comingSoon(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ) {
    return this.categoryService.getComingSoon(page, limit);
  }
}
