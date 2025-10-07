import { cva, type VariantProps } from "class-variance-authority";
import { Effect } from "effect";
import { Box, Html, Renderer } from "effect-boxes";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import viteLogo from "/vite.svg";
import effectLogo from "../assets/effect_dark.svg";
import litLogo from "../assets/lit.svg";
import tailwindLogo from "../assets/tailwind.svg";
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

@customElement("simple-element")
export class SimpleElement extends TwLitElement {
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
        <div class="flex gap-8">
          <a href="https://vitejs.dev" target="_blank">
            <img src=${viteLogo} class="size-14" alt="Vite logo" />
          </a>
          <a href="https://lit.dev" target="_blank">
            <img src=${litLogo} class="size-14" alt="Lit logo" />
          </a>
          <a href="https://tailwindcss.com/" target="_blank">
            <img src=${tailwindLogo} class="size-14" alt="Tailwind logo" />
          </a>
          <a href="https://effect.website/" target="_blank">
            <img src=${effectLogo} class="size-14" alt="Effect logo" />
          </a>
        </div>

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
          ${html`<div .innerHTML=${this.content || ""} />`}
          
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
    "simple-element": SimpleElement;
  }
}
