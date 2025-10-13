export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "effect-box-theme";

export class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme = "system";
  private listeners: Set<(theme: Theme) => void> = new Set();

  private constructor() {
    this.initializeTheme();
    this.setupSystemThemeListener();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  private initializeTheme(): void {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      this.currentTheme = stored;
    }
    this.applyTheme();
  }

  private setupSystemThemeListener(): void {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", () => {
      if (this.currentTheme === "system") {
        this.applyTheme();
      }
    });
  }

  private applyTheme(): void {
    const isDark = this.getEffectiveTheme() === "dark";
    const root = document.documentElement;

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    this.notifyListeners();
  }

  private getEffectiveTheme(): "light" | "dark" {
    if (this.currentTheme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return this.currentTheme;
  }

  setTheme(theme: Theme): void {
    this.currentTheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    this.applyTheme();
  }

  getTheme(): Theme {
    return this.currentTheme;
  }

  getEffectiveThemeValue(): "light" | "dark" {
    return this.getEffectiveTheme();
  }

  subscribe(listener: (theme: Theme) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentTheme);
    }
  }
}

export const themeManager = ThemeManager.getInstance();
