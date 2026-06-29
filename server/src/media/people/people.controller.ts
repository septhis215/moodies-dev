import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { PeopleService } from './people.service';

@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

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

  @Get('discover')
  async discoverPeople(
    @Query('query') query?: string,
    @Query('category') category?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.peopleService.discoverPeople({
      query,
      category,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get(':id/videos')
  async getRelatedVideos(@Param('id', ParseIntPipe) id: number) {
    return this.peopleService.getRelatedVideos(id);
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

  @Get(':id/similar')
  async getSimilar(@Param('id', ParseIntPipe) id: number) {
    return this.peopleService.getSimilarPeople(id);
  }

  @Get(':id/upcoming')
  async getUpcoming(@Param('id', ParseIntPipe) id: number) {
    return this.peopleService.getUpcomingProjects(id);
  }

  // NEW ENDPOINTS
  // @Get(':id/timeline')
  // async getTimeline(@Param('id', ParseIntPipe) id: number) {
  //   return this.peopleService.getCareerTimeline(id);
  // }

  @Get(':id/collaborations')
  async getCollaborations(@Param('id', ParseIntPipe) id: number) {
    return this.peopleService.getCollaborations(id);
  }
}
