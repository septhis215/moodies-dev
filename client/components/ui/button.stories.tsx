import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { Button } from './button';

const meta = {
  component: Button,
  tags: ['ai-generated'],
  args: {
    children: 'Continue',
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Watch later',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Unavailable',
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /unavailable/i })).toBeDisabled();
  },
};
