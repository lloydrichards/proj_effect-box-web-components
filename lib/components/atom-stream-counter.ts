import { Atom, type Registry } from "@effect-atom/atom";
import { cva, type VariantProps } from "class-variance-authority";
import { Data, Duration, Effect, Fiber, Ref, Stream } from "effect";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
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
 * Effect program that runs the stream counter
 * Uses a registry to read/write atoms
 */
const createStreamCounterProgram = (
  initialCount: number,
  registry: Registry.Registry,
) =>
  Effect.gen(function* () {
    // Create a Ref to store the counter state
    const counterRef = yield* Ref.make(initialCount);

    // Create a stream that ticks every 100ms
    const tickStream = Stream.tick(Duration.millis(100));

    // Process each tick: increment counter and check limit
    yield* Stream.runForEach(tickStream, (_tick) =>
      Effect.gen(function* () {
        // Get current pause state from atom
        const isPaused = registry.get(isPausedAtom);

        // Skip if paused
        if (isPaused) {
          return;
        }

        // Update counter
        yield* Ref.update(counterRef, (n) => n + 1);

        // Get current value
        const count = yield* Ref.get(counterRef);

        // Update the counter value atom
        registry.set(counterValueAtom, count);

        // Check if we've reached the limit
        if (count >= 100) {
          yield* new CounterLimitError({
            message: "Counter reached limit of 100!",
            count,
          });
        }
      }),
    );
  });

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

  @state()
  private streamFiber: Fiber.RuntimeFiber<void, CounterLimitError> | null =
    null;

  @property() docsHint = "Stream-based counter using Effect Stream + Ref";
  @property({ type: String }) variant: VariantProps<
    typeof buttonVariants
  >["variant"] = "default";
  @property({ type: String }) size: VariantProps<
    typeof buttonVariants
  >["size"] = "icon";

  connectedCallback() {
    super.connectedCallback();
    // Start ticking when component is connected
    this._startTicking();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Stop the stream when component is disconnected
    if (this.streamFiber) {
      Effect.runSync(Fiber.interrupt(this.streamFiber));
      this.streamFiber = null;
    }
  }

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

  private async _startTicking() {
    // Stop any existing stream
    if (this.streamFiber) {
      await Effect.runPromise(Fiber.interrupt(this.streamFiber));
      this.streamFiber = null;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Clear error state and unpause
    const registry = this.getAtomRegistry();
    registry.set(counterErrorAtom, null);
    registry.set(isPausedAtom, false);

    const fiber = Effect.runFork(
      createStreamCounterProgram(this.currentCount, registry).pipe(
        Effect.catchTag("CounterLimit", (error: CounterLimitError) =>
          Effect.sync(() => {
            registry.set(counterErrorAtom, error);
            this.streamFiber = null;
          }),
        ),
      ),
    );

    this.streamFiber = fiber;
  }

  private _togglePause() {
    // Toggle pause state in the atom
    const registry = this.getAtomRegistry();
    const currentPaused = registry.get(isPausedAtom);
    registry.set(isPausedAtom, !currentPaused);
  }

  private async _reduce() {
    // Reduce count by 10 and restart
    const registry = this.getAtomRegistry();
    const newCount = Math.max(0, this.currentCount - 10);
    registry.set(counterValueAtom, newCount);
    await this._startTicking();
  }

  private async _reset() {
    // Reset counter to 0 and restart
    const registry = this.getAtomRegistry();
    registry.set(counterValueAtom, 0);
    await this._startTicking();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "atom-stream-counter": AtomStreamCounter;
  }
}
