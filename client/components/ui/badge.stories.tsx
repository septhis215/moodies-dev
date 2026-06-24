import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Badge } from './badge';

const meta = {
  component: Badge,
  tags: ['ai-generated'],
  args: {
    children: 'Featured',
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Series',
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Limited',
  },
};
