import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getDisplayUsername(username: string) {
  if (!username) return '';
  return username.includes('__') ? username.split('__')[1] : username;
}