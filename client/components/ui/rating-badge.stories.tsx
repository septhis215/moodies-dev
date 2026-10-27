import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { RatingBadge } from "./rating-badge";

const meta = {
  component: RatingBadge,
  tags: ["ai-generated"],
  args: {
    rating: 8.4,
  },
} satisfies Meta<typeof RatingBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const HighRating: Story = {};

export const NewRelease: Story = {
  args: {
    rating: 0,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("New")).toBeVisible();
  },
};

export const MinimalLowRating: Story = {
  args: {
    rating: 4.2,
    variant: "minimal",
    size: "md",
  },
};

export const CssCheck: Story = {
  args: {
    rating: 0,
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByLabelText("New title, not yet rated"),
    ).toBeVisible();
  },
};

export const PosterRibbon: Story = {
  args: { rating: 0, placement: "poster" },
  decorators: [
    (Story) => (
      <div className="relative h-64 w-44 overflow-hidden rounded-xl border border-[var(--surface-border)] bg-[var(--surface-2)]">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const badge = canvas.getByLabelText("New title, not yet rated");
    await expect(badge).toBeVisible();
    const bounds = badge.getBoundingClientRect();
    const card = badge.parentElement!.getBoundingClientRect();
    await expect(Math.abs(bounds.right - card.right)).toBeLessThanOrEqual(1);
    await expect(bounds.top).toBeGreaterThan(card.top);
  },
};
