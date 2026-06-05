import { Injectable } from '@nestjs/common';
import { DISQUALIFY_RE } from '../utils/helpers';

@Injectable()
export class VideoScoringService {
  private readonly supportedVideoTypes = new Set([
    'Trailer',
    'Teaser',
    'Clip',
    'Featurette',
    'Behind the Scenes',
    'Preview',
    'Bloopers',
    'Opening Credits',
  ]);

  normalizeVideoType(video: any): string {
    const type = typeof video?.type === 'string' ? video.type.trim() : '';
    const name = (video?.name || '').toLowerCase();

    if (
      /behind[-\s]?the[-\s]?scenes|bts/.test(name) ||
      type === 'Behind the Scenes'
    ) {
      return 'Behind the Scenes';
    }
    if (/featurette/.test(name) || type === 'Featurette') return 'Featurette';
    if (/preview|sneak peek|first look/.test(name)) return 'Preview';
    if (/clip|scene/.test(name) || type === 'Clip') return 'Clip';
    if (/teaser/.test(name) || type === 'Teaser') return 'Teaser';
    if (/trailer/.test(name) || type === 'Trailer') return 'Trailer';
    if (this.supportedVideoTypes.has(type)) return type;

    return type || 'Video';
  }

  getVideoTypeLabel(video: any): string {
    return this.normalizeVideoType(video);
  }

  calculateVideoScore(video: any): number {
    let score = 0;
    const name = (video.name || '').toLowerCase();
    const type = this.normalizeVideoType(video);

    if (DISQUALIFY_RE.test(name)) return -100000;

    if (video.official) score += 10;

    if (type === 'Trailer') score += 9;
    else if (type === 'Teaser') score += 7;
    else if (type === 'Preview') score += 6;
    else if (type === 'Featurette') score += 5;
    else if (type === 'Clip') score += 4;
    else if (type === 'Behind the Scenes') score += 3;
    else if (type === 'Opening Credits') score += 2;
    else if (type === 'Bloopers') score += 1;

    if (video.size >= 2160) score += 6;
    else if (video.size >= 1080) score += 5;
    else if (video.size >= 720) score += 3;
    else if (video.size >= 480) score += 1;

    if (name.includes('official')) score += 3;
    if (name.includes('trailer')) score += 2;
    if (
      name.includes('fan') ||
      name.includes('leak') ||
      name.includes('leaked')
    )
      score -= 6;

    if (video.site === 'YouTube') score += 2;

    if (video.published_at) {
      const publishedDate = new Date(video.published_at);
      const ageInDays =
        (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (ageInDays < 30) score += 8;
      else if (ageInDays < 90) score += 4;
      else if (ageInDays < 180) score += 2;
      else if (ageInDays < 365) score += 1;
    }

    return score;
  }

  async isVideoAvailable(videoKey: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoKey}&format=json`,
        { method: 'GET', signal: AbortSignal.timeout(3000) },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  filterVideos(videos: any[], allowedRegions: string[]): any[] {
    return videos.filter(
      (v) =>
        v.site === 'YouTube' &&
        this.supportedVideoTypes.has(this.normalizeVideoType(v)) &&
        v.key &&
        v.key.length > 5 &&
        (allowedRegions.includes(v.iso_3166_1) || !v.iso_3166_1) &&
        v.name &&
        !/reaction/i.test(v.name) &&
        !/review/i.test(v.name) &&
        !DISQUALIFY_RE.test(v.name),
    );
  }

  async getAvailableVideos(videos: any[]): Promise<any[]> {
    const checkLimit = Math.min(videos.length, 5);
    const videosToCheck = videos.slice(0, checkLimit);

    const availabilityChecks = await Promise.allSettled(
      videosToCheck.map(async (v) => ({
        ...v,
        available: await this.isVideoAvailable(v.key),
      })),
    );

    return availabilityChecks
      .filter(
        (result): result is PromiseFulfilledResult<any> =>
          result.status === 'fulfilled' && result.value.available,
      )
      .map((result) => result.value);
  }

  sortByScore(videos: any[]): any[] {
    return videos
      .map((v) => ({ ...v, score: this.calculateVideoScore(v) }))
      .sort((a, b) => b.score - a.score);
  }
}
