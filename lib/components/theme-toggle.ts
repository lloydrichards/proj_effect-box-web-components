import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Moon, Sun } from "lucide-static";
import { TW } from "../shared/tailwindMixin";
import { type Theme, themeManager } from "../shared/theme-manager";
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
        <ui-button
          @click=${this.toggleDropdown}
          variant="outline"
          size="icon"
          aria-label="Toggle theme"
          .ariaExpanded="${this.isOpen}"
        >
          <div
            class="transition-all ${
              effectiveTheme === "dark"
                ? "rotate-0 scale-100"
                : "rotate-90 scale-0"
            } absolute"
          >
            ${unsafeSVG(Moon)}
          </div>
          <div
            class="transition-all ${
              effectiveTheme === "light"
                ? "rotate-0 scale-100"
                : "-rotate-90 scale-0"
            }"
          >
            ${unsafeSVG(Sun)}
          </div>
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
                  </button>
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
                  </button>
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
                  </button>
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
