import { Effect } from "effect";
import { Ansi, Box, Renderer } from "effect-boxes";
import { FancyAnsi } from "fancy-ansi";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Minus, Plus } from "lucide-static";
import { TW } from "../shared/tailwindMixin";
import { Border } from "./boxes/Border";
import type { ButtonSize, ButtonVariant } from "./ui/button/button";
import "./ui/button/button";

const TwLitElement = TW(LitElement);
const fancyAnsi = new FancyAnsi();

@customElement("ansi-counter")
export class AnsiCounter extends TwLitElement {
  @property() content = "";
  @property() docsHint = "Render ANSI effects with Effect Boxes";
  @property({ type: Number }) count = 0;
  @property({ type: String }) variant: ButtonVariant = "default";
  @property({ type: String }) size: ButtonSize = "icon-lg";

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
        <div class="px-4 sm:px-8 flex gap-2 sm:gap-4 w-full items-center justify-center">
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
          <pre><code>${unsafeHTML(fancyAnsi.toHtml(this.content))}</code></pre>
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
        <div class="w-full border border-border/10 rounded-md p-4 bg-muted">
          <pre><code class="text-xs">${this.content}</code></pre>
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
    "ansi-counter": AnsiCounter;
  }
}
