import { Atom, Result } from "@effect-atom/atom";
import { FetchHttpClient } from "@effect/platform";
import { ConfigProvider, Effect, Layer, Ref, Stream } from "effect";
import { LitElement, css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Sparkles } from "lucide-static";
import { inputStyles } from "../main";
import { AiService } from "../services/AiService";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import "./ui/Button";
import "./ui/Card";

const aiLayer = AiService.Default.pipe(
  Layer.provide(
    Layer.setConfigProvider(ConfigProvider.fromJson(import.meta.env)),
  ),
  Layer.provide(FetchHttpClient.layer),
);

const runtime = Atom.runtime(aiLayer);

const promptAtom = Atom.make("");

const responseAtom = runtime.atom(
  (get) => {
    const prompt = get(promptAtom);
    if (!prompt) return Stream.succeed("");

    return Stream.unwrap(
      Effect.gen(function* () {
        const stream = yield* AiService.streamText(prompt);
        const textRef = yield* Ref.make("");

        return stream.pipe(
          Stream.mapEffect((chunk) => {
            if (chunk.type === "text-delta") {
              return Ref.updateAndGet(textRef, (text) => text + chunk.delta);
            }
            return Ref.get(textRef);
          }),
        );
      }),
    );
  },
  { initialValue: "" },
);

@customElement("ai-text-generator")
export class AiTextGenerator extends TW(AtomMixin(LitElement)) {
  static styles = css`
    :host {
      display: block;
    }
  `;

  @atomState(promptAtom) declare prompt: string;
  @atomState(responseAtom) declare response: Result.Result<string, Error>;

  @state() private _inputValue = "";

  render() {
    return html`
      <ui-card style="width: 100%; max-width: 56rem;">
        <ui-card-header>
          <ui-card-title>AI Text Generator</ui-card-title>
          <ui-card-description>Generate text with AI assistance</ui-card-description>
        </ui-card-header>

        <ui-card-content class="space-y-4">
          <div class="space-y-2">
            <label class="block text-sm font-medium">
              Enter your prompt
            </label>
            <textarea
              .value=${this._inputValue}
              @input=${this._handleInput}
              placeholder="Ask me anything..."
              class=${cn(inputStyles, "min-h-[100px] resize-vertical")}
            ></textarea>
          </div>

          ${this._renderResponse()}
        </ui-card-content>

        <ui-card-footer>
          <ui-button
            @click=${this._handleGenerate}
            ?disabled=${!this._inputValue || Result.isWaiting(this.response)}
            variant="default"
          >
            ${unsafeSVG(Sparkles)}
            ${Result.isWaiting(this.response) ? "Generating..." : "Generate"}
          </ui-button>
        </ui-card-footer>
      </ui-card>
    `;
  }

  private _renderResponse() {
    return Result.builder(this.response)
      .onInitial(() => nothing)
      .onWaiting((result) => {
        const text = Result.getOrElse(result, () => "");

        const content = html`
          <div class="p-4 rounded-lg border bg-muted">
            ${
              text
                ? html` <div class="whitespace-pre-wrap text-sm mb-2">${text}</div> `
                : null
            }
            <div class="flex items-center gap-2">
              <div
                class="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full"
              ></div>
              <span class="text-sm text-muted-foreground">
                ${text ? "Streaming..." : "Starting..."}
              </span>
            </div>
          </div>
        `;
        return content;
      })
      .onSuccess((text) => {
        if (!text) return nothing;
        return html`
          <div class="p-4 rounded-lg border bg-muted">
            <div class="whitespace-pre-wrap text-sm">${text}</div>
          </div>
        `;
      })
      .onError((error) => {
        const errorMsg = html`
          <div
            class="p-4 rounded-lg border border-destructive bg-destructive/10"
          >
            <p class="text-sm text-destructive">
              Error: ${error.message || String(error)}
            </p>
          </div>
        `;
        return errorMsg;
      })
      .render();
  }

  private _handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this._inputValue = target.value;
  }

  private _handleGenerate() {
    if (!this._inputValue) return;
    this.invalidate(["ai-response"]);
    const setPrompt = this.useAtomSet(promptAtom);
    setPrompt(this._inputValue);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ai-text-generator": AiTextGenerator;
  }
}
