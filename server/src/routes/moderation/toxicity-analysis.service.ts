import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ToxicityAnalysisService {
  private readonly logger = new Logger(ToxicityAnalysisService.name);

  async analyze(text: string): Promise<{ score: number; severe: boolean }> {
    const lowerText = text.toLowerCase();

    const severePatterns = [
      /\b(kill\s*yourself|kys|unalive\s*yourself|go\s*die|neck\s*yourself|end\s*yourself|off\s*yourself)\b/i,
      /\b(shoot|stab|burn|hang|lynch|murder|execute|torture)\s+(you|yourself|them|him|her|themselves)\b/i,
      /\b(hope\s+you\s+(die|get\s+(raped|murdered|killed|cancer)))\b/i,
      /\b(jump\s+off|overdose|slit\s+your)\b/i,

      /\b(hate|despise|exterminate|eradicate|genocide|cleanse|purge)\s+(all\s+)?(blacks?|whites?|jews?|muslims?|asians?|hispanics?|latinos?|arabs?|indians?|natives?|immigrants?|refugees?|gays?|lesbians?|trans|women|men)\b/i,
      /\b(all\s+(women|men|gays|trans)\s+(are|should\s+be)\s+(raped|killed|enslaved))\b/i,

      /\b(n[i1!|]gg[a4e3]r|n[i1!|]gg[a4e3]|nigg4|n1gg3r)\b/i,
      /\b(spic|kike|chink|gook|wetback|beaner|towelhead|sandnigger|paki|coon)\b/i,

      /\b(f[a4@]gg?[o0]t|f[a4@]g|fagg0t|dyke)\b/i,
      /\b(trann(y|ie)|shemale)\b/i,

      /\b(r[e3]t[a4@]rd(ed|s)?)\b/i,

      /\b(rape|molest|sexually\s+assault)\s+(her|him|them|you)\b/i,

      /\b(i\s+will\s+(kill|murder|hurt|find|doxx|swat))\s+you\b/i,
    ];

    const hasSevere = severePatterns.some((pattern) => pattern.test(text));

    if (hasSevere) {
      this.logger.warn('Severe moderation violation detected');
      return { score: 0.95, severe: true };
    }

    const severeProfanity = [
      'fuck',
      'fucking',
      'fucked',
      'fucker',
      'fucks',
      'motherfucker',
      'fuk',
      'fuq',
      'fck',
      'fxck',
      'phuck',

      'shit',
      'shitty',
      'shitter',
      'bullshit',
      'sh1t',
      'shyt',

      'bitch',
      'bitches',
      'bitchy',
      'b1tch',
      'biatch',

      'asshole',
      'assholes',
      'bastard',
      'cunt',
      'twat',
      'cock',
      'dick',
      'dickhead',
      'pussy',
      'prick',

      'whore',
      'slut',
      'douchebag',
      'dipshit',

      'fuckboy',
      'thot',
      'dogshit',
      'dogwater',

      'fvck',
      'phuk',
      'shxt',
    ];

    let profanityCount = 0;
    const foundProfanity: string[] = [];

    severeProfanity.forEach((word) => {
      const regex = new RegExp(`\\b${word.replace(/\*/g, '\\*')}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        profanityCount += matches.length;
        foundProfanity.push(...matches);
      }
    });

    let score = 0;

    if (profanityCount >= 5) {
      score = 0.8; // Severe
    } else if (profanityCount >= 3) {
      score = 0.7; // High
    } else if (profanityCount === 2) {
      score = 0.5; // Medium
    } else if (profanityCount === 1) {
      score = 0.3; // Low
    }

    const personalAttackPatterns = [
      /\b(you'?re?|u\s+r)\s+(stupid|dumb|idiotic|moronic|pathetic|worthless|trash|garbage)\b/i,
      /\b(shut\s+(up|the\s+fuck\s+up|your\s+mouth))\b/i,
      /\b(nobody\s+cares|who\s+asked|didn'?t\s+ask)\b/i,

      /\b(director|actor|writer|cast)\s+(is|are)\s+(a\s+)?(stupid|dumb|idiot|moron|worthless|pathetic|piece\s+of\s+shit|garbage\s+human)\b/i,
      /\b(they|he|she)\s+should\s+(die|quit|stop\s+living|kill\s+themselves)\b/i,

      /\b(go\s+fuck\s+yourself|fuck\s+off|piss\s+off|screw\s+you)\b/i,
      /\b(you\s+should|u\s+should)\s+(die|quit|stop|delete)\b/i,
    ];

    const personalAttacks: string[] = [];
    const attackCount = personalAttackPatterns.filter((pattern) => {
      const match = text.match(pattern);
      if (match) {
        personalAttacks.push(match[0]);
        return true;
      }
      return false;
    }).length;

    // Only add score for PERSONAL attacks, not movie criticism
    if (attackCount > 0) {
      score += attackCount * 0.2;
    }

    score = Math.min(score, 0.9);

    this.logger.debug(
      `Toxicity analysis: profanityCount=${profanityCount}, attackCount=${attackCount}, score=${score.toFixed(2)}, severe=${score >= 0.8}`,
    );

    return {
      score,
      severe: score >= 0.8,
    };
  }
}
