// prisma/seed/moods.seed.ts
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

// TMDB Genre IDs reference:
// ── MOVIE ──────────────────────────────────────────────────────────
//  12 Adventure  | 14 Fantasy     | 16 Animation   | 18 Drama
//  27 Horror     | 28 Action      | 35 Comedy      | 36 History
//  37 Western    | 53 Thriller    | 80 Crime        | 99 Documentary
// 878 Sci-Fi     | 9648 Mystery   | 10402 Music     | 10749 Romance
// 10751 Family
// ── TV ─────────────────────────────────────────────────────────────
//  16 Animation  | 18 Drama       | 35 Comedy       | 53 Thriller
//  80 Crime      | 99 Documentary | 9648 Mystery    | 10751 Family
// 10759 Action & Adventure        | 10762 Kids
// 10764 Reality  | 10765 Sci-Fi & Fantasy           | 10766 Soap

interface MoodSeed {
  name: string;
  color: string;
  icon: string;
  description: string;
  keywords: string[];
  movieGenres: number[];
  tvGenres: number[];
  valence: number;   // -1 (negative) → +1 (positive)
  arousal: number;   // -1 (low energy) → +1 (high energy)
  isActive: boolean;
}

const moods: MoodSeed[] = [
  // ── Positive / High energy ──────────────────────────────────────
  {
    name: 'Happy',
    color: '#FFD700',
    icon: 'smile',
    description: 'Lighthearted and uplifting stories that boost your mood',
    keywords: ['comedy', 'cheerful', 'uplifting', 'positive vibes'],
    movieGenres: [35, 16, 10751, 12, 10402],
    tvGenres: [35, 16, 10751, 10762, 10759],
    valence: 0.8,
    arousal: 0.5,
    isActive: true,
  },
  {
    name: 'Funny',
    color: '#FFB6C1',
    icon: 'laugh',
    description: 'Comedies full of laughs, parodies, and satire',
    keywords: ['hilarious', 'parody', 'satire', 'funny'],
    movieGenres: [35, 10751, 16],
    tvGenres: [35, 16, 10751],
    valence: 0.9,
    arousal: 0.6,
    isActive: true,
  },
  {
    name: 'Cozy',
    color: '#FFDEAD',
    icon: 'mug-hot',
    description: 'Comforting, wholesome stories that warm the heart',
    keywords: ['gentle', 'comfort', 'family', 'heartwarming'],
    movieGenres: [10751, 16, 35, 10749, 18],
    tvGenres: [35, 10751, 16, 18],
    valence: 0.7,
    arousal: 0.2,
    isActive: true,
  },
  {
    name: 'Whimsy',
    color: '#BA55D3',
    icon: 'magic',
    description: 'Playful, imaginative, and joyous flights of fancy',
    keywords: ['whimsical', 'fantasy', 'imaginative', 'dreamy'],
    movieGenres: [14, 16, 10751, 35, 10402],
    tvGenres: [10765, 16, 10751, 35],
    valence: 0.7,
    arousal: 0.5,
    isActive: true,
  },

  // ── Positive / Low energy ───────────────────────────────────────
  {
    name: 'Romantic',
    color: '#FF69B4',
    icon: 'heart',
    description: 'Stories of love, connection, and heartfelt emotions',
    keywords: ['romance', 'love story', 'relationships', 'emotional'],
    movieGenres: [10749, 18, 35, 14],
    tvGenres: [18, 10766, 35],
    valence: 0.7,
    arousal: 0.3,
    isActive: true,
  },
  {
    name: 'Serenity',
    color: '#20B2AA',
    icon: 'wind',
    description: 'Gentle, calm, and soothing narratives',
    keywords: ['calm', 'peaceful', 'relaxing', 'soothing'],
    movieGenres: [18, 36, 99, 10402, 10751],
    tvGenres: [18, 99, 35],
    valence: 0.3,
    arousal: -0.3,
    isActive: true,
  },
  {
    name: 'Chill',
    color: '#87CEEB',
    icon: 'cloud',
    description: 'Relaxed, slow-paced stories perfect for unwinding',
    keywords: ['relaxing', 'peaceful', 'soothing', 'calm'],
    movieGenres: [18, 99, 10402, 14, 10751],
    tvGenres: [18, 99, 35],
    valence: 0.3,
    arousal: -0.5,
    isActive: true,
  },

  // ── Inspirational ───────────────────────────────────────────────
  {
    name: 'Inspirational',
    color: '#32CD32',
    icon: 'star',
    description: 'True stories and dramas that lift your spirit',
    keywords: ['motivating', 'emotional', 'uplifting', 'true story'],
    movieGenres: [18, 36, 99, 12, 10402],
    tvGenres: [18, 99, 10759],
    valence: 0.9,
    arousal: 0.6,
    isActive: true,
  },

  // ── Nostalgic / Reflective ──────────────────────────────────────
  {
    name: 'Nostalgic',
    color: '#FFB347',
    icon: 'clock',
    description: 'Classic tales and retro vibes that take you back',
    keywords: ['retro', 'classic', 'childhood', 'old school'],
    movieGenres: [35, 16, 10751, 10402, 36],
    tvGenres: [16, 35, 10751, 18],
    valence: 0.6,
    arousal: 0.4,
    isActive: true,
  },
  {
    name: 'Bittersweet',
    color: '#708090',
    icon: 'cloud-rain',
    description: 'A blend of joy and sorrow — emotionally rich stories',
    keywords: ['poignant', 'emotional', 'sad', 'reflective'],
    movieGenres: [18, 10749, 99, 36, 35],
    tvGenres: [18, 10766, 10765, 16],
    valence: -0.2,
    arousal: 0.2,
    isActive: true,
  },
  {
    name: 'Sad',
    color: '#4682B4',
    icon: 'cloud-rain',
    description: 'Emotional and moving stories that tug at your heart',
    keywords: ['tragic', 'emotional', 'tearjerker', 'loss'],
    movieGenres: [18, 10749, 99, 36],
    tvGenres: [18, 10766, 99],
    valence: -0.5,
    arousal: 0.3,
    isActive: true,
  },

  // ── High energy / Action ────────────────────────────────────────
  {
    name: 'Thrilling',
    color: '#FF6B35',
    icon: 'zap',
    description: 'High-stakes action and suspense-filled adventures',
    keywords: ['action', 'adventure', 'suspense', 'intense', 'adrenaline'],
    movieGenres: [28, 53, 12, 80, 878],
    tvGenres: [10759, 80, 9648, 10765],
    valence: 0.6,
    arousal: 0.9,
    isActive: true,
  },
  {
    name: 'Epic',
    color: '#8A2BE2',
    icon: 'crown',
    description: 'Legendary adventures set in vast, fantastical worlds',
    keywords: ['fantasy', 'heroic', 'legendary', 'mythical'],
    movieGenres: [14, 12, 28, 878, 36],
    tvGenres: [10765, 10759, 10751],
    valence: 0.5,
    arousal: 0.8,
    isActive: true,
  },
  {
    name: 'Chaos',
    color: '#FF4500',
    icon: 'fire',
    description: 'Wild, unpredictable, fast-paced stories',
    keywords: ['chaotic', 'madness', 'unpredictable', 'intense'],
    movieGenres: [28, 53, 80, 878, 27],
    tvGenres: [10759, 80, 9648, 10765],
    valence: 0.2,
    arousal: 0.9,
    isActive: true,
  },

  // ── Dark / Suspenseful ──────────────────────────────────────────
  {
    name: 'Horror',
    color: '#8B0000',
    icon: 'skull',
    description: 'Creepy tales and spine-chilling frights',
    keywords: ['scary', 'terror', 'supernatural', 'suspense'],
    movieGenres: [27, 9648, 53, 14],
    tvGenres: [9648, 10765, 80],
    valence: -0.3,
    arousal: 0.8,
    isActive: true,
  },
  {
    name: 'Dark',
    color: '#2F4F4F',
    icon: 'moon',
    description: 'Mysterious and unsettling narratives that linger',
    keywords: ['noir', 'psychological', 'mystery', 'gritty'],
    movieGenres: [9648, 53, 80, 878, 18],
    tvGenres: [9648, 80, 10765, 18],
    valence: -0.2,
    arousal: 0.4,
    isActive: true,
  },
  {
    name: 'Gritty',
    color: '#696969',
    icon: 'shield',
    description: 'Raw, unpolished stories of crime and survival',
    keywords: ['crime', 'urban', 'raw', 'dark'],
    movieGenres: [80, 18, 53, 36, 99],
    tvGenres: [80, 18, 9648],
    valence: -0.3,
    arousal: 0.6,
    isActive: true,
  },
  {
    name: 'Mind-Bending',
    color: '#4B0082',
    icon: 'brain',
    description: 'Twists and narratives that challenge your perception',
    keywords: ['mystery', 'psychological', 'sci-fi', 'surreal'],
    movieGenres: [9648, 878, 53, 18, 14],
    tvGenres: [9648, 10765, 80],
    valence: 0.2,
    arousal: 0.7,
    isActive: true,
  },

  // ── Genre-specific ──────────────────────────────────────────────
  {
    name: 'Sci-Fi',
    color: '#00CED1',
    icon: 'rocket',
    description: 'Exploring the future, space, and new worlds',
    keywords: ['sci-fi', 'space', 'technology', 'future'],
    movieGenres: [878, 12, 14, 28, 53],
    tvGenres: [10765, 10759, 18],
    valence: 0.5,
    arousal: 0.7,
    isActive: true,
  },
  {
    name: 'Western',
    color: '#CD853F',
    icon: 'cowboy',
    description: 'Cowboys, outlaws, and life on the frontier',
    keywords: ['western', 'frontier', 'gunslinger', 'duel'],
    movieGenres: [37, 28, 12, 80, 18],
    tvGenres: [10759, 80, 18],
    valence: 0.4,
    arousal: 0.6,
    isActive: true,
  },
  {
    name: 'Documentary',
    color: '#708090',
    icon: 'book',
    description: 'Fascinating insights into real-world stories and events',
    keywords: ['true', 'factual', 'informative', 'educational'],
    movieGenres: [99, 36, 18, 10402],
    tvGenres: [99, 18, 10764],
    valence: 0.4,
    arousal: 0.2,
    isActive: true,
  },
];

export async function seedMoods(prisma: PrismaClient): Promise<void> {
  console.log(`Seeding ${moods.length} moods…`);

  for (const moodData of moods) {
    // Merge movie and TV genres, deduplicated
    const tmdbGenres = Array.from(
      new Set([...moodData.movieGenres, ...moodData.tvGenres]),
    );

    const payload = {
      name: moodData.name,
      color: moodData.color,
      icon: moodData.icon,
      description: moodData.description,
      keywords: moodData.keywords,
      tmdbGenres,
      valence: new Prisma.Decimal(moodData.valence),
      arousal: new Prisma.Decimal(moodData.arousal),
      isActive: moodData.isActive,
    };

    await prisma.mood.upsert({
      where: { name: moodData.name },
      // update: {} silently ignores every change — always apply the full payload
      update: payload,
      create: payload,
    });

    console.log(`  ✓ ${moodData.name}`);
  }

  console.log('Mood seeding complete.');
}
