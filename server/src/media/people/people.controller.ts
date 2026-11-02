import { Controller, Get, Header, Param, Query, ParseIntPipe } from '@nestjs/common';
import { PeopleService } from './people.service';
import { CelebrityMediaService } from './media/celebrity-media.service';
import { PeopleRecommendationsService } from './people-recommendations.service';
import { CelebrityNewsService } from './news/celebrity-news.service';
import { CelebrityHubService } from './celebrity-hub.service';
import { CelebrityHubVideosService } from './celebrity-hub-videos.service';

@Controller('people')
export class PeopleController {
  constructor(
    private readonly peopleService: PeopleService,
    private readonly mediaService: CelebrityMediaService,
    private readonly recommendations: PeopleRecommendationsService,
    private readonly news: CelebrityNewsService,
    private readonly hub: CelebrityHubService,
    private readonly hubVideos: CelebrityHubVideosService,
  ) {}

  // Static hub routes must precede :id.
  @Get('hub/videos')
  @Header('Cache-Control', 'no-store')
  getHubVideos() {
    return this.hubVideos.getVideos();
  }

  @Get('hub')
  @Header('Cache-Control', 'no-store')
  getHub() {
    return this.hub.getHub();
  }

  @Get('news')
  @Header('Cache-Control', 'no-store')
  getNews() {
    return this.news.getNews();
  }

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

  @Get(':id/media')
  async getMedia(@Param('id', ParseIntPipe) id: number) {
    return this.mediaService.getMedia(id);
  }

  @Get(':id/news')
  @Header('Cache-Control', 'no-store')
  getPersonNews(@Param('id', ParseIntPipe) id: number) {
    return this.news.getNews(id);
  }

  @Get(':id/latest-videos')
  @Header('Cache-Control', 'no-store')
  getLatestVideos(@Param('id', ParseIntPipe) id: number) {
    return this.mediaService.getLatestVideos(id);
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
    return this.recommendations.getSimilarPeople(id);
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
