import { Atom } from "@effect-atom/atom";
import { cva, type VariantProps } from "class-variance-authority";
import { Data, Duration, Effect, Schedule, Stream } from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Minus, Pause, Play, TimerReset } from "lucide-static";
import { AtomMixin, atomProperty } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";

// Compose mixins: Tailwind + Atom
const TwAtomElement = TW(AtomMixin(LitElement));

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

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outlined: "border hover:bg-gray-100",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        icon: "p-6",
        lg: "min-h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Stream Counter Component
 * Auto-increments using Effect Stream, stores state in Ref, and fails at 100
 * Uses atoms for state management
 */
@customElement("atom-stream-counter")
export class AtomStreamCounter extends TwAtomElement {
  @atomProperty(counterValueAtom)
  currentCount!: number;

  @atomProperty(isPausedAtom)
  isPaused!: boolean;

  @atomProperty(counterErrorAtom)
  error!: CounterLimitError | null;

  @atomProperty(streamTickAtom)
  private _tick: any;

  @property() docsHint = "Stream-based counter using Effect Stream";

  connectedCallback() {
    super.connectedCallback();
    void this._tick;
  }
  @property({ type: String }) variant: VariantProps<
    typeof buttonVariants
  >["variant"] = "default";
  @property({ type: String }) size: VariantProps<
    typeof buttonVariants
  >["size"] = "icon";

  render() {
    const showReset = this.error !== null;

    return html`
      <div class="flex flex-col justify-center items-center gap-2 w-screen">
        <slot></slot>

        <div class="px-8 flex gap-4">
          <button
            class="${cn(
              buttonVariants({
                variant: showReset ? "destructive" : this.variant,
                size: this.size,
              }),
              "[&_svg]:size-4",
            )}"
            @click=${showReset ? this._reset : this._togglePause}
            part="button"
            title="${showReset ? "Reset" : this.isPaused ? "Resume" : "Pause"}"
          >
            ${
              showReset
                ? unsafeSVG(TimerReset)
                : unsafeSVG(this.isPaused ? Play : Pause)
            }
          </button>

          <div
            class="p-4 min-w-48 flex justify-center text-lg font-medium text-gray-700 bg-white w-full rounded-lg shadow relative"
          >
            ${
              this.error
                ? html`
                  <span class="opacity-50">Counter:</span>
                  <strong class="text-red-500 px-4">${this.error.count}</strong>
                `
                : html`
                  <span class="opacity-50">Counter:</span>
                  <strong class="text-blue-500 px-4"
                    >${this.currentCount}</strong
                  >
                `
            }
          </div>

          <button
            class="${cn(
              buttonVariants({ variant: this.variant, size: this.size }),
              "[&_svg]:size-4",
            )}"
            @click=${this._reduce}
            ?disabled=${this.error !== null}
            part="button"
            title="Reduce by 10"
          >
            ${unsafeSVG(Minus)}
          </button>
        </div>

        <p class="text-gray-400">
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
