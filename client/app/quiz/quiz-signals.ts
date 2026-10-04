export type QuizOption = {
  text: string;
  label: string;
  genres: string[];
  mood: string;
  mediaType?: "movie" | "tv" | "mixed";
  pace?: "slow" | "balanced" | "fast";
  commitment?: "short" | "standard" | "open";
};
export const QUIZ_SIGNALS: {
  category: string;
  label: string;
  question: string;
  hint: string;
  options: QuizOption[];
}[] = [
  {
    category: "feeling",
    label: "Feeling",
    question: "How do you want this watch to feel?",
    hint: "Choose the feeling you want to leave with.",
    options: [
      {
        text: "Comforted and lighter",
        label: "Cozy",
        genres: [],
        mood: "cozy",
      },
      {
        text: "On the edge of my seat",
        label: "Thrilling",
        genres: [],
        mood: "thrilling",
      },
      {
        text: "Curious, with something to untangle",
        label: "Curious",
        genres: [],
        mood: "mind-bending",
      },
      {
        text: "Moved by a human story",
        label: "Moved",
        genres: [],
        mood: "bittersweet",
      },
    ],
  },
  {
    category: "pace",
    label: "Pace",
    question: "What pace suits you tonight?",
    hint: "We use genre as a rough guide to pace, not a guarantee.",
    options: [
      {
        text: "Unhurried, with room for the characters",
        label: "Slow",
        genres: [],
        mood: "",
        pace: "slow",
      },
      {
        text: "A balance of quiet and momentum",
        label: "Balanced",
        genres: [],
        mood: "",
        pace: "balanced",
      },
      {
        text: "Keep things moving",
        label: "Fast",
        genres: [],
        mood: "",
        pace: "fast",
      },
    ],
  },
  {
    category: "genre",
    label: "Genre",
    question: "Which kind of story are you craving?",
    hint: "This is the strongest signal in your recommendations.",
    options: [
      {
        text: "Comedy and easy company",
        label: "Comedy",
        genres: ["comedy", "family"],
        mood: "",
      },
      {
        text: "Action and adventure",
        label: "Action",
        genres: ["action", "adventure"],
        mood: "",
      },
      {
        text: "Drama and relationships",
        label: "Drama",
        genres: ["drama", "romance"],
        mood: "",
      },
      {
        text: "Mystery and suspense",
        label: "Mystery",
        genres: ["mystery", "thriller"],
        mood: "",
      },
      {
        text: "Sci-fi and imagined worlds",
        label: "Sci-fi",
        genres: ["sci-fi", "fantasy"],
        mood: "",
      },
      {
        text: "Documentaries and real lives",
        label: "Real lives",
        genres: ["documentary"],
        mood: "",
      },
    ],
  },
  {
    category: "format",
    label: "Format",
    question: "A movie or a series?",
    hint: "Choose a format, or leave room for both.",
    options: [
      {
        text: "A movie: one complete story",
        label: "Movie",
        genres: [],
        mood: "",
        mediaType: "movie",
      },
      {
        text: "A series: a world to return to",
        label: "Series",
        genres: [],
        mood: "",
        mediaType: "tv",
      },
      {
        text: "Either is good",
        label: "Either",
        genres: [],
        mood: "",
        mediaType: "mixed",
      },
    ],
  },
  {
    category: "commitment",
    label: "Time",
    question: "How much time do you have per watch?",
    hint: "For series, this means episode length—not the whole season.",
    options: [
      {
        text: "A short watch: movie up to 100 min / episode up to 30 min",
        label: "Short",
        genres: [],
        mood: "",
        commitment: "short",
      },
      {
        text: "A regular sitting: movie up to 140 min / episode up to 60 min",
        label: "Regular",
        genres: [],
        mood: "",
        commitment: "standard",
      },
      {
        text: "No time limit tonight",
        label: "Open",
        genres: [],
        mood: "",
        commitment: "open",
      },
    ],
  },
];

const MASCOTS = new Set([
  "bittersweet",
  "chaos",
  "chill",
  "cozy",
  "dark",
  "documentary",
  "epic",
  "funny",
  "gritty",
  "happy",
  "horror",
  "inspirational",
  "mind-bending",
  "nostalgic",
  "romantic",
  "sad",
  "sci-fi",
  "serenity",
  "thrilling",
  "western",
  "whimsy",
]);
const ALIASES: Record<string, string> = {
  light: "happy",
  hopeful: "inspirational",
  engaged: "gritty",
  cinematic: "epic",
  patient: "serenity",
  balanced: "chill",
  sophisticated: "romantic",
  mysterious: "mind-bending",
  energetic: "thrilling",
  adventurous: "epic",
  emotional: "bittersweet",
  thoughtful: "mind-bending",
  relaxed: "cozy",
  relaxing: "chill",
  fun: "funny",
  lighthearted: "happy",
};
export function getMoodMascotSrc(value?: string | null) {
  const key = value?.trim().toLowerCase() ?? "";
  const resolved = ALIASES[key] ?? key;
  return MASCOTS.has(resolved)
    ? `/images/moods/${resolved}.png`
    : "/images/moodies-mascot.png";
}
