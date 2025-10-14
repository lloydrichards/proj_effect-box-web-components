import { Atom, type Result } from "@effect-atom/atom";
import {
  Config,
  ConfigProvider,
  Console,
  Data,
  Effect,
  Layer,
  Redacted,
} from "effect";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Lock } from "lucide-static";
import { CryptoService } from "../services/Crypto";
import { AtomMixin, atomState, matchResult } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";

class SecretError extends Data.TaggedError("SecretError")<{
  message: string;
}> {}

const decryptSecret = Effect.gen(function* () {
  const crypto = yield* CryptoService;
  const encryptedKey = yield* Config.string("VITE_SECRET_API_KEY");

  const decrypted = yield* crypto.decrypt(encryptedKey).pipe(
    Effect.mapError(
      (error) =>
        new SecretError({
          message: error.message,
        }),
    ),
  );

  return Redacted.make(decrypted);
});

const secretRuntime = Atom.runtime(
  CryptoService.Default.pipe(
    Layer.provide(
      Layer.setConfigProvider(ConfigProvider.fromJson(import.meta.env)),
    ),
  ),
);

const secretAtom = secretRuntime.atom(
  Effect.gen(function* () {
    yield* Effect.sleep("500 millis");
    const key = yield* decryptSecret;
    yield* Console.log("Fetched secret key:", key);
    return Redacted.isRedacted(key);
  }),
);

/**
 * Example component demonstrating Effect-atom integration with Lit using Result pattern
 * The secretAtom is shared globally, so multiple instances will share the same state
 */
@customElement("atom-secrets")
export class AtomSecrets extends TW(AtomMixin(LitElement)) {
  @atomState(secretAtom) declare secretResult: Result.Result<
    boolean,
    SecretError
  >;
  @property() docsHint = "Check console for secret redaction";

  render() {
    return html`
      <div class="flex flex-col justify-center items-center gap-2 w-full">
        <slot></slot>
        <div class="px-4 sm:px-8 flex gap-2 sm:gap-4 w-full justify-center">
          <div
            class="p-4 min-w-32 sm:min-w-48 flex justify-center text-base sm:text-lg font-medium text-card-foreground bg-card w-full max-w-xs rounded-lg border border-border relative"
          >
            ${matchResult(this.secretResult, {
              onInitial: () => html`
                <strong class="text-muted-foreground px-2 sm:px-4">--</strong>
              `,
              onSuccess: (count) => html`
                <span class="opacity-50 text-sm sm:text-base">Has Secret:</span>
                <strong class="text-foreground px-2 sm:px-4">${count}</strong>
              `,
              onFailure: (error) => html`
                <strong
                  class="text-destructive px-2 sm:px-4 opacity-50 text-sm sm:text-base"
                  >${error.message}</strong
                >
              `,
              onWaiting: () =>
                html` <span class="text-foreground">Loading...</span> `,
            })}
          </div>
        </div>
        <p class="text-muted-foreground text-xs sm:text-sm text-center px-2">
          ${this.docsHint}
        </p>
      </div>
    `;
  }
}

const encryptAtom = secretRuntime.fn((input: string) =>
  Effect.gen(function* () {
    if (!input.trim()) {
      return yield* Effect.fail(
        new SecretError({ message: "Please enter a value to encrypt" }),
      );
    }

    const crypto = yield* CryptoService;

    const encrypted = yield* crypto.encrypt(input).pipe(
      Effect.mapError(
        (error) =>
          new SecretError({
            message: error.message,
          }),
      ),
    );

    return encrypted;
  }),
);

/**
 * Utility component for encrypting secrets in the browser
 * Useful for development/testing - shows the encrypted output
 */
@customElement("secret-encryptor")
export class SecretEncryptor extends TW(AtomMixin(LitElement)) {
  @state() private inputValue = "";
  @atomState(encryptAtom, { reactivityKeys: ["encrypt"] })
  declare encryptResult: Result.Result<string, SecretError>;
  @property() placeholder = "Enter secret to encrypt...";

  private handleInput(e: Event) {
    const input = e.target as HTMLInputElement;
    this.inputValue = input.value;
  }

  private handleEncrypt() {
    const encrypt = this.useAtomSet(encryptAtom);
    encrypt(this.inputValue);
  }

  private copyToClipboard(encryptedValue: string) {
    navigator.clipboard.writeText(encryptedValue);
  }

  render() {
    return html`
      <div class="flex flex-col gap-4 w-full max-w-2xl mx-auto p-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-foreground">
            Secret to Encrypt
          </label>
          <div class="flex items-center gap-2">
            <input
              type="text"
              .value=${this.inputValue}
              @input=${this.handleInput}
              placeholder=${this.placeholder}
              class="flex-1 px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <ui-button
              size="sm"
              @click=${this.handleEncrypt}
              ?disabled=${!this.inputValue.trim()}
            >
             ${unsafeSVG(Lock)} Encrypt
            </ui-button>
          </div>
        </div>

        ${matchResult(this.encryptResult, {
          onInitial: () => html``,
          onSuccess: (encryptedValue) =>
            encryptedValue
              ? html`
                  <div class="flex gap-2">
                    <input
                      type="text"
                      .value=${encryptedValue}
                      readonly
                      class="flex-1 px-3 py-2 bg-muted border border-border rounded-md text-foreground font-mono text-xs"
                    />
                    <button
                      @click=${() => this.copyToClipboard(encryptedValue)}
                      class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 font-medium transition-colors"
                      title="Copy to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                `
              : html``,
          onFailure: (error) => html`
            <div
              class="p-3 bg-destructive/10 border border-destructive/20 rounded-md"
            >
              <p class="text-sm text-destructive">${error.message}</p>
            </div>
          `,
          onWaiting: () => html`
            <div class="p-3 bg-muted border border-border rounded-md">
              <p class="text-sm text-muted-foreground">Encrypting...</p>
            </div>
          `,
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "atom-secrets": AtomSecrets;
    "secret-encryptor": SecretEncryptor;
  }
}
