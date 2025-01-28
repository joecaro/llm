import { twMerge } from "tailwind-merge";
import { clsx } from "clsx";


export function cn(...classes: string[]) {
  return twMerge(clsx(classes));
}
