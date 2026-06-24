import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import ActionButtons from './actionButtons';

const meta = {
  component: ActionButtons,
  tags: ['ai-generated'],
  args: {
    isPlaying: true,
    liked: false,
    saved: false,
    muted: false,
    panelOpen: false,
    togglePlayPause: fn(),
    onLike: fn(),
    setSaved: fn(),
    toggleMute: fn(),
    onInfo: fn(),
  },
} satisfies Meta<typeof ActionButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playing: Story = {};

export const SavedAndLiked: Story = {
  args: {
    liked: true,
    saved: true,
    muted: true,
    panelOpen: true,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /like/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: /save/i })).toHaveAttribute('aria-pressed', 'true');
  },
};

export const PausedMuted: Story = {
  args: {
    isPlaying: false,
    muted: true,
  },
};
