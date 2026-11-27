import { Injectable } from '@nestjs/common';

@Injectable()
export class ContentFilterService {
    private readonly BANNED_WORDS = [
        "에로", "성인", "야한", "포르노", "섹스", "성적", "노출", "관음", "야설",
        "porn", "sex", "xxx", "erotic", "adult", "nude", "av"
    ];

    private readonly BANNED_GENRE_IDS = new Set<number>([
        2916, 3568, 2972, 10364
    ]);

    private readonly MIN_VOTE_COUNT = 20;

    isAdultishItem(m: any): boolean {
        const title = (m.title ?? m.name ?? "").toString().toLowerCase();
        const overview = (m.overview ?? "").toString().toLowerCase();

        for (const bad of this.BANNED_WORDS) {
            if (title.includes(bad) || overview.includes(bad)) return true;
        }

        if (Array.isArray(m.genre_ids) && m.genre_ids.some((g: number) => this.BANNED_GENRE_IDS.has(g))) {
            return true;
        }

        if (m.adult === true) return true;

        if (typeof m.vote_count === "number" && m.vote_count < this.MIN_VOTE_COUNT) {
            return true;
        }

        if (m.runtime && m.runtime > 0 && m.runtime < 50) return true;

        return false;
    }

    filterAdultishContent(results: any[]): any[] {
        if (!Array.isArray(results)) return [];
        return results.filter((m) => {
            try {
                return !this.isAdultishItem(m);
            } catch {
                return true;
            }
        });
    }

    filterPeopleList(people: any[]): any[] {
        if (!Array.isArray(people)) return [];
        return people.filter(person => {
            if (person.adult === true) return false;

            const knownFor = person.known_for ?? [];
            if (!Array.isArray(knownFor) || knownFor.length === 0) {
                return true;
            }
            if (person.profile_path === null) {
                return false;
            }

            for (const item of knownFor) {
                if (this.isAdultishItem(item)) return false;
            }

            const lowVotes = knownFor.filter((k: any) => (k.vote_count ?? 0) < this.MIN_VOTE_COUNT).length;
            if (lowVotes >= Math.ceil(knownFor.length * 0.75)) return false;

            return true;
        });
    }
}