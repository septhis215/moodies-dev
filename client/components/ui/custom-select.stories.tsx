import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import CustomSelect from './custom-select';

const OPTIONS = [
  { label: 'Popular', value: 'popular' },
  { label: 'Newest', value: 'newest' },
  { label: 'Top rated', value: 'top-rated' },
];

const meta = {
  component: CustomSelect,
  tags: ['ai-generated'],
  args: {
    value: 'popular',
    onChange: fn(),
    options: OPTIONS,
  },
} satisfies Meta<typeof CustomSelect<string>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const OpensMenu: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /popular/i }));
    await expect(canvas.getByRole('button', { name: /newest/i })).toBeInTheDocument();
  },
};

export const Compact: Story = {
  args: {
    value: 'top-rated',
    widthClass: 'w-36',
  },
};
