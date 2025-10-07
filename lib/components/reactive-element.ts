import { cva, type VariantProps } from "class-variance-authority";
import { Effect } from "effect";
import { Box, Html, Renderer } from "effect-boxes";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";

const TwLitElement = TW(LitElement);

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        lg: "min-h-11 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

@customElement("reactive-element")
export class ReactiveElement extends TwLitElement {
  @property() content = "";
  @property() docsHint = "Click on the Vite and Lit logos to learn more";
  @property({ type: Number }) count = 0;
  @property({ type: String }) variant: VariantProps<
    typeof buttonVariants
  >["variant"] = "default";
  @property({ type: String }) size: VariantProps<
    typeof buttonVariants
  >["size"] = "default";

  // Render effect into the content when count changes
  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("count")) {
      Effect.runPromise(
        this.generateEffect().pipe(
          Effect.map((htmlString) => {
            this.content = htmlString;
            return null;
          }),
        ),
      );
    }
  }

  // Define the Effect to execute
  protected generateEffect(): Effect.Effect<string> {
    const combinedBox = Box.combineAll([
      Box.text(`Counter:`).pipe(
        Box.annotate(Html.span({ class: "opacity-50" })),
      ),
      Box.text(` ${this.count}`).pipe(
        Box.annotate(Html.strong({ class: "text-blue-500 px-4" })),
      ),
    ]).pipe(
      Box.annotate(
        Html.div({
          class:
            "p-4 min-w-48 flex justify-center text-lg font-medium text-gray-700 bg-white w-full rounded-lg shadow",
        }),
      ),
    );

    return Box.render(combinedBox, {}).pipe(
      Effect.provide(Renderer.HtmlRendererLive),
    );
  }

  render() {
    return html`
      <div class="flex flex-col justify-center items-center gap-2 w-screen">
        <slot></slot>
        <div class="px-8 flex gap-4">
          <button
            class="${cn(
              buttonVariants({ variant: this.variant, size: this.size }),
            )}"
            @click=${this._decrement}
            part="button"
          >
            -
          </button>
          <!-- Effect-generated content -->
          ${unsafeHTML(this.content)}
          
          <button
            class="${cn(
              buttonVariants({ variant: this.variant, size: this.size }),
            )}"
            @click=${this._increment}
            part="button"
          >
            +
          </button>
        </div>
        <p class="text-gray-400">${this.docsHint}</p>
      </div>
    `;
  }

  private _increment() {
    this.count++;
  }

  private _decrement() {
    this.count--;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "reactive-element": ReactiveElement;
  }
}
