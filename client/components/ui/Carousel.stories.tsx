import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, waitFor } from "storybook/test";
import type { All } from "@/types/all";
import { Carousel } from "./Carousel";

const items: All[] = Array.from({ length: 16 }, (_, index) => ({
  id: index + 1,
  title:
    index % 3 === 0
      ? "A longer movie title across several lines"
      : `Film ${index + 1}`,
  overview: "",
  recommendations: [],
  type: "movie",
}));

function TestCard({ show }: { show?: All }) {
  return (
    <article className="rounded-md border border-white/20 p-3">
      <div className="aspect-[2/3] bg-[var(--surface-2)]" />
      <p>{show?.title}</p>
    </article>
  );
}

const meta = {
  component: Carousel,
  args: { items, CardComponent: TestCard },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Carousel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Navigation: Story = {
  play: async ({ canvas }) => {
    const previous = canvas.getByRole("button", { name: "Previous cards" });
    const next = canvas.getByRole("button", { name: "Next cards" });
    const rail = document.getElementById(next.getAttribute("aria-controls")!)!;
    const initialTop = next.getBoundingClientRect().top;
    await waitFor(() => expect(next).toBeEnabled());
    await expect(previous).toBeDisabled();
    const style = getComputedStyle(rail);
    const first = rail.children[0].getBoundingClientRect();
    const stride = rail.children[1].getBoundingClientRect().left - first.left;
    const pageSize = Array.from(rail.children).filter((child) => {
      const card = child.getBoundingClientRect();
      return card.left >= first.left - 2 && card.right <= rail.getBoundingClientRect().right - (parseFloat(style.paddingRight) || 0) + 2;
    }).length;
    expect(pageSize).toBeGreaterThan(1);
    next.click();
    await waitFor(() => expect(Math.abs(rail.scrollLeft - pageSize * stride)).toBeLessThan(3), { timeout: 3000 });
    previous.click();
    await waitFor(() => expect(rail.scrollLeft).toBeLessThan(3), { timeout: 3000 });
    // Queue three clicks before the smooth scroll settles.
    next.click();
    next.click();
    next.click();
    const expectedTarget = Math.min(pageSize * 3 * stride, rail.scrollWidth - rail.clientWidth);
    await waitFor(
      () => {
        expect(Math.abs(rail.scrollLeft - expectedTarget)).toBeLessThan(3);
      },
      { timeout: 3000 },
    );
    expect(next.getBoundingClientRect().top).toBe(initialTop);
    await expect(previous).toBeEnabled();
    for (let i = 0; i < 20; i++) next.click();
    await waitFor(() => expect(next).toBeDisabled(), { timeout: 3000 });
    expect(
      Math.abs(rail.scrollLeft - (rail.scrollWidth - rail.clientWidth)),
    ).toBeLessThan(3);
    expect(next.getBoundingClientRect().top).toBe(initialTop);
    for (let i = 0; i < 20; i++) previous.click();
    await waitFor(() => expect(previous).toBeDisabled(), { timeout: 3000 });
    expect(rail.scrollLeft).toBeLessThan(3);
    expect(previous.getBoundingClientRect().top).toBe(initialTop);
  },
};

export const SmallScreen: Story = {
  decorators: [
    (Story) => (
      <div className="w-[280px] max-w-full">
        <Story />
      </div>
    ),
  ],
  ...Navigation,
};

export const NoOverflow: Story = {
  args: { items: items.slice(0, 1) },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: "Next cards" })).toBeDisabled(),
    );
    await expect(
      canvas.getByRole("button", { name: "Previous cards" }),
    ).toBeDisabled();
  },
};
