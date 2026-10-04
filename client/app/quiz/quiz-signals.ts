export type QuizOption = {
  text: string;
  label: string;
  genres: string[];
  mood: string;
  mediaType?: "movie" | "tv" | "mixed";
  pace?: "slow" | "balanced" | "fast";
  commitment?: "short" | "standard" | "open";
};
export type QuizQuestion = {
  id: string;
  category: string;
  label: string;
  question: string;
  hint: string;
  options: QuizOption[];
};

export const QUIZ_CATEGORIES = [
  "feeling",
  "pace",
  "genre",
  "format",
  "commitment",
] as const;

export const QUIZ_QUESTION_POOL: QuizQuestion[] = [
  {
    id: "feeling-leave-with",
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
    id: "feeling-aftertaste",
    category: "feeling",
    label: "Feeling",
    question: "What should linger after the credits?",
    hint: "Pick the emotional aftertaste you want from this watch.",
    options: [
      { text: "A warm, easy glow", label: "Warm", genres: [], mood: "cozy" },
      { text: "A rush I need to talk about", label: "Rush", genres: [], mood: "thrilling" },
      { text: "Questions still turning in my head", label: "Questions", genres: [], mood: "mind-bending" },
      { text: "A tender ache in the best way", label: "Tender", genres: [], mood: "bittersweet" },
    ],
  },
  {
    id: "feeling-reset",
    category: "feeling",
    label: "Feeling",
    question: "What kind of reset do you need tonight?",
    hint: "There is no right answer—choose what would feel good now.",
    options: [
      { text: "Something gentle and reassuring", label: "Gentle", genres: [], mood: "cozy" },
      { text: "Something bold and energising", label: "Energy", genres: [], mood: "thrilling" },
      { text: "Something strange and absorbing", label: "Absorbing", genres: [], mood: "mind-bending" },
      { text: "Something hopeful and uplifting", label: "Hopeful", genres: [], mood: "inspirational" },
    ],
  },
  {
    id: "feeling-temperature",
    category: "feeling",
    label: "Feeling",
    question: "Choose tonight’s emotional temperature.",
    hint: "Think instinctively—what atmosphere are you reaching for?",
    options: [
      { text: "Soft and comforting", label: "Soft", genres: [], mood: "cozy" },
      { text: "Electric and intense", label: "Electric", genres: [], mood: "thrilling" },
      { text: "Layered and mysterious", label: "Layered", genres: [], mood: "mind-bending" },
      { text: "Emotional and reflective", label: "Reflective", genres: [], mood: "bittersweet" },
    ],
  },
  {
    id: "pace-tonight",
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
    id: "pace-rhythm",
    category: "pace",
    label: "Pace",
    question: "Pick a storytelling rhythm.",
    hint: "How quickly should the story reveal itself?",
    options: [
      { text: "Let it breathe and unfold", label: "Unhurried", genres: [], mood: "", pace: "slow" },
      { text: "Build steadily with a few surprises", label: "Steady", genres: [], mood: "", pace: "balanced" },
      { text: "Hook me early and do not let go", label: "Propulsive", genres: [], mood: "", pace: "fast" },
    ],
  },
  {
    id: "pace-attention",
    category: "pace",
    label: "Pace",
    question: "How much attention are you bringing?",
    hint: "Match the watch to your energy, not your ideal self.",
    options: [
      { text: "I can settle into a patient story", label: "Patient", genres: [], mood: "", pace: "slow" },
      { text: "I want a comfortable middle gear", label: "Middle gear", genres: [], mood: "", pace: "balanced" },
      { text: "I need constant momentum", label: "Momentum", genres: [], mood: "", pace: "fast" },
    ],
  },
  {
    id: "pace-opening",
    category: "pace",
    label: "Pace",
    question: "How should the opening ten minutes feel?",
    hint: "Choose the start that would pull you in tonight.",
    options: [
      { text: "Quietly intriguing", label: "Quiet", genres: [], mood: "", pace: "slow" },
      { text: "A clear hook with room to grow", label: "Clear hook", genres: [], mood: "", pace: "balanced" },
      { text: "Straight into the action", label: "Immediate", genres: [], mood: "", pace: "fast" },
    ],
  },
  {
    id: "genre-craving",
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
    id: "genre-doorway",
    category: "genre",
    label: "Story",
    question: "Which doorway should tonight’s story open?",
    hint: "Pick the world you most want to step into.",
    options: [
      { text: "A case full of secrets", label: "Secrets", genres: ["mystery", "crime"], mood: "" },
      { text: "A world beyond the possible", label: "Other worlds", genres: ["sci-fi", "fantasy"], mood: "" },
      { text: "A relationship worth rooting for", label: "Connection", genres: ["romance", "drama"], mood: "" },
      { text: "A journey with real stakes", label: "Journey", genres: ["adventure", "action"], mood: "" },
      { text: "A true story I did not know", label: "True story", genres: ["documentary"], mood: "" },
    ],
  },
  {
    id: "genre-conversation",
    category: "genre",
    label: "Story",
    question: "What would make you recommend it tomorrow?",
    hint: "Choose the quality that usually makes a story stick for you.",
    options: [
      { text: "It made me laugh out loud", label: "Funny", genres: ["comedy"], mood: "" },
      { text: "The suspense was impossible to shake", label: "Suspense", genres: ["thriller", "mystery"], mood: "" },
      { text: "The characters felt completely real", label: "Characters", genres: ["drama", "romance"], mood: "" },
      { text: "The world was spectacular", label: "World", genres: ["fantasy", "sci-fi", "adventure"], mood: "" },
      { text: "It changed how I saw something real", label: "Perspective", genres: ["documentary", "drama"], mood: "" },
    ],
  },
  {
    id: "genre-shelf",
    category: "genre",
    label: "Story",
    question: "Which shelf are you wandering toward?",
    hint: "Go with the section you would browse first.",
    options: [
      { text: "Big adventures and heroic odds", label: "Adventure", genres: ["action", "adventure"], mood: "" },
      { text: "Crimes, clues and uneasy truths", label: "Crime", genres: ["crime", "mystery", "thriller"], mood: "" },
      { text: "Love, family and complicated people", label: "People", genres: ["drama", "romance", "family"], mood: "" },
      { text: "Impossible futures and magical worlds", label: "Imagination", genres: ["sci-fi", "fantasy", "animation"], mood: "" },
      { text: "Fear, dread and the unknown", label: "Dark", genres: ["horror", "thriller"], mood: "" },
    ],
  },
  {
    id: "format-direct",
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
    id: "format-relationship",
    category: "format",
    label: "Format",
    question: "What kind of relationship do you want with the story?",
    hint: "A single evening, an ongoing ritual, or a surprise.",
    options: [
      { text: "Meet, feel everything, say goodbye", label: "One sitting", genres: [], mood: "", mediaType: "movie" },
      { text: "Get attached and keep coming back", label: "Keep returning", genres: [], mood: "", mediaType: "tv" },
      { text: "Whichever story fits me best", label: "Surprise me", genres: [], mood: "", mediaType: "mixed" },
    ],
  },
  {
    id: "format-plan",
    category: "format",
    label: "Format",
    question: "What sounds like the better plan?",
    hint: "Choose how you want tonight to fit into the rest of your week.",
    options: [
      { text: "Finish a complete story tonight", label: "Complete", genres: [], mood: "", mediaType: "movie" },
      { text: "Start or continue a series", label: "Continue", genres: [], mood: "", mediaType: "tv" },
      { text: "I am open to either", label: "Open", genres: [], mood: "", mediaType: "mixed" },
    ],
  },
  {
    id: "format-credits",
    category: "format",
    label: "Format",
    question: "When the credits roll, what should happen next?",
    hint: "Your answer helps us balance films and series.",
    options: [
      { text: "That was a satisfying whole", label: "Finished", genres: [], mood: "", mediaType: "movie" },
      { text: "Play the next episode", label: "Next episode", genres: [], mood: "", mediaType: "tv" },
      { text: "Let the recommendation decide", label: "Either", genres: [], mood: "", mediaType: "mixed" },
    ],
  },
  {
    id: "commitment-window",
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
  {
    id: "commitment-clock",
    category: "commitment",
    label: "Time",
    question: "What does the clock allow tonight?",
    hint: "For series, think about the length of one episode.",
    options: [
      { text: "Keep it compact", label: "Compact", genres: [], mood: "", commitment: "short" },
      { text: "A normal evening watch", label: "Evening", genres: [], mood: "", commitment: "standard" },
      { text: "Time is not the deciding factor", label: "Flexible", genres: [], mood: "", commitment: "open" },
    ],
  },
  {
    id: "commitment-energy",
    category: "commitment",
    label: "Time",
    question: "How much viewing energy do you have left?",
    hint: "We will keep runtime expectations in step with your night.",
    options: [
      { text: "Just enough for something brief", label: "Brief", genres: [], mood: "", commitment: "short" },
      { text: "Enough for the usual feature or episode", label: "Usual", genres: [], mood: "", commitment: "standard" },
      { text: "I can go wherever the story takes me", label: "All in", genres: [], mood: "", commitment: "open" },
    ],
  },
  {
    id: "commitment-boundary",
    category: "commitment",
    label: "Time",
    question: "Set a boundary for this watch.",
    hint: "A practical limit often leads to a better match.",
    options: [
      { text: "Around half an hour, or a short film", label: "Short", genres: [], mood: "", commitment: "short" },
      { text: "Up to a regular movie or hour-long episode", label: "Regular", genres: [], mood: "", commitment: "standard" },
      { text: "No runtime boundary", label: "No limit", genres: [], mood: "", commitment: "open" },
    ],
  },
];

function shuffle<T>(items: T[], random: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapWith]] = [shuffled[swapWith], shuffled[index]];
  }
  return shuffled;
}

export function createQuizSessionQuestions(random: () => number = Math.random) {
  const selected = QUIZ_CATEGORIES.map((category) => {
    const candidates = QUIZ_QUESTION_POOL.filter(
      (question) => question.category === category,
    );
    return candidates[Math.floor(random() * candidates.length)];
  });
  return shuffle(selected, random);
}

export function getQuizSessionQuestions(questionIds: string[]) {
  if (questionIds.length !== QUIZ_CATEGORIES.length) return null;
  const questions = questionIds.map((id) =>
    QUIZ_QUESTION_POOL.find((question) => question.id === id),
  );
  if (questions.some((question) => !question)) return null;
  const categories = new Set(questions.map((question) => question!.category));
  if (QUIZ_CATEGORIES.some((category) => !categories.has(category))) return null;
  return questions as QuizQuestion[];
}

// Stable fallback for server rendering and non-JavaScript test consumers.
export const QUIZ_SIGNALS = QUIZ_CATEGORIES.map(
  (category) =>
    QUIZ_QUESTION_POOL.find((question) => question.category === category)!,
);

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
