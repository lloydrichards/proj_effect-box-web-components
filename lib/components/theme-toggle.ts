import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { TW } from "../shared/tailwindMixin";
import { type Theme, themeManager } from "../shared/theme-manager";
import { cn } from "../shared/utils";
import { buttonVariants } from "./ui/Button";
import "./ui/Button";

const TwLitElement = TW(LitElement);

@customElement("theme-toggle")
export class ThemeToggle extends TwLitElement {
  @state() private currentTheme: Theme = "system";
  @state() private isOpen = false;

  private unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.currentTheme = themeManager.getTheme();
    this.unsubscribe = themeManager.subscribe((theme) => {
      this.currentTheme = theme;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  private handleThemeChange(theme: Theme) {
    themeManager.setTheme(theme);
    this.isOpen = false;
  }

  private toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  private boundHandleClickOutside = this.handleClickOutside.bind(this);

  private handleClickOutside(e: MouseEvent) {
    const path = e.composedPath();
    if (!path.includes(this)) {
      this.isOpen = false;
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("isOpen")) {
      if (this.isOpen) {
        setTimeout(() => {
          document.addEventListener("click", this.boundHandleClickOutside);
        }, 0);
      } else {
        document.removeEventListener("click", this.boundHandleClickOutside);
      }
    }
  }

  render() {
    const effectiveTheme = themeManager.getEffectiveThemeValue();

    return html`
      <div class="relative">
        <button
          @click=${this.toggleDropdown}
          class="${cn(buttonVariants({ variant: "outline", size: "icon" }))}"
          aria-label="Toggle theme"
          aria-expanded="${this.isOpen}"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all ${
              effectiveTheme === "dark"
                ? "rotate-0 scale-100"
                : "rotate-90 scale-0"
            } absolute"
          >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all ${
              effectiveTheme === "light"
                ? "rotate-0 scale-100"
                : "-rotate-90 scale-0"
            }"
          >
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2v2"></path>
            <path d="M12 20v2"></path>
            <path d="m4.93 4.93 1.41 1.41"></path>
            <path d="m17.66 17.66 1.41 1.41"></path>
            <path d="M2 12h2"></path>
            <path d="M20 12h2"></path>
            <path d="m6.34 17.66-1.41 1.41"></path>
            <path d="m19.07 4.93-1.41 1.41"></path>
          </svg>
        </ui-button>

        ${
          this.isOpen
            ? html`
              <div
                class="absolute right-0 mt-2 w-36 rounded-md bg-popover border border-border z-50"
              >
                <div class="py-1" role="menu">
                  <button
                    @click=${() => this.handleThemeChange("light")}
                    class="block w-full text-left px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${
                      this.currentTheme === "light"
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }"
                    role="menuitem"
                  >
                    Light
                  </ui-button>
                  <button
                    @click=${() => this.handleThemeChange("dark")}
                    class="block w-full text-left px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${
                      this.currentTheme === "dark"
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }"
                    role="menuitem"
                  >
                    Dark
                  </ui-button>
                  <button
                    @click=${() => this.handleThemeChange("system")}
                    class="block w-full text-left px-4 py-2 text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors ${
                      this.currentTheme === "system"
                        ? "bg-accent text-accent-foreground"
                        : ""
                    }"
                    role="menuitem"
                  >
                    System
                  </ui-button>
                </div>
              </div>
            `
            : ""
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "theme-toggle": ThemeToggle;
  }
}
