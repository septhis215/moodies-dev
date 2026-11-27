import { Injectable, Logger } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';

@Injectable()
export class ModerationDecisionService {
  private readonly logger = new Logger(ModerationDecisionService.name);

  decide(toxicity: { score: number | string; severe: boolean }) {
    const score =
      typeof toxicity.score === 'string'
        ? parseFloat(toxicity.score)
        : toxicity.score;

    this.logger.debug(
      `Moderation decision input: score=${score.toFixed(2)}, severe=${toxicity.severe}`,
    );

    // Severe toxicity = reject immediately
    if (toxicity.severe) {
      return {
        reject: true,
        status: ReviewStatus.REJECTED,
        affectsRating: false,
        warnUser: true,
      };
    }

    // High toxicity (0.4-0.79) = flag and warn
    if (score >= 0.4) {
      return {
        reject: false,
        status: ReviewStatus.FLAGGED,
        affectsRating: false,
        warnUser: true,
      };
    }

    // Medium toxicity (0.25-0.39) = flag but no warning
    if (score >= 0.25) {
      return {
        reject: false,
        status: ReviewStatus.FLAGGED,
        affectsRating: false,
        warnUser: false,
      };
    }

    // Low toxicity = publish normally
    return {
      reject: false,
      status: ReviewStatus.PUBLISHED,
      affectsRating: true,
      warnUser: false,
    };
  }
}
