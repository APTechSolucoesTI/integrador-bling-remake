const PREFIX = "integrador:list-navigation:";

export function saveListNavigationState<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value));
}

export function consumeListNavigationState<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const storageKey = `${PREFIX}${key}`;
  const raw = window.sessionStorage.getItem(storageKey);
  window.sessionStorage.removeItem(storageKey);
  if (!raw) return null;

  const navigation = performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (navigation?.type === "reload") return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearListNavigationState(key: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${PREFIX}${key}`);
}
