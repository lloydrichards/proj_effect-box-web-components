import { Atom, Result } from "@effect-atom/atom";
import type { VariantProps } from "class-variance-authority";
import { Data, Effect } from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Minus, Plus } from "lucide-static";
import { AtomMixin, atomState, matchResult } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import { buttonVariants } from "./ui/Button";

class CountError extends Data.TaggedError("CountError")<{ message: string }> {}

/**
 * Create a shared writable Result atom for the counter state
 * Using Atom.fn creates a writable atom that can execute effects
 * This atom is global and can be shared across multiple components
 */
const countAtom = Atom.fn(
  (newValue: number) =>
    Effect.gen(function* () {
      if (newValue < -3) {
        return yield* new CountError({ message: "Count must be at least -3" });
      }
      yield* Effect.sleep("100 millis");
      yield* Effect.log("Counter updated to:", newValue);
      return newValue;
    }),
  { initialValue: 0 },
);

/**
 * Example component demonstrating Effect-atom integration with Lit using Result pattern
 * The countResultAtom is shared globally, so multiple instances will share the same state
 */
@customElement("atom-counter")
export class AtomCounter extends TW(AtomMixin(LitElement)) {
  @atomState(countAtom) declare countResult: Result.Result<number, CountError>;
  @property() docsHint = "Both instances share the same global atom state";
  @property({ type: String }) variant: VariantProps<
    typeof buttonVariants
  >["variant"] = "default";
  @property({ type: String }) size: VariantProps<
    typeof buttonVariants
  >["size"] = "icon-lg";

  render() {
    const isLoading = Result.isWaiting(this.countResult);
    return html`
      <div class="flex flex-col justify-center items-center gap-2 w-full">
        <slot></slot>

        <div class="px-4 sm:px-8 flex gap-2 sm:gap-4 w-full justify-center">
          <button
            class="${cn(
              buttonVariants({ variant: this.variant, size: this.size }),
              "[&_svg]:size-4",
            )}"
            @click=${this._decrement}
            ?disabled=${isLoading}
            part="button"
            data-umami-event="atom-counter-interaction"
          >
            ${unsafeSVG(Minus)}
          </button>

          <div
            class="p-4 min-w-32 sm:min-w-48 flex justify-center text-base sm:text-lg font-medium text-card-foreground bg-card w-full max-w-xs rounded-lg border border-border relative"
          >
            ${matchResult(this.countResult, {
              onInitial: () => html`
                <strong class="text-muted-foreground px-2 sm:px-4">--</strong>
              `,
              onSuccess: (count) => html`
                <span class="text-muted-foreground text-sm sm:text-base">Counter:</span>
                <strong class="text-foreground px-2 sm:px-4">${count}</strong>
              `,
              onFailure: (error) => html`
                <strong class="text-destructive px-2 sm:px-4 opacity-50 text-sm sm:text-base"
                  >${error.message}</strong
                >
              `,
              onWaiting: () =>
                html` <span class="text-foreground">Loading...</span> `,
            })}
          </div>

          <button
            class="${cn(
              buttonVariants({ variant: this.variant, size: this.size }),
              "[&_svg]:size-4",
            )}"
            @click=${this._increment}
            ?disabled=${isLoading}
            part="button"
            data-umami-event="atom-counter-interaction"
          >
            ${unsafeSVG(Plus)}
          </button>
        </div>

        <p class="text-muted-foreground text-xs sm:text-sm text-center px-2">${this.docsHint}</p>
      </div>
    `;
  }

  private _increment() {
    this._updateCount(1);
  }

  private _decrement() {
    this._updateCount(-1);
  }

  /**
   * Update count using the writable Result atom
   * The atom automatically handles async execution and loading states
   */
  private _updateCount(delta: number) {
    const setCount = this.useAtomSet(countAtom);
    const currentCount = Result.isSuccess(this.countResult)
      ? this.countResult.value
      : 0;

    setCount(currentCount + delta);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "atom-counter": AtomCounter;
  }
}
