// app/tv/action.ts
'use server';

const NEST_API_URL = process.env.NEST_API_URL || 'http://localhost:4000';

export async function getAllMoods() {
    try {
        const url = `${NEST_API_URL}/moods`;

        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error response:', errorText);
            throw new Error(`Backend returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('Error in getAllMoods:', error);
        throw error;
    }
}

export async function getMoodRecommendations(
    moodId: string,
    limit: number = 12,
    mediaType: string = 'both',
    forceRefresh: boolean = false,
    shuffle: boolean = true,
    options: {
        userId?: string;
        minRating?: number;
        excludeViewed?: boolean;
        page?: number;
    } = {},
) {
    try {
        const params = new URLSearchParams({
            moodId,
            limit: limit.toString(),
            mediaType,
            forceRefresh: forceRefresh.toString(),
            shuffle: shuffle.toString(),
            page: String(options.page ?? 1),
            minRating: String(options.minRating ?? 5.8),
            excludeViewed: String(options.excludeViewed ?? true),
        });

        if (options.userId) {
            params.set('userId', options.userId);
        }

        const url = `${NEST_API_URL}/moods/recommendations?${params}`;

        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Backend error response:', errorText);
            throw new Error(`Backend returned ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error in getMoodRecommendations:', error);
        throw error;
    }
}
