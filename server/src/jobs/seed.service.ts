import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TMDBService } from 'src/external-apis/services/tmdb.service';
import { MoviesService } from 'src/media/movies/movies.service';
import { TvService } from 'src/media/tv/tv.service';
import { AllService } from 'src/media/all/all.service';
import { runWithTmdbPriority, TMDB_PRIORITY } from 'src/external-apis/services/tmdb-priority.context';

@Injectable()
export class SeedService {
    private readonly logger = new Logger(SeedService.name);

    constructor(
        private readonly tmdb: TMDBService,
        private readonly movies: MoviesService,
        private readonly tv: TvService,
        private readonly all: AllService,
    ) {}

    /**
     * Warm the homepage + list endpoints once a day at 3 AM so the first user
     * of every morning is served entirely from Redis instead of triggering the
     * hundreds-of-calls cold flood.
     *
     * Runs at BACKGROUND priority so that in the unlikely event it overlaps real
     * traffic, live page loads always jump ahead in the rate-limiter queue.
     */
    @Cron('0 3 * * *', { name: 'seedDailyTmdb' })
    async seedDaily() {
        this.logger.log('🌱 Daily TMDB seed starting');
        const start = Date.now();

        // Limits mirror what the homepages actually request, so the warmed
        // cache entries match the keys real requests will look up.
        const tasks: ReadonlyArray<readonly [string, () => Promise<unknown>]> = [
            // Genre/config lookups
            ['genres:movie', () => this.tmdb.getMovieGenres()],
            ['genres:tv', () => this.tmdb.getTVGenres()],

            // Movies homepage — every TMDB-heavy section it loads
            ['movies:trending', () => this.movies.getTrending(25)],
            ['movies:featured', () => this.movies.getFeatured(25)],
            ['movies:trailers', () => this.movies.getTrailers(25)],
            ['movies:upcoming-trailers', () => this.movies.getUpcomingTrailers(40)],
            ['movies:korea', () => this.movies.getKoreaTrending(25)],
            ['movies:action', () => this.movies.getActionMovies(20)],
            ['movies:animated', () => this.movies.getAnimatedMovies(20)],
            ['movies:indie', () => this.movies.getIndieMovies(20)],
            ['movies:award-winners', () => this.movies.getAwardWinners(25)],
            ['movies:new-releases', () => this.movies.getNewReleases(30)],
            ['movies:favorites', () => this.movies.getFavorites(30)],

            // TV homepage — every TMDB-heavy section it loads
            ['tv:trending', () => this.tv.getTrending(25)],
            ['tv:featured', () => this.tv.getFeatured(20)],
            ['tv:trailers', () => this.tv.getTrailers(20)],
            ['tv:upcoming-trailers', () => this.tv.getUpcomingTrailers(60)],
            ['tv:korea', () => this.tv.getKoreaTrending(20)],
            ['tv:new-releases', () => this.tv.getNewReleases(30)],
            ['tv:favorites', () => this.tv.getFavorites(30)],
            ['tv:airing-today', () => this.tv.airingToday(15)],
            ['tv:airing-week', () => this.tv.airingThisWeek(20)],

            // Default (/) homepage — the /all aggregate endpoints
            ['all:trending', () => this.all.getTrending(25)],
            ['all:featured', () => this.all.getFeatured(25)],
            ['all:trailers', () => this.all.getTrailers(25)],
            ['all:upcoming-trailers', () => this.all.getUpcomingTrailers(25)],
            ['all:korea', () => this.all.getKoreaTrending(20)],
            ['all:people', () => this.all.getPeople(20)],
        ];

        const results = await runWithTmdbPriority(TMDB_PRIORITY.BACKGROUND, () =>
            Promise.allSettled(tasks.map(([, fn]) => fn())),
        );

        results.forEach((r, i) => {
            const [label] = tasks[i];
            if (r.status === 'rejected') {
                this.logger.warn(`Seed task "${label}" failed: ${r.reason?.message ?? r.reason}`);
            }
        });

        const ok = results.filter(r => r.status === 'fulfilled').length;
        this.logger.log(
            `🌱 Daily TMDB seed: ${ok}/${tasks.length} succeeded in ${Date.now() - start}ms`,
        );
    }
}
