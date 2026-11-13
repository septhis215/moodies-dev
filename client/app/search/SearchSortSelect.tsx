"use client";

import CustomSelect, { type CustomSelectProps } from "@/components/ui/custom-select";

export function SearchCustomSelect<T extends string>({
  variant = "toolbar",
  ...props
}: CustomSelectProps<T> & { variant?: "toolbar" | "field" }) {
  return <CustomSelect {...props} showLabel={variant === "field"} widthClass={variant === "field" ? "w-full" : "w-40 max-w-full"} />;
}

export const SearchSortSelect = SearchCustomSelect;
