import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// O cn() que os componentes do React Bits importam de "@/lib/utils".
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
