import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { PeopleService } from './people.service';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) { }

  @Get('trending/:type')
  async getTrending(@Param('type') type: string) {
    return this.peopleService.trending(type);
  }

  @Get('popular')
  async getPopular(@Query('page', ParseIntPipe) page: number = 1) {
    return this.peopleService.getPopular(page);
  }

  @Get('search')
  async searchPeople(
    @Query('query') query: string,
    @Query('page', ParseIntPipe) page: number = 1,
  ) {
    return this.peopleService.searchPeople(query, page);
  }

  @Get(':id')
  async getPersonDetails(@Param('id', ParseIntPipe) id: number) {
    return this.peopleService.getPersonDetails(id);
  }

  @Get(':id/movie-credits')
  async getMovieCredits(@Param('id', ParseIntPipe) id: number) {
    return this.peopleService.getMovieCredits(id);
  }

  @Get(':id/tv-credits')
  async getTvCredits(@Param('id', ParseIntPipe) id: number) {
    return this.peopleService.getTvCredits(id);
  }

  @Get(':id/images')
  async getImages(@Param('id', ParseIntPipe) id: number) {
    return this.peopleService.getImages(id);
  }

  @Get(':id/tagged-images')
  async getTaggedImages(@Param('id', ParseIntPipe) id: number) {
    return this.peopleService.getTaggedImages(id);
  }
}