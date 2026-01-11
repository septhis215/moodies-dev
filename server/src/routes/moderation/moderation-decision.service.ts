import { Injectable } from '@nestjs/common';
import { ReviewStatus } from '@prisma/client';

@Injectable()
export class ModerationDecisionService {
  decide(toxicity: { score: number; severe: boolean }) {
    console.log('⚖️ Moderation Decision:', toxicity);
    
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
    if (toxicity.score >= 0.4) {
      return {
        reject: false,
        status: ReviewStatus.FLAGGED,
        affectsRating: false,
        warnUser: true,
      };
    }

    // Medium toxicity (0.25-0.39) = flag but no warning
    if (toxicity.score >= 0.25) {
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