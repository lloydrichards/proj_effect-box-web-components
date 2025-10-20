import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Atom, type Result } from "@effect-atom/atom";
import { Effect, Layer, type Redacted } from "effect";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Eye, EyeOff, KeyRound, Lock, Trash2 } from "lucide-static";
import { inputStyles } from "../main";
import { ApiKeyLoaderService } from "../services/ApiKeyLoader";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import "./ui/Button";
import "./ui/Card";
import { toast } from "./ui/Toast";

export type ApiKeyStatus =
  | { type: "not-configured" }
  | { type: "locked" }
  | { type: "unlocked"; apiKey: Redacted.Redacted<string> }
  | { type: "error"; message: string; remainingAttempts?: number };

const apiKeyRuntime = Atom.runtime(
  ApiKeyLoaderService.Default.pipe(
    Layer.provide(BrowserKeyValueStore.layerLocalStorage),
  ),
);
// Make the status atom writable

export const apiKeyStatusAtom = Atom.make<ApiKeyStatus>({
  type: "not-configured",
});

export const saveApiKeyFn = apiKeyRuntime.fn(
  (params: { apiKey: string; passkey: string }) =>
    Effect.gen(function* () {
      const service = yield* ApiKeyLoaderService;
      const apiKey = yield* service.saveApiKey(params.apiKey, params.passkey);
      return { type: "unlocked", apiKey } as ApiKeyStatus;
    }).pipe(
      Effect.mapError(
        (error): ApiKeyStatus => ({
          type: "error",
          message: error.message,
          remainingAttempts:
            error._tag === "PasskeyError" ? error.remainingAttempts : undefined,
        }),
      ),
    ),
);

export const unlockApiKeyFn = apiKeyRuntime.fn((passkey: string) =>
  Effect.gen(function* () {
    const service = yield* ApiKeyLoaderService;
    const apiKey = yield* service.loadApiKey(passkey);
    return { type: "unlocked", apiKey } as ApiKeyStatus;
  }).pipe(
    Effect.mapError(
      (error): ApiKeyStatus => ({
        type: "error",
        message: error.message,
        remainingAttempts:
          error._tag === "PasskeyError" ? error.remainingAttempts : undefined,
      }),
    ),
  ),
);

export const clearApiKeyFn = apiKeyRuntime.fn(() =>
  Effect.gen(function* () {
    const service = yield* ApiKeyLoaderService;
    yield* service.clearApiKey;
    return { type: "not-configured" } as ApiKeyStatus;
  }),
);

export const checkApiKeyStatusFn = apiKeyRuntime.fn(() =>
  Effect.gen(function* () {
    const service = yield* ApiKeyLoaderService;
    const hasKey = yield* service.hasStoredApiKey;

    if (!hasKey) {
      return { type: "not-configured" } as ApiKeyStatus;
    }

    return { type: "locked" } as ApiKeyStatus;
  }),
);

@customElement("api-key-setup")
export class ApiKeySetup extends TW(AtomMixin(LitElement)) {
  @atomState(apiKeyStatusAtom) declare status: ApiKeyStatus;
  @atomState(saveApiKeyFn, { reactivityKeys: ["api-key"] })
  declare saveResult: Result.Result<ApiKeyStatus>;
  @atomState(unlockApiKeyFn, { reactivityKeys: ["api-key"] })
  declare unlockResult: Result.Result<ApiKeyStatus>;

  @state() private _apiKey = "";
  @state() private _passkey = "";
  @state() private _showApiKey = false;
  @state() private _showPasskey = false;
  @state() private _isLoading = false;

  @property({ type: String }) title = "API Key Setup";
  @property({ type: String }) description = "Configure your OpenAI API key";

  async connectedCallback() {
    super.connectedCallback();

    // Check if we have a stored key and update the status atom
    const checkStatus = this.useAtomSet(checkApiKeyStatusFn);
    checkStatus();

    // Wait for the check to complete and update the main status atom
    try {
      const checkResult = await this.useAtomPromise(checkApiKeyStatusFn);
      if (checkResult) {
        const [, setStatus] = this.useAtom(apiKeyStatusAtom);
        setStatus(checkResult);
      }
    } catch {
      // If check fails, set to not-configured
      const [, setStatus] = this.useAtom(apiKeyStatusAtom);
      setStatus({ type: "not-configured" });
    }
  }

  private async _handleSave() {
    if (!this._apiKey || !this._passkey || this._passkey.length < 6) return;

    this._isLoading = true;
    const save = this.useAtomSet(saveApiKeyFn);

    try {
      // Trigger the save operation
      save({ apiKey: this._apiKey, passkey: this._passkey });

      // Wait for the result using the Promise
      const result = await this.useAtomPromise(saveApiKeyFn);

      if (result && result.type === "unlocked") {
        this._apiKey = "";
        this._passkey = "";

        // Update the global status atom directly
        const [, setStatus] = this.useAtom(apiKeyStatusAtom);
        setStatus(result);

        // Show success toast
        toast.success("API key saved and encrypted successfully!");

        this.dispatchEvent(
          new CustomEvent("api-key-configured", {
            detail: { apiKey: result.apiKey },
            bubbles: true,
            composed: true,
          }),
        );
      } else if (result && result.type === "error") {
        // Show error toast
        const errorMsg =
          result.remainingAttempts !== undefined
            ? `${result.message} (${result.remainingAttempts} attempts remaining)`
            : result.message;
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error("Failed to save API key:", error);
      toast.error("Failed to save API key. Please try again.");
    } finally {
      this._isLoading = false;
    }
  }

  private async _handleUnlock() {
    if (!this._passkey || this._passkey.length < 6) return;

    this._isLoading = true;
    const unlock = this.useAtomSet(unlockApiKeyFn);

    try {
      // Trigger the unlock operation
      unlock(this._passkey);

      // Wait for the result using the Promise
      const result = await this.useAtomPromise(unlockApiKeyFn);

      if (result && result.type === "unlocked") {
        this._passkey = "";

        // Update the global status atom directly
        const [, setStatus] = this.useAtom(apiKeyStatusAtom);
        setStatus(result);

        // Show success toast
        toast.success("API key unlocked successfully!");

        this.dispatchEvent(
          new CustomEvent("api-key-unlocked", {
            detail: { apiKey: result.apiKey },
            bubbles: true,
            composed: true,
          }),
        );
      } else if (result && result.type === "error") {
        // Show error toast
        const errorMsg =
          result.remainingAttempts !== undefined
            ? `${result.message} (${result.remainingAttempts} attempts remaining)`
            : result.message;
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error("Failed to unlock API key:", error);
      toast.error("Failed to unlock API key. Please try again.");
    } finally {
      this._isLoading = false;
    }
  }

  private async _handleClear() {
    try {
      const clear = this.useAtomSet(clearApiKeyFn);

      // Trigger the clear operation
      clear();

      // Wait for the result using the Promise
      const result = await this.useAtomPromise(clearApiKeyFn);

      // Update the global status atom
      const [, setStatus] = this.useAtom(apiKeyStatusAtom);
      setStatus(result);

      this._apiKey = "";
      this._passkey = "";

      // Show success toast
      toast.info("API key has been cleared from storage");
    } catch (error) {
      console.error("Failed to clear API key:", error);
      toast.error("Failed to clear API key. Please try again.");
    }
  }

  render() {
    return html`
      <ui-card>
        <ui-card-header>
          <ui-card-title>${this.title}</ui-card-title>
          <ui-card-description>${this.description}</ui-card-description>
          ${
            this.status.type === "unlocked"
              ? html`
                <ui-card-action>
                  <ui-button
                    variant="ghost"
                    size="icon-sm"
                    @click=${this._handleClear}
                    aria-label="Clear stored API key"
                  >
                    ${unsafeSVG(Trash2)}
                  </ui-button>
                </ui-card-action>
              `
              : ""
          }
        </ui-card-header>

        <ui-card-content>
          ${this._renderContent()}
        </ui-card-content>
      </ui-card>
    `;
  }

  private _renderContent() {
    if (this.status.type === "unlocked") {
      return html`
        <div class="text-center py-4">
          <div class="flex items-center justify-center gap-2 mb-2">
            ${unsafeSVG(KeyRound)}
            <span class="text-lg font-medium text-green-600 dark:text-green-400">
              API Key Configured
            </span>
          </div>
          <p class="text-sm text-muted-foreground">
            Your API key is securely stored and ready to use
          </p>
        </div>
      `;
    }

    if (this.status.type === "locked") {
      return this._renderUnlockForm();
    }

    return this._renderSetupForm();
  }

  private _toggleShowApiKey() {
    this._showApiKey = !this._showApiKey;
  }

  private _renderSetupForm() {
    const error = this.status.type === "error" ? this.status : null;

    return html`
      <div class="space-y-4">
        <div class="space-y-2">
          <label class="block text-sm font-medium">OpenAI API Key</label>
          <div class="relative">
            <input
              type=${this._showApiKey ? "text" : "password"}
              .value=${this._apiKey}
              @input=${(e: Event) => {
                this._apiKey = (e.target as HTMLInputElement).value;
              }}
              placeholder="sk-..."
              class=${cn(inputStyles, "pr-10")}
            />
            <button
              type="button"
              @click=${this._toggleShowApiKey}
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              ${unsafeSVG(this._showApiKey ? EyeOff : Eye)}
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium">
            Passkey (min. 6 characters)
          </label>
          <div class="relative">
            <input
              type=${this._showPasskey ? "text" : "password"}
              .value=${this._passkey}
              @input=${(e: Event) => {
                this._passkey = (e.target as HTMLInputElement).value;
              }}
              placeholder="Enter a secure passkey"
              class=${cn(
                inputStyles,
                "pr-10",
                this._passkey && this._passkey.length < 6
                  ? "border-destructive"
                  : "",
              )}
            />
            <button
              type="button"
              @click=${this._toggleShowPasskey}
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              ${unsafeSVG(this._showPasskey ? EyeOff : Eye)}
            </button>
          </div>
          ${
            this._passkey && this._passkey.length < 6
              ? html`
                <p class="text-xs text-destructive">
                  Passkey must be at least 6 characters
                </p>
              `
              : ""
          }
        </div>

        ${
          error
            ? html`
              <div
                class="p-3 bg-destructive/10 border border-destructive/20 rounded-md"
              >
                <p class="text-sm text-destructive">
                  ${error.message}
                  ${
                    error.remainingAttempts !== undefined
                      ? html`<br />
                        Remaining attempts: ${error.remainingAttempts}`
                      : ""
                  }
                </p>
              </div>
            `
            : ""
        }

        <ui-button
          @click=${this._handleSave}
          ?disabled=${
            !this._apiKey ||
            !this._passkey ||
            this._passkey.length < 6 ||
            this._isLoading
          }
          variant="default"
          class="w-full"
        >
          ${unsafeSVG(Lock)}
          ${this._isLoading ? "Saving..." : "Save & Encrypt"}
        </ui-button>
      </div>
    `;
  }

  private _toggleShowPasskey() {
    this._showPasskey = !this._showPasskey;
  }

  private _renderUnlockForm() {
    const error = this.status.type === "error" ? this.status : null;

    return html`
      <div class="space-y-4">
        <div class="text-center mb-4">
          <p class="text-sm text-muted-foreground">
            Enter your passkey to unlock the stored API key
          </p>
        </div>

        <div class="space-y-2">
          <label class="block text-sm font-medium">Passkey</label>
          <div class="relative">
            <input
              type=${this._showPasskey ? "text" : "password"}
              .value=${this._passkey}
              @input=${(e: Event) => {
                this._passkey = (e.target as HTMLInputElement).value;
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === "Enter") this._handleUnlock();
              }}
              placeholder="Enter your passkey"
              class=${cn(inputStyles, "pr-10")}
            />
            <button
              type="button"
              @click=${this._toggleShowPasskey}
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              ${unsafeSVG(this._showPasskey ? EyeOff : Eye)}
            </button>
          </div>
        </div>

        ${
          error
            ? html`
              <div
                class="p-3 bg-destructive/10 border border-destructive/20 rounded-md"
              >
                <p class="text-sm text-destructive">
                  ${error.message}
                  ${
                    error.remainingAttempts !== undefined
                      ? html`<br />
                        Remaining attempts: ${error.remainingAttempts}`
                      : ""
                  }
                </p>
              </div>
            `
            : ""
        }

        <div class="flex gap-2">
          <ui-button
            @click=${this._handleUnlock}
            ?disabled=${
              !this._passkey || this._passkey.length < 6 || this._isLoading
            }
            variant="default"
            class="flex-1"
          >
            ${unsafeSVG(KeyRound)}
            ${this._isLoading ? "Unlocking..." : "Unlock"}
          </ui-button>

          <ui-button @click=${this._handleClear} variant="outline">
            Reset
          </ui-button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "api-key-setup": ApiKeySetup;
  }
}
