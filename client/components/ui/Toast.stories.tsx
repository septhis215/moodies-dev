import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import Toast from './Toast';

const meta = {
  component: Toast,
  tags: ['ai-generated'],
  args: {
    message: 'Added Dune to your watchlist',
    onClose: fn(),
    variant: 'success',
    duration: 6000,
    createdAt: 0,
  },
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent(/success/i);
    await expect(canvas.getByRole('status')).toHaveTextContent(/added dune/i);
  },
};

export const Warning: Story = {
  args: {
    message: 'Sign in to keep building your list',
    variant: 'warning',
  },
};

export const WithPoster: Story = {
  args: {
    title: 'Saved',
    message: 'Mood recommendation added',
    posterUrl: '/placeholder-poster.svg',
    imageSize: { width: 30, height: 42 },
  },
};
