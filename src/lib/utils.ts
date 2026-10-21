import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Supabase errors are not always `Error` instances, so `error instanceof Error`
 * silently loses the real message. This pulls out a readable message from anything.
 */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return typeof error === "string" && error ? error : fallback;
}
