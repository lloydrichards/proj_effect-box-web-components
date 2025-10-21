import type { Result } from "@effect-atom/atom";
import { Data } from "effect";
import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { matchResult } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";

class CountError extends Data.TaggedError("CountError")<{ message: string }> {}

@customElement("status-panel")
export class StatusPanel extends TW(LitElement) {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }
  `;

  @property({ type: Object }) countResult?: Result.Result<number, CountError>;
  @property({ type: String }) label = "Counter";
  @property({ type: String }) variant: "default" | "accent" = "default";
  @property({ type: String }) registryType: "global" | "scoped" = "global";

  render() {
    if (!this.countResult) {
      return html`
        <div
          class="p-4 w-full flex flex-col gap-2 text-card-foreground bg-card rounded-lg border border-border"
        >
          <div class="flex gap-1">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >Registry</span
            >
            <span class="text-sm font-semibold">${this.registryType}</span>
          </div>
          <div class="flex gap-1">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >Result</span
            >
            <span class="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground w-fit"
              >No Data</span
            >
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >${this.label}</span
            >
            <strong class="text-muted-foreground text-2xl">--</strong>
          </div>
        </div>
      `;
    }

    const accentColor =
      this.variant === "accent" ? "text-purple-500" : "text-foreground";

    return html`
      <div
        class="p-4 w-full flex flex-col gap-2 text-card-foreground bg-card rounded-lg border border-border"
      >
        <div class="flex justify-between gap-1">
          <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >Registry</span
          >
          <span class="text-sm font-semibold">${this.registryType}</span>
        </div>
        <div class="flex justify-between gap-1">
          <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >Result</span
          >
          ${matchResult(this.countResult, {
            onInitial: () => html`
              <span class="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground w-fit"
                >Initial</span
              >
            `,
            onSuccess: () => html`
              <span
                class=${cn(
                  "text-xs px-2 py-0.5 rounded-full w-fit",
                  this.variant === "accent"
                    ? "bg-purple-500/10 text-purple-500"
                    : "bg-green-500/10 text-green-500",
                )}
                >Success</span
              >
            `,
            onFailure: () => html`
              <span class="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive w-fit"
                >Error</span
              >
            `,
            onWaiting: () => html`
              <span class="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 animate-pulse w-fit"
                >Loading</span
              >
            `,
          })}
        </div>
        <div class="flex items-center justify-between gap-1">
          ${matchResult(this.countResult, {
            onInitial: () => html`
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >${this.label}</span
              >
              <strong class="text-muted-foreground text-2xl">--</strong>
            `,
            onSuccess: (count) => html`
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >${this.label}</span
              >
              <strong class="${accentColor} text-3xl font-bold">${count}</strong>
            `,
            onFailure: (error) => html`
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >Error</span
              >
              <strong class="text-destructive text-sm">${error.message}</strong>
            `,
            onWaiting: () => html`
              <span class="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >${this.label}</span
              >
              <strong class="${accentColor} text-3xl font-bold">...</strong>
            `,
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "status-panel": StatusPanel;
  }
}
