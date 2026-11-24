import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import Pagination from './pagination';

const meta = {
  component: Pagination,
  tags: ['ai-generated'],
  args: {
    currentPage: 4,
    totalPages: 12,
    totalResults: 238,
    onPageChange: fn(),
  },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MiddlePage: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /page 4, current/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};

export const FirstPage: Story = {
  args: {
    currentPage: 1,
    totalPages: 5,
  },
};

export const LastPage: Story = {
  args: {
    currentPage: 12,
    totalPages: 12,
  },
};

export const Pending: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Next page' })).toBeDisabled();
  },
};
