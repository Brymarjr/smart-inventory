// frontend/lib/auth.ts

export interface Tokens {
  access: string;
  refresh: string;
}

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

export function saveTokens(tokens: Tokens) {
  if (typeof window !== "undefined") {
    localStorage.setItem(ACCESS_KEY, tokens.access);
    localStorage.setItem(REFRESH_KEY, tokens.refresh);
  }
}

export function getAccessToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(ACCESS_KEY);
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(REFRESH_KEY);
  }
  return null;
}

export function clearTokens() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}
