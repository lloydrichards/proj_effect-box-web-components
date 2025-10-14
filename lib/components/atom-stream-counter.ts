import { Atom } from "@effect-atom/atom";
import type { VariantProps } from "class-variance-authority";
import { Data, Duration, Effect, Schedule, Stream } from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Minus, Pause, Play, TimerReset } from "lucide-static";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import type { buttonVariants } from "./ui/Button";
import "./ui/Button";

class CounterLimitError extends Data.TaggedError("CounterLimit")<{
  message: string;
  count: number;
}> {}

// Atom for the current counter value (readable by components)
const counterValueAtom = Atom.make(0);

// Atom for pause state (writable by components)
const isPausedAtom = Atom.make(false);

// Atom for error state (readable by components)
const counterErrorAtom = Atom.make<CounterLimitError | null>(null);

/**
 * Atom that runs the stream counter
 * Uses Atom.make with a stream to automatically handle ticking
 */
const streamTickAtom = Atom.make((get) =>
  Stream.fromSchedule(Schedule.spaced(Duration.millis(100))).pipe(
    Stream.mapEffect(() =>
      Effect.gen(function* () {
        const error = get(counterErrorAtom);
        const isPaused = get(isPausedAtom);

        // Stop if there's an error
        if (error !== null) {
          return yield* Effect.fail(error);
        }

        // Skip if paused
        if (isPaused) {
          return;
        }
        const currentCount = get(counterValueAtom);
        const newCount = currentCount + 1;

        if (newCount >= 100) {
          const limitError = new CounterLimitError({
            message: "Counter reached limit of 100!",
            count: newCount,
          });
          get.set(counterErrorAtom, limitError);
          return yield* Effect.fail(limitError);
        }

        get.set(counterValueAtom, newCount);
      }),
    ),
  ),
);

/**
 * Stream Counter Component
 * Auto-increments using Effect Stream, stores state in Ref, and fails at 100
 * Uses atoms for state management
 */
@customElement("atom-stream-counter")
export class AtomStreamCounter extends TW(AtomMixin(LitElement)) {
  @atomState(counterValueAtom) declare currentCount: number;
  @atomState(isPausedAtom) declare isPaused: boolean;
  @atomState(counterErrorAtom) declare error: CounterLimitError | null;
  @atomState(streamTickAtom) private _tick: unknown;
  @property() docsHint =
    "Auto-incrementing with Effect Stream (pauses & resets)";

  connectedCallback() {
    super.connectedCallback();
    void this._tick;
  }
  @property({ type: String }) variant: VariantProps<
    typeof buttonVariants
  >["variant"] = "default";
  @property({ type: String }) size: VariantProps<
    typeof buttonVariants
  >["size"] = "icon-lg";

  render() {
    const showReset = this.error !== null;

    return html`
      <div class="flex flex-col justify-center items-center gap-2 w-full">
        <slot></slot>

        <div class="px-4 sm:px-8 flex gap-2 sm:gap-4 w-full justify-center">
          <ui-button
            variant=${showReset ? "destructive" : this.variant}
            size=${this.size}
            @click=${showReset ? this._reset : this._togglePause}
            part="button"
            title="${showReset ? "Reset" : this.isPaused ? "Resume" : "Pause"}"
          >
            ${
              showReset
                ? unsafeSVG(TimerReset)
                : unsafeSVG(this.isPaused ? Play : Pause)
            }
          </ui-button>

          <div
            class="p-4 min-w-32 sm:min-w-48 flex justify-center text-base sm:text-lg font-medium text-card-foreground bg-card w-full max-w-xs rounded-lg border border-border relative"
          >
            ${
              this.error
                ? html`
                  <span class="opacity-50 text-sm sm:text-base">Counter:</span>
                  <strong class="text-destructive px-2 sm:px-4">${this.error.count}</strong>
                `
                : html`
                  <span class="opacity-50 text-sm sm:text-base">Counter:</span>
                  <strong class="text-foreground px-2 sm:px-4"
                    >${this.currentCount}</strong
                  >
                `
            }
          </div>

          <ui-button
            variant=${this.variant}
            size=${this.size}
            @click=${this._reduce}
            ?disabled=${this.error !== null}
            part="button"
            title="Reduce by 10"
          >
            ${unsafeSVG(Minus)}
          </ui-button>
        </div>

        <p class="text-muted-foreground text-xs sm:text-sm text-center px-2">
          ${this.error ? this.error.message : this.docsHint}
        </p>
      </div>
    `;
  }

  private _restart() {
    const setError = this.useAtomSet(counterErrorAtom);
    const setPaused = this.useAtomSet(isPausedAtom);
    setError(null);
    setPaused(false);
  }

  private _togglePause() {
    const setPaused = this.useAtomSet(isPausedAtom);
    setPaused(!this.isPaused);
  }

  private _reduce() {
    const newCount = Math.max(0, this.currentCount - 10);
    const setCount = this.useAtomSet(counterValueAtom);
    setCount(newCount);
    this._restart();
  }

  private _reset() {
    const setCount = this.useAtomSet(counterValueAtom);
    setCount(0);
    this._restart();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "atom-stream-counter": AtomStreamCounter;
  }
}
