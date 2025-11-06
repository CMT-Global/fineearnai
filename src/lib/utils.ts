import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a unique correlation ID for tracking partner flow operations
 * Format: partner-{timestamp}-{random}
 * Example: partner-1699876543-a3b7
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `partner-${timestamp}-${random}`;
}
