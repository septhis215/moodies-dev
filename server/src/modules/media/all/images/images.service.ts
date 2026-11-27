import { Injectable } from '@nestjs/common';
import { TmdbClientService } from '../client/tmdb-client.service';

@Injectable()
export class ImagesService {
    constructor(private readonly client: TmdbClientService) { }

    async images(id: number, type: string) {
        const data = await this.client.tmdb(`${type}/${id}/images`);
        if (!data) return { posters: [], backdrops: [] };

        const posters: string[] = (data.posters ?? [])
            .map((p: any) => p?.file_path ?? null)
            .filter((fp: string | null): fp is string => Boolean(fp));

        const backdrops: string[] = (data.backdrops ?? [])
            .map((b: any) => b?.file_path ?? null)
            .filter((fp: string | null): fp is string => Boolean(fp));

        return { posters, backdrops };
    }
}