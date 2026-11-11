import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AudienceMood } from "./AudienceMood";

const meta = {
  component: AudienceMood,
  args: {
    moods: [
      { emoji: "/images/review-icons/loved-it.png", count: 8 },
      { emoji: "/images/review-icons/amazing.png", count: 5 },
      { emoji: "/images/review-icons/its-okay.png", count: 4 },
    ],
    totalVotes: 20,
  },
} satisfies Meta<typeof AudienceMood>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Distribution: Story = {};
export const AllMoods: Story = { args: {
  showAll: true,
  moods: ['loved-it', 'amazing', 'enjoyed-it', 'its-okay', 'meh', 'skip-it'].map((name, index) => ({ emoji: `/images/review-icons/${name}.png`, count: 6 - index })),
  totalVotes: 21,
} };
export const NoVotes: Story = { args: { moods: [], totalVotes: 0 } };
export const SingleMood: Story = {
  args: { moods: [{ emoji: "/images/review-icons/amazing.png", count: 8 }], totalVotes: 8 },
};
