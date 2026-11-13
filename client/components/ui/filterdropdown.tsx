"use client";

import CustomSelect, { type CustomSelectProps } from "./custom-select";

export function FilterDropdown<T extends string>(props: CustomSelectProps<T>) {
  return <CustomSelect widthClass="w-36 max-w-full" {...props} />;
}
