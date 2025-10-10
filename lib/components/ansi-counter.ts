import { cva, type VariantProps } from "class-variance-authority";
import { Array, Effect, pipe } from "effect";
import { Ansi, Box, Renderer } from "effect-boxes";
import { FancyAnsi } from "fancy-ansi";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";

const TwLitElement = TW(LitElement);
const fancyAnsi = new FancyAnsi();

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

const Border = <A>(self: Box.Box<A>) => {
  const middleBorder = pipe(
    Array.makeBy(self.rows, () => Box.char("│")),
    Box.vcat(Box.left),
  );

  const topBorder = pipe(
    [Box.char("╭"), Box.text("─".repeat(self.cols)), Box.char("╮")],
    Box.hcat(Box.top),
  );

  const bottomBorder = pipe(
    [Box.char("╰"), Box.text("─".repeat(self.cols)), Box.char("╯")],
    Box.hcat(Box.top),
  );

  const middleSection = pipe(
    [middleBorder, self, middleBorder],
    Box.hcat(Box.top),
  );

  return pipe([topBorder, middleSection, bottomBorder], Box.vcat(Box.left));
};

@customElement("ansi-counter")
export class AnsiCounter extends TwLitElement {
  @property() content = "";
  @property() docsHint = "Render ANSI effects with Effect Boxes";
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
          Effect.tap((htmlString) => {
            this.content = htmlString;
          }),
        ),
      );
    }
  }

  // Define the Effect to execute
  protected generateEffect(): Effect.Effect<string> {
    const color = this.count < 0 ? Ansi.red : Ansi.green;
    const content = Box.combineAll([
      Box.text(`Counter:`).pipe(Box.annotate(Ansi.dim)),
      Box.text(` ${this.count}`).pipe(
        Box.annotate(Ansi.combine(Ansi.bold, color)),
      ),
    ]).pipe(Box.moveLeft(4), Box.moveRight(4), Border);

    return Box.render(content, { preserveWhitespace: true }).pipe(
      Effect.provide(Renderer.AnsiRendererLive),
    );
  }

  render() {
    return html`
      <div class="flex flex-col justify-center items-center gap-2 w-full">
        <slot></slot>
        <div class="px-4 sm:px-8 flex gap-2 sm:gap-4 w-full justify-center">
          <button
            class="${cn(
              buttonVariants({ variant: this.variant, size: this.size }),
            )}"
            @click=${this._decrement}
            part="button"
            data-umami-event="ansi-counter-interaction"
          >
            -
          </button>
          <!-- Effect-generated content -->
          <pre><code>${unsafeHTML(fancyAnsi.toHtml(this.content))}</code></pre>          
          <button
            class="${cn(
              buttonVariants({ variant: this.variant, size: this.size }),
            )}"
            @click=${this._increment}
            part="button"
            data-umami-event="ansi-counter-interaction"
          >
            +
          </button>
        </div>
        <div class="w-full border border-border/10 rounded-md p-4 bg-background/10">
          <pre><code class="text-xs">${this.content}</code></pre>
        </div>
        <p class="text-gray-400 text-xs sm:text-sm text-center px-2">${this.docsHint}</p>
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
    "ansi-counter": AnsiCounter;
  }
}
