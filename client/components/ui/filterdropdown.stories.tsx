import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import { FilterDropdown } from './filterdropdown';

const OPTIONS = [
  { label: 'All', value: 'all' },
  { label: 'Movies', value: 'movies' },
  { label: 'Series', value: 'series' },
];

const meta = {
  component: FilterDropdown,
  tags: ['ai-generated'],
  args: {
    value: 'all',
    options: OPTIONS,
    onChange: fn(),
  },
} satisfies Meta<typeof FilterDropdown<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const OpensOptions: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /all/i }));
    await expect(canvas.getByRole('button', { name: /movies/i })).toBeInTheDocument();
  },
};

export const SeriesSelected: Story = {
  args: {
    value: 'series',
  },
};
