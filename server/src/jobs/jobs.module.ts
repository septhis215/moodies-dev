import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { MoviesModule } from 'src/media/movies/movies.module';
import { TvModule } from 'src/media/tv/tv.module';
import { AllModule } from 'src/media/all/all.module';

@Module({
  imports: [MoviesModule, TvModule, AllModule],
  providers: [SeedService],
})
export class JobsModule {}
