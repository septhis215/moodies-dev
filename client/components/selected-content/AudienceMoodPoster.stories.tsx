import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AudienceMoodPoster } from "./AudienceMoodPoster";

const meta = {
  component: AudienceMoodPoster,
  args: {
    poster: "/images/ironmanposter.jpeg",
    title: "Iron Man",
    moods: [
      { emoji: "/images/review-icons/loved-it.png", count: 8 },
      { emoji: "/images/review-icons/amazing.png", count: 5 },
      { emoji: "/images/review-icons/enjoyed-it.png", count: 3 },
      { emoji: "/images/review-icons/its-okay.png", count: 4 },
    ],
  },
  decorators: [(Story) => <div className="w-72 p-8 pb-36"><Story /></div>],
} satisfies Meta<typeof AudienceMoodPoster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithAudienceMood: Story = {};
export const NoVotes: Story = { args: { moods: [] } };
export const Compact: Story = {
  decorators: [(Story) => <div className="w-44"><Story /></div>],
};
