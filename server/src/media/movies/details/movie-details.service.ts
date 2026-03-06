import { Injectable, Logger } from '@nestjs/common';
import { MovieTmdbClientService } from '../client/movie-tmdb-client.service';

@Injectable()
export class MovieDetailsService {
    private readonly logger = new Logger(MovieDetailsService.name);

    constructor(private readonly client: MovieTmdbClientService) { }

    private async fetchInfo(id: number) {
        return this.client.tmdb(`movie/${id}?language=en-US`);
    }

    private async fetchCredits(id: number) {
        return this.client.tmdb(`movie/${id}/credits?language=en-US`);
    }

    private async fetchVideos(id: number) {
        return this.client.tmdb(`movie/${id}/videos?language=en-US`);
    }

    private async fetchProviders(id: number) {
        return this.client.tmdb(`movie/${id}/watch/providers`);
    }

    private async fetchReviews(id: number) {
        return this.client.tmdb(`movie/${id}/reviews?language=en-US&page=1`);
    }

    private async fetchSimilar(id: number) {
        return this.client.tmdb(`movie/${id}/similar?language=en-US&page=1`);
    }

    private async fetchContentRatings(id: number) {
        return this.client.tmdb(`movie/${id}/release_dates`);
    }

    private getContentRating(
        ratingsData: any,
        fallbackCountries: string[] = ['GB', 'CA', 'AU', 'FR', 'DE', 'IN', 'JP'],
    ): string {
        if (!ratingsData) return 'NR';

        const results = ratingsData?.results ?? [];

        const findCertForCountry = (countryCode: string) => {
            const countryObj = results.find((r: any) => r.iso_3166_1 === countryCode);
            if (!countryObj || !Array.isArray(countryObj.release_dates)) return null;
            const entry = countryObj.release_dates.find(
                (d: any) => d.certification && String(d.certification).trim() !== '',
            );
            return entry?.certification ?? null;
        };

        const usCert = findCertForCountry('US');
        if (usCert) return usCert;

        for (const country of fallbackCountries) {
            const cert = findCertForCountry(country);
            if (cert) return cert;
        }

        for (const countryObj of results) {
            if (!Array.isArray(countryObj.release_dates)) continue;
            const entry = countryObj.release_dates.find(
                (d: any) => d.certification && String(d.certification).trim() !== '',
            );
            if (entry?.certification) return entry.certification;
        }

        return 'NR';
    }

    async movieDetails(id: number) {
        const [
            infoRaw,
            creditsRaw,
            videosRaw,
            providersRaw,
            reviewsRaw,
            similarRaw,
            contentRatingsRaw,
        ] = await Promise.all([
            this.fetchInfo(id),
            this.fetchCredits(id),
            this.fetchVideos(id),
            this.fetchProviders(id),
            this.fetchReviews(id),
            this.fetchSimilar(id),
            this.fetchContentRatings(id),
        ]);

        const videos = videosRaw?.results ?? videosRaw ?? [];
        const trailer =
            (videos || []).find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') ?? null;

        const runtime =
            infoRaw?.runtime ??
            (Array.isArray(infoRaw?.episode_run_time)
                ? (infoRaw.episode_run_time[0] ?? 0)
                : (infoRaw?.episode_run_time ?? 0)) ??
            0;

        const production_countries =
            infoRaw?.production_countries ??
            (infoRaw?.origin_country
                ? (infoRaw.origin_country as string[]).map((c) => ({ iso_3166_1: c }))
                : []);

        const director =
            (creditsRaw?.crew ?? []).find((c: any) => c.job === 'Director')?.name ??
            (infoRaw?.created_by && infoRaw.created_by[0]?.name) ??
            undefined;

        const contentRating = this.getContentRating(contentRatingsRaw);

        const info = {
            id: infoRaw?.id,
            title: infoRaw?.title ?? infoRaw?.name ?? 'Untitled',
            original_title: infoRaw?.original_title ?? infoRaw?.original_name ?? null,
            overview: infoRaw?.overview ?? '',
            release_date: infoRaw?.release_date ?? infoRaw?.first_air_date ?? '',
            runtime,
            budget: infoRaw?.budget ?? 0,
            revenue: infoRaw?.revenue ?? 0,
            vote_average: infoRaw?.vote_average ?? 0,
            vote_count: infoRaw?.vote_count ?? 0,
            genres: infoRaw?.genres ?? [],
            production_companies: infoRaw?.production_companies ?? [],
            production_countries,
            spoken_languages: infoRaw?.spoken_languages ?? [],
            status: infoRaw?.status ?? (infoRaw?.in_production ? 'In Production' : 'Released'),
            tagline: infoRaw?.tagline ?? null,
            homepage: infoRaw?.homepage ?? null,
            poster_path: infoRaw?.poster_path ?? null,
            backdrop_path: infoRaw?.backdrop_path ?? null,
            created_by: infoRaw?.created_by ?? null,
            content_type: 'movie',
            director,
            content_rating: contentRating,
        };

        const credits = {
            cast: (creditsRaw?.cast ?? []).sort(
                (a: any, b: any) => (a.order ?? 999) - (b.order ?? 999),
            ),
            crew: creditsRaw?.crew ?? [],
        };

        return {
            info,
            credits,
            trailer,
            providers: providersRaw ?? {},
            reviews: reviewsRaw?.results ?? reviewsRaw ?? [],
            similar: similarRaw?.results ?? similarRaw ?? [],
            raw: {
                info: infoRaw,
                credits: creditsRaw,
                videos: videosRaw,
                providers: providersRaw,
                reviews: reviewsRaw,
                similar: similarRaw,
            },
        };
    }
}