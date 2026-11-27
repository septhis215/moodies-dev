import { Injectable } from '@nestjs/common';
import { VideoFeedService } from '../feed/video-feed.service';

@Injectable()
export class UpcomingFeedService {
  constructor(private readonly videoFeed: VideoFeedService) {}

  getUpcomingFeeds(page = 1, limit = 35, viewerId?: string, salt = 0) {
    return this.videoFeed.getVideoFeed(salt, page, undefined, limit, viewerId, true);
  }
}
