// prisma/seed/moods.seed.ts
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

export async function seedMoods(prisma: PrismaClient) {
  // TMDB Genre IDs mapping reference:
  // Comedy: 35, Action: 28, Horror: 27, Romance: 10749, Drama: 18, Thriller: 53
  // Animation: 16, Family: 10751, Adventure: 12, Mystery: 9648, Crime: 80
  // Fantasy: 14, Science Fiction: 878, Documentary: 99, History: 36, Music: 10402

  const moods = [
    {
      name: 'Radiance',
      color: '#FFD700',
      icon: 'sun',
      description: 'Bright, joyful, and uplifting stories',
      keywords: ['joy', 'uplifting', 'cheerful', 'positive'],
      movieGenres: [35, 16, 10751, 12],    // Comedy, Animation, Family, Adventure :contentReference[oaicite:0]{index=0}
      tvGenres: [35, 16, 10751, 10762],     // Comedy, Animation, Family, Kids :contentReference[oaicite:1]{index=1}
      valence: 0.9,
      arousal: 0.6,
      isActive: true,
    }, {
      name: 'Eclipse',
      color: '#2F4F4F',
      icon: 'moon',
      description: 'Dark, mysterious stories with intrigue',
      keywords: ['mystery', 'noir', 'psychological', 'suspense'],
      movieGenres: [9648, 53, 80, 878],      // Mystery, Thriller, Crime, Sci-Fi :contentReference[oaicite:4]{index=4}
      tvGenres: [9648, 80, 10765],            // Mystery, Crime, Sci-Fi & Fantasy :contentReference[oaicite:5]{index=5}
      valence: -0.1,
      arousal: 0.5,
      isActive: true,
    },
    {
      name: 'Serenity',
      color: '#20B2AA',
      icon: 'wind',
      description: 'Gentle, calm, and soothing narratives',
      keywords: ['calm', 'peaceful', 'relaxing', 'soothing'],
      movieGenres: [18, 36, 99],             // Drama, History, Documentary :contentReference[oaicite:6]{index=6}
      tvGenres: [18, 99],                     // Drama, Documentary :contentReference[oaicite:7]{index=7}
      valence: 0.3,
      arousal: -0.3,
      isActive: true,
    },
    {
      name: 'Memoria',
      color: '#FFB347',
      icon: 'clock',
      description: 'Nostalgic, reflective, reminds you of the past',
      keywords: ['nostalgic', 'retro', 'memory', 'yearning'],
      movieGenres: [35, 16, 10751, 10402],     // Comedy, Animation, Family, Music :contentReference[oaicite:10]{index=10}
      tvGenres: [16, 35, 10751],                // Animation, Comedy, Family :contentReference[oaicite:11]{index=11}
      valence: 0.5,
      arousal: 0.3,
      isActive: true,
    },
    {
      name: 'Bittersweet',
      color: '#708090',
      icon: 'cloud',
      description: 'A blend of joy and sorrow, emotionally rich',
      keywords: ['poignant', 'emotional', 'sad', 'reflective'],
      movieGenres: [18, 10749],                // Drama, Romance :contentReference[oaicite:12]{index=12}
      tvGenres: [18, 10766],                   // Drama, Soap :contentReference[oaicite:13]{index=13}
      valence: -0.2,
      arousal: 0.2,
      isActive: true,
    },
    {
      name: 'Seraph',
      color: '#32CD32',
      icon: 'star',
      description: 'Uplifting, motivational, stories of overcoming',
      keywords: ['inspiring', 'hopeful', 'resilient', 'empowering'],
      movieGenres: [18, 36, 99],               // Drama, History, Documentary :contentReference[oaicite:14]{index=14}
      tvGenres: [18, 99],                      // Drama, Documentary :contentReference[oaicite:15]{index=15}
      valence: 0.8,
      arousal: 0.6,
      isActive: true,
    },
    {
      name: 'Whimsy',
      color: '#BA55D3',
      icon: 'magic',
      description: 'Playful, imaginative, and joyous flights of fancy',
      keywords: ['whimsical', 'fantasy', 'imaginative', 'dreamy'],
      movieGenres: [14, 16, 10751],             // Fantasy, Animation, Family :contentReference[oaicite:16]{index=16}
      tvGenres: [10765, 16, 10751],             // Sci-Fi & Fantasy, Animation, Family :contentReference[oaicite:17]{index=17}
      valence: 0.7,
      arousal: 0.5,
      isActive: true,
    },
    {
      name: 'Chaos',
      color: '#FF4500',
      icon: 'fire',
      description: 'Wild, unpredictable, fast-paced stories',
      keywords: ['chaotic', 'madness', 'unpredictable', 'intense'],
      movieGenres: [28, 53, 80],                // Action, Thriller, Crime :contentReference[oaicite:18]{index=18}
      tvGenres: [10759, 53, 80],                // Action & Adventure, Thriller, Crime (if TV supports) :contentReference[oaicite:19]{index=19}
      valence: 0.2,
      arousal: 0.9,
      isActive: true,
    }, {
      name: 'Happy',
      color: '#FFD700',
      icon: 'smile',
      description: 'Lighthearted and uplifting stories that boost your mood',
      keywords: ['comedy', 'cheerful', 'uplifting', 'positive vibes'],
      movieGenres: [35, 16, 10751, 12], // Comedy, Animation, Family, Adventure
      tvGenres: [35, 16, 10751, 10762], // Comedy, Animation, Family, Kids
      valence: 0.8,
      arousal: 0.5,
      isActive: true,
    },
    {
      name: 'Thrilling',
      color: '#FF6B35',
      icon: 'zap',
      description: 'High-stakes action and suspense-filled adventures',
      keywords: ['action', 'adventure', 'suspense', 'intense', 'adrenaline'],
      movieGenres: [28, 53, 12, 80], // Action, Thriller, Adventure, Crime
      tvGenres: [10759, 80, 9648], // Action & Adventure, Crime, Mystery
      valence: 0.6,
      arousal: 0.9,
      isActive: true,
    },
    {
      name: 'Horror',
      color: '#8B0000',
      icon: 'skull',
      description: 'Creepy tales and spine-chilling frights',
      keywords: ['scary', 'terror', 'supernatural', 'suspense'],
      movieGenres: [27, 9648], // Horror, Mystery
      tvGenres: [9648], // Mystery (TV has no direct "Horror" genre)
      valence: -0.3,
      arousal: 0.8,
      isActive: true,
    },
    {
      name: 'Romantic',
      color: '#FF69B4',
      icon: 'heart',
      description: 'Stories of love, connection, and heartfelt emotions',
      keywords: ['romance', 'love story', 'relationships', 'emotional'],
      movieGenres: [10749, 18], // Romance, Drama
      tvGenres: [18, 10766], // Drama, Soap
      valence: 0.7,
      arousal: 0.3,
      isActive: true,
    },
    {
      name: 'Chill',
      color: '#20B2AA',
      icon: 'wind',
      description: 'Relaxed, slow-paced stories perfect for unwinding',
      keywords: ['relaxing', 'peaceful', 'soothing', 'calm'],
      movieGenres: [18, 36, 99], // Drama, History, Documentary
      tvGenres: [18, 99], // Drama, Documentary
      valence: 0.3,
      arousal: -0.5,
      isActive: true,
    },
    {
      name: 'Dark',
      color: '#2F4F4F',
      icon: 'moon',
      description: 'Mysterious and unsettling narratives that linger',
      keywords: ['noir', 'psychological', 'mystery', 'gritty'],
      movieGenres: [9648, 53, 80, 878], // Mystery, Thriller, Crime, Sci-Fi
      tvGenres: [9648, 80, 10765], // Mystery, Crime, Sci-Fi & Fantasy
      valence: -0.2,
      arousal: 0.4,
      isActive: true,
    },
    {
      name: 'Epic',
      color: '#8A2BE2',
      icon: 'crown',
      description: 'Legendary adventures set in vast, fantastical worlds',
      keywords: ['fantasy', 'heroic', 'legendary', 'mythical'],
      movieGenres: [14, 12, 28, 878], // Fantasy, Adventure, Action, Sci-Fi
      tvGenres: [10765, 10759], // Sci-Fi & Fantasy, Action & Adventure
      valence: 0.5,
      arousal: 0.8,
      isActive: true,
    },
    {
      name: 'Inspirational',
      color: '#32CD32',
      icon: 'star',
      description: 'True stories and dramas that lift your spirit',
      keywords: ['motivating', 'emotional', 'uplifting', 'true story'],
      movieGenres: [18, 36, 99], // Drama, History, Documentary
      tvGenres: [18, 99], // Drama, Documentary
      valence: 0.9,
      arousal: 0.6,
      isActive: true,
    },
    {
      name: 'Nostalgic',
      color: '#FFB347',
      icon: 'clock',
      description: 'Classic tales and retro vibes that take you back',
      keywords: ['retro', 'classic', 'childhood', 'old school'],
      movieGenres: [35, 16, 10751, 10402], // Comedy, Animation, Family, Music
      tvGenres: [16, 35, 10751], // Animation, Comedy, Family
      valence: 0.6,
      arousal: 0.4,
      isActive: true,
    },
    {
      name: 'Sad',
      color: '#4682B4',
      icon: 'cloud-rain',
      description: 'Emotional and moving stories that tug at your heart',
      keywords: ['tragic', 'emotional', 'tearjerker', 'loss'],
      movieGenres: [18, 10749], // Drama, Romance
      tvGenres: [18, 10766], // Drama, Soap
      valence: -0.5,
      arousal: 0.3,
      isActive: true,
    },
    {
      name: 'Funny',
      color: '#FFB6C1',
      icon: 'laugh',
      description: 'Comedies full of laughs, parodies, and satire',
      keywords: ['hilarious', 'parody', 'satire', 'funny'],
      movieGenres: [35, 10751, 16], // Comedy, Family, Animation
      tvGenres: [35, 16, 10751], // Comedy, Animation, Family
      valence: 0.9,
      arousal: 0.6,
      isActive: true,
    },
    {
      name: 'Documentary',
      color: '#708090',
      icon: 'book',
      description: 'Fascinating insights into real-world stories and events',
      keywords: ['true', 'factual', 'informative', 'educational'],
      movieGenres: [99, 36], // Documentary, History
      tvGenres: [99], // Documentary
      valence: 0.4,
      arousal: 0.2,
      isActive: true,
    },
    {
      name: 'Mind-Bending',
      color: '#4B0082',
      icon: 'brain',
      description: 'Twists and narratives that challenge your perception',
      keywords: ['mystery', 'psychological', 'sci-fi', 'surreal'],
      movieGenres: [9648, 878, 53], // Mystery, Sci-Fi, Thriller
      tvGenres: [9648, 10765], // Mystery, Sci-Fi & Fantasy
      valence: 0.2,
      arousal: 0.7,
      isActive: true,
    },
    {
      name: 'Gritty',
      color: '#696969',
      icon: 'shield',
      description: 'Raw, unpolished stories of crime and survival',
      keywords: ['crime', 'urban', 'raw', 'dark'],
      movieGenres: [80, 18, 53], // Crime, Drama, Thriller
      tvGenres: [80, 18], // Crime, Drama
      valence: -0.3,
      arousal: 0.6,
      isActive: true,
    },
    {
      name: 'Sci-Fi',
      color: '#00CED1',
      icon: 'rocket',
      description: 'Exploring the future, space, and new worlds',
      keywords: ['sci-fi', 'space', 'technology', 'future'],
      movieGenres: [878, 12, 14], // Sci-Fi, Adventure, Fantasy
      tvGenres: [10765, 10759], // Sci-Fi & Fantasy, Action & Adventure
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
      movieGenres: [37, 28, 12], // Western, Action, Adventure
      tvGenres: [37], // Western
      valence: 0.4,
      arousal: 0.6,
      isActive: true,
    },
    {
      name: 'Cozy',
      color: '#FFDEAD',
      icon: 'mug-hot',
      description: 'Comforting, wholesome stories that warm the heart',
      keywords: ['gentle', 'comfort', 'family', 'heartwarming'],
      movieGenres: [35, 10751, 16], // Comedy, Family, Animation
      tvGenres: [35, 10751, 16], // Comedy, Family, Animation
      valence: 0.7,
      arousal: 0.2,
      isActive: true,
    }, {
      name: 'Joyful',
      color: '#FFD700',
      icon: 'smile',
      description: 'Feel-good, uplifting stories that bring pure happiness',
      keywords: ['happy', 'comedy', 'cheerful', 'positive'],
      movieGenres: [35, 16, 10751, 12], // Comedy, Animation, Family, Adventure
      tvGenres: [35, 16, 10751, 10762], // Comedy, Animation, Family, Kids
      valence: 0.9,
      arousal: 0.6,
      isActive: true,
    },
    {
      name: 'Adrenaline',
      color: '#FF4500',
      icon: 'zap',
      description: 'Explosive action and non-stop excitement',
      keywords: ['action', 'thriller', 'intense', 'fast-paced'],
      movieGenres: [28, 53, 12, 80], // Action, Thriller, Adventure, Crime
      tvGenres: [10759, 80, 9648], // Action & Adventure, Crime, Mystery
      valence: 0.5,
      arousal: 1.0,
      isActive: true,
    },
    {
      name: 'Fear',
      color: '#8B0000',
      icon: 'skull',
      description: 'Terrifying and eerie stories that send chills',
      keywords: ['scary', 'horror', 'supernatural', 'suspense'],
      movieGenres: [27, 9648], // Horror, Mystery
      tvGenres: [9648], // Mystery (TV lacks direct Horror)
      valence: -0.4,
      arousal: 0.9,
      isActive: true,
    }
  ];


  for (const moodData of moods) {
    const tmdbGenres = Array.from(new Set([...(moodData.movieGenres || []), ...(moodData.tvGenres || [])]));

    await prisma.mood.upsert({
      where: { name: moodData.name },
      update: {}, // keep unchanged if it already exists
      create: {
        name: moodData.name,
        color: moodData.color,
        icon: moodData.icon,
        description: moodData.description,
        keywords: moodData.keywords,
        tmdbGenres,
        valence: new Prisma.Decimal(moodData.valence),
        arousal: new Prisma.Decimal(moodData.arousal),
        isActive: moodData.isActive,
      },
    });
    console.log(`Seeded mood: ${moodData.name}`);
  }
}