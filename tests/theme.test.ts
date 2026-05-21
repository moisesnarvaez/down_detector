// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY, getPreferredTheme, applyTheme, toggleTheme } from '../public/theme.js';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  vi.unstubAllGlobals();
});

// ── getPreferredTheme ─────────────────────────────────────────────────────────

describe('getPreferredTheme', () => {
  it('returns stored "dark" from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    expect(getPreferredTheme()).toBe('dark');
  });

  it('returns stored "light" from localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    expect(getPreferredTheme()).toBe('light');
  });

  it('ignores invalid stored values and falls back to matchMedia', () => {
    localStorage.setItem(STORAGE_KEY, 'invalid');
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    expect(getPreferredTheme()).toBe('dark');
  });

  it('falls back to matchMedia dark when no localStorage entry', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    expect(getPreferredTheme()).toBe('dark');
  });

  it('falls back to matchMedia light when no localStorage entry', () => {
    vi.stubGlobal('matchMedia', (_query: string) => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    expect(getPreferredTheme()).toBe('light');
  });

  it('returns "light" when matchMedia is unavailable and no localStorage entry', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(getPreferredTheme()).toBe('light');
  });

  it('localStorage takes precedence over matchMedia', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
    expect(getPreferredTheme()).toBe('light');
  });
});

// ── applyTheme ────────────────────────────────────────────────────────────────

describe('applyTheme', () => {
  it('adds "dark" class to <html> when theme is dark', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('removes "dark" class from <html> when theme is light', () => {
    document.documentElement.classList.add('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists "dark" to localStorage', () => {
    applyTheme('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('persists "light" to localStorage', () => {
    applyTheme('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('overwrites a previous stored value', () => {
    applyTheme('dark');
    applyTheme('light');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

// ── toggleTheme ───────────────────────────────────────────────────────────────

describe('toggleTheme', () => {
  it('toggles from light to dark', () => {
    const result = toggleTheme();
    expect(result).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles from dark to light', () => {
    document.documentElement.classList.add('dark');
    const result = toggleTheme();
    expect(result).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists each toggle to localStorage', () => {
    toggleTheme(); // → dark
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
    toggleTheme(); // → light
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
  });

  it('returns the new theme on each call', () => {
    expect(toggleTheme()).toBe('dark');
    expect(toggleTheme()).toBe('light');
    expect(toggleTheme()).toBe('dark');
  });
});
