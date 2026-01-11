import { Injectable } from '@nestjs/common';
import * as filter from 'leo-profanity';

@Injectable()
export class ProfanityFilterService {
  constructor() {
    filter.loadDictionary();
  }

  check(text: string): { hit: boolean; block: boolean } {
    const hasProfanity = filter.check(text);

    if (!hasProfanity) {
      return { hit: false, block: false };
    }

    // Use the clean method to count asterisks
    const cleaned = filter.clean(text, '*');
    const asteriskCount = (cleaned.match(/\*/g) || []).length;

    // Lower threshold: block if 12+ asterisks (roughly 2-3+ severe words)
    const shouldBlock = asteriskCount >= 12;

    console.log('🔍 Profanity Check:', {
      text: text.substring(0, 80),
      hasProfanity,
      cleaned: cleaned.substring(0, 80),
      asteriskCount,
      willBlock: shouldBlock,
    });

    return {
      hit: hasProfanity,
      block: shouldBlock,
    };
  }

  clean(text: string): string {
    return filter.clean(text);
  }
}
