// search/search.controller.ts
import { Controller, Get, Query, ValidationPipe } from '@nestjs/common';
import { SearchFilters, SearchService } from './search.service';
import { IsOptional, IsString, IsNumber, IsIn, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

class SearchQueryDto {
    @IsString()
    q: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @IsIn(['all', 'movie', 'tv', 'person'])
    type?: 'all' | 'movie' | 'tv' | 'person' = 'all';

    @IsOptional()
    @IsIn(['relevance', 'rating', 'date', 'popularity'])
    sort?: 'relevance' | 'rating' | 'date' | 'popularity' = 'relevance';

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1900)
    @Max(2030)
    year_min?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1900)
    @Max(2030)
    year_max?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(10)
    rating_min?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(10)
    rating_max?: number;

    @IsOptional()
    @IsString()
    genres?: string;

    @IsOptional()
    @IsString()
    countries?: string;

    @IsOptional()
    @Transform(({ value }) => value === 'true')
    include_adult?: boolean = false;

    @IsOptional()
    @Transform(({ value }) => value === 'true')
    regex_search?: boolean = false;
}

class SearchSuggestionsDto {
    @IsString()
    q: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    @Max(20)
    limit?: number = 5;

    @IsOptional()
    @IsIn(['content', 'person'])
    mode?: 'content' | 'person' = 'content';

    @IsOptional()
    @Transform(({ value }) => value === 'true')
    regex_search?: boolean = false;
}

@Controller('search')
export class SearchController {
    constructor(private readonly searchService: SearchService) { }

    @Get()
    async search(@Query(ValidationPipe) searchQuery: SearchQueryDto) {
        // Map the DTO to the service interface
        const filters: SearchFilters = {
            query: searchQuery.q,
            page: searchQuery.page,
            type: searchQuery.type,
            sort: searchQuery.sort,
            year_min: searchQuery.year_min,
            year_max: searchQuery.year_max,
            rating_min: searchQuery.rating_min,
            rating_max: searchQuery.rating_max,
            genres: searchQuery.genres,
            countries: searchQuery.countries,
            include_adult: searchQuery.include_adult,
            regex_search: searchQuery.regex_search,
        };

        return this.searchService.search(filters);
    }

    @Get('suggestions/content')
    getContentSuggestions(@Query(ValidationPipe) query: SearchSuggestionsDto) {
        return this.searchService.getContentSuggestions(
            query.q,
            query.limit,
            query.regex_search
        );
    }

    @Get('suggestions/person')
    getPersonSuggestions(@Query(ValidationPipe) query: SearchSuggestionsDto) {
        return this.searchService.getPersonSuggestions(
            query.q,
            query.limit,
            query.regex_search
        );
    }

    @Get('genres')
    async getAvailableGenres() {
        return {
            genres: this.searchService.getAvailableGenres()
        };
    }

    @Get('countries')
    async getAvailableCountries() {
        return {
            countries: this.searchService.getAvailableCountries()
        };
    }

    @Get('filters')
    async getAvailableFilters() {
        return {
            genres: this.searchService.getAvailableGenres(),
            countries: this.searchService.getAvailableCountries(),
            years: this.getAvailableYears(),
            ratings: this.getAvailableRatings(),
            types: this.getSearchTypes()
        };
    }

    private getAvailableYears(): number[] {
        const currentYear = new Date().getFullYear();
        const years: number[] = [];
        for (let year = currentYear; year >= 1900; year--) {
            years.push(year);
        }
        return years;
    }

    private getAvailableRatings() {
        return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    }

    private getSearchTypes() {
        return [
            { value: 'all', label: 'All' },
            { value: 'movie', label: 'Movies' },
            { value: 'tv', label: 'TV Shows' },
            { value: 'person', label: 'People' }
        ];
    }
}