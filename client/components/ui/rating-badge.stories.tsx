import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { RatingBadge } from './rating-badge';

const meta = {
  component: RatingBadge,
  tags: ['ai-generated'],
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
    await expect(canvas.getByText('New')).toBeVisible();
  },
};

export const MinimalLowRating: Story = {
  args: {
    rating: 4.2,
    variant: 'minimal',
    size: 'md',
  },
};

export const CssCheck: Story = {
  args: {
    rating: 0,
  },
  play: async ({ canvas }) => {
    const badge = canvas.getByText('New').closest('div');
    await expect(badge).not.toBeNull();
    await expect(getComputedStyle(badge as HTMLElement).backgroundColor).toBe('oklch(0.511 0.262 276.966)');
  },
};
