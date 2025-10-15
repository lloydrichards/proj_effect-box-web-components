import type { VariantProps } from "class-variance-authority";
import { Effect } from "effect";
import { Box, Html, Renderer } from "effect-boxes";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TW } from "../shared/tailwindMixin";
import type { buttonVariants } from "./ui/Button";
import "./ui/Button";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Minus, Plus } from "lucide-static";

const TwLitElement = TW(LitElement);

@customElement("simple-element")
export class SimpleElement extends TwLitElement {
  @property() content = "";
  @property() docsHint = "Effect Box rendering HTML from reactive state";
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
        Box.annotate(Html.span({ class: "text-muted-foreground" })),
      ),
      Box.text(` ${this.count}`).pipe(
        Box.annotate(Html.strong({ class: "text-foreground px-4" })),
      ),
    ]).pipe(
      Box.annotate(
        Html.div({
          class:
            "p-4 min-w-48 flex justify-center text-lg font-medium text-card-foreground bg-card w-full rounded-lg border border-border",
        }),
      ),
    );

    return Box.render(combinedBox, {}).pipe(
      Effect.provide(Renderer.HtmlRendererLive),
    );
  }

  render() {
    return html`
      <div class="flex flex-col justify-center items-center gap-2 w-full">
        <slot></slot>
        <div class="px-4 sm:px-8 flex gap-2 sm:gap-4 w-full justify-center">
          <ui-button
            variant=${this.variant}
            size=${this.size}
            @click=${this._decrement}
            part="button"
            aria-label="Decrement counter"
          >
            ${unsafeSVG(Minus)}
          </ui-button>
          <!-- Effect-generated content -->
          ${html`<div .innerHTML=${this.content || ""} />`}

          <ui-button
            variant=${this.variant}
            size=${this.size}
            @click=${this._increment}
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
