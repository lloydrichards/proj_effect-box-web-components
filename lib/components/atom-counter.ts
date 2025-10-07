import { Atom, Result } from "@effect-atom/atom";
import { cva, type VariantProps } from "class-variance-authority";
import { Data, Effect } from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Minus, Plus } from "lucide-static";
import {
  AtomMixin,
  matchResult,
  resultAtomProperty,
} from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";

// Compose mixins: Tailwind + Atom
const TwAtomElement = TW(AtomMixin(LitElement));

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
        yield* new CountError({ message: "Count must be at least -3" });
      }
      yield* Effect.sleep("100 millis");
      yield* Effect.log("Counter updated to:", newValue);
      return newValue;
    }),
  { initialValue: 0 },
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
 * Example component demonstrating Effect-atom integration with Lit using Result pattern
 * The countResultAtom is shared globally, so multiple instances will share the same state
 */
@customElement("atom-counter")
export class AtomCounter extends TwAtomElement {
  @resultAtomProperty(countAtom)
  countResult!: Result.Result<number, CountError>;

  @property() docsHint = "Atom state managed by Effect (shared globally)";
  @property({ type: String }) variant: VariantProps<
    typeof buttonVariants
  >["variant"] = "default";
  @property({ type: String }) size: VariantProps<
    typeof buttonVariants
  >["size"] = "icon";

  render() {
    const isLoading = Result.isWaiting(this.countResult);
    return html`
      <div class="flex flex-col justify-center items-center gap-2 w-screen">
        <slot></slot>

        <div class="px-8 flex gap-4">
          <button
            class="${cn(
              buttonVariants({ variant: this.variant, size: this.size }),
              "[&_svg]:size-4",
            )}"
            @click=${this._decrement}
            ?disabled=${isLoading}
            part="button"
          >
            ${unsafeSVG(Minus)}
          </button>

          <div
            class="p-4 min-w-48 flex justify-center text-lg font-medium text-gray-700 bg-white w-full rounded-lg shadow relative"
          >
            ${matchResult(this.countResult, {
              onInitial: () => html`
                <!-- <span class="opacity-50">Counter:</span> -->
                <strong class="text-gray-400 px-4">--</strong>
              `,
              onSuccess: (count) => html`
                <span class="opacity-50">Counter:</span>
                <strong class="text-blue-500 px-4">${count}</strong>
              `,
              onFailure: (error) => html`
                <strong class="text-red-500 px-4 opacity-50"
                  >${error.message}</strong
                >
              `,
              onWaiting: () =>
                html` <span class="text-blue-500">Loading...</span> `,
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
          >
            ${unsafeSVG(Plus)}
          </button>
        </div>

        <p class="text-gray-400">${this.docsHint}</p>
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
    const currentCount = Result.isSuccess(this.countResult)
      ? this.countResult.value
      : 0;

    this.setAtom("countResult", currentCount + delta);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "atom-counter": AtomCounter;
  }
}
