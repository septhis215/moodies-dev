import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, waitFor, within } from 'storybook/test';
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
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /all/i }));
    const movies = await within(canvasElement.ownerDocument.body).findByRole('option', { name: /movies/i });
    await waitFor(() => expect(movies).toBeVisible());
    await userEvent.click(movies);
    await expect(args.onChange).toHaveBeenCalledWith('movies');
  },
};

export const SeriesSelected: Story = {
  args: {
    value: 'series',
  },
};
