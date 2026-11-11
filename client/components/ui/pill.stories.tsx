import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Pill } from "./pill";

const meta = {
  component: Pill,
  args: { variant: "genre", children: "Drama / Thriller / Mystery" },
} satisfies Meta<typeof Pill>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Genre: Story = {};

export const AgeRating: Story = {
  args: { variant: "age-rating", children: "PG-13" },
};

export const Comparison: Story = {
  render: () => (
    <div className="flex max-w-sm flex-wrap items-start gap-2">
      <Pill variant="genre">Drama / Thriller / Mystery</Pill>
      <Pill variant="age-rating">PG-13</Pill>
    </div>
  ),
};
