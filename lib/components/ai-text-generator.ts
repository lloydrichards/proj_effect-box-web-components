import { FetchHttpClient } from "@effect/platform";
import { Effect, Layer, Stream } from "effect";
import { LitElement, css, html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Sparkles } from "lucide-static";
import { inputStyles } from "../main";
import { AiService, ApiKey } from "../services/AiService";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { apiKeyStatusAtom, type ApiKeyStatus } from "./api-key-setup";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import "./api-key-setup";
import "./ui/Button";
import "./ui/Card";

@customElement("ai-text-generator")
export class AiTextGenerator extends TW(AtomMixin(LitElement)) {
  static styles = css`
    :host {
      display: block;
    }
  `;

  @atomState(apiKeyStatusAtom) declare apiKeyStatus: ApiKeyStatus;

  @state() private _inputValue = "";
  @state() private _isGenerating = false;
  @state() private _generatedText = "";
  @state() private _error: string | null = null;

  render() {
    if (this.apiKeyStatus.type !== "unlocked") {
      return html`
        <api-key-setup
          title="AI Text Generator Configuration"
          description="Configure your OpenAI API key to generate text"
        ></api-key-setup>
      `;
    }
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
            ?disabled=${!this._inputValue || this._isGenerating}
            variant="default"
          >
            ${unsafeSVG(Sparkles)}
            ${this._isGenerating ? "Generating..." : "Generate"}
          </ui-button>
        </ui-card-footer>
      </ui-card>
    `;
  }

  private _renderResponse() {
    if (this._error) {
      return html`
        <div class="p-4 rounded-lg border border-destructive bg-destructive/10">
          <p class="text-sm text-destructive">Error: ${this._error}</p>
        </div>
      `;
    }

    if (this._isGenerating) {
      return html`
        <div class="p-4 rounded-lg border bg-muted">
          <div class="flex items-center gap-2">
            <div
              class="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full"
            ></div>
            <span class="text-sm text-muted-foreground">Generating...</span>
          </div>
        </div>
      `;
    }

    if (this._generatedText) {
      return html`
        <div class="p-4 rounded-lg border bg-muted">
          <div class="whitespace-pre-wrap text-sm">${this._generatedText}</div>
        </div>
      `;
    }

    return nothing;
  }

  private _handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this._inputValue = target.value;
  }

  private async _handleGenerate() {
    if (!this._inputValue) return;
    if (this.apiKeyStatus.type !== "unlocked") return;

    this._isGenerating = true;
    this._error = null;

    try {
      const prompt = this._inputValue;
      const component = this;

      const effect = Effect.gen(function* () {
        const stream = yield* AiService.streamText(prompt);
        let fullText = "";

        yield* Stream.runForEach(stream, (chunk) =>
          Effect.sync(() => {
            if (chunk.type === "text-delta") {
              fullText += chunk.delta;
              component._generatedText = fullText;
              component.requestUpdate();
            }
          }),
        );

        return fullText;
      }).pipe(
        Effect.provide(AiService.Default),
        Effect.provide(Layer.succeed(ApiKey, this.apiKeyStatus.apiKey)),
        Effect.provide(FetchHttpClient.layer),
      );

      await Effect.runPromise(effect);
    } catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    } finally {
      this._isGenerating = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ai-text-generator": AiTextGenerator;
  }
}
