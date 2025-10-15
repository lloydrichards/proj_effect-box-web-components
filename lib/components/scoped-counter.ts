import { Atom, Registry, Result } from "@effect-atom/atom";
import type { VariantProps } from "class-variance-authority";
import { Data, Effect } from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Minus, Plus } from "lucide-static";
import { AtomMixin, atomState, matchResult } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import "./ui/Button";
import type { buttonVariants } from "./ui/Button";

class CountError extends Data.TaggedError("CountError")<{ message: string }> {}

const scopedRegistry = Registry.make({
  scheduleTask: (f) => queueMicrotask(f),
  timeoutResolution: 1000,
  defaultIdleTTL: 30_000,
});

const scopedCountAtom = Atom.fn(
  (newValue: number) =>
    Effect.gen(function* () {
      if (newValue < -3) {
        return yield* new CountError({ message: "Count must be at least -3" });
      }
      yield* Effect.sleep("100 millis");
      yield* Effect.log("Scoped counter updated to:", newValue);
      return newValue;
    }),
  { initialValue: 0 },
);

@customElement("scoped-counter")
export class ScopedCounter extends TW(AtomMixin(LitElement, scopedRegistry)) {
  @atomState(scopedCountAtom) declare countResult: Result.Result<
    number,
    CountError
  >;
  @property() docsHint = "This counter uses a scoped registry (isolated state)";
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
          <ui-button
            variant=${this.variant}
            size=${this.size}
            @click=${this._decrement}
            ?disabled=${isLoading}
            part="button"
            aria-label="Decrement counter"
          >
            ${unsafeSVG(Minus)}
          </ui-button>

          <div
            class="p-4 min-w-32 sm:min-w-48 flex justify-center text-base sm:text-lg font-medium text-card-foreground bg-card w-full max-w-xs rounded-lg border border-border relative"
          >
            ${matchResult(this.countResult, {
              onInitial: () => html`
                <strong class="text-muted-foreground px-2 sm:px-4">--</strong>
              `,
              onSuccess: (count) => html`
                <span class="opacity-50 text-sm sm:text-base">Counter:</span>
                <strong class="text-purple-500 px-2 sm:px-4">${count}</strong>
              `,
              onFailure: (error) => html`
                <strong class="text-destructive px-2 sm:px-4 opacity-50 text-sm sm:text-base"
                  >${error.message}</strong
                >
              `,
              onWaiting: () =>
                html` <span class="text-purple-500">Loading...</span> `,
            })}
          </div>

          <ui-button
            variant=${this.variant}
            size=${this.size}
            @click=${this._increment}
            ?disabled=${isLoading}
            part="button"
            aria-label="Increment counter"
          >
            ${unsafeSVG(Plus)}
          </ui-button>
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

  private _updateCount(delta: number) {
    const setCount = this.useAtomSet(scopedCountAtom);
    const currentCount = Result.isSuccess(this.countResult)
      ? this.countResult.value
      : 0;

    setCount(currentCount + delta);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "scoped-counter": ScopedCounter;
  }
}
