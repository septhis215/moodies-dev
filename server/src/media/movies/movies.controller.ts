import { Controller, Get, Param, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';

@Controller('movies')
export class MoviesController {
  constructor(private readonly movieService: MoviesService) { }
  @Get('details/:id')
  async details(@Param('id') id: string, @Query('type') type?: 'movie' | 'tv') {
    const payload = await this.movieService.movieDetails(Number(id), type as any);
    return payload;
  }
}
