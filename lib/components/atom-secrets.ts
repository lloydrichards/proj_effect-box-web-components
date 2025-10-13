import { Atom, type Result } from "@effect-atom/atom";
import {
  ConfigProvider,
  Console,
  Data,
  Effect,
  Redacted,
  Schema,
} from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { AtomMixin, atomState, matchResult } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";

class SecretError extends Data.TaggedError("SecretError")<{
  message: string;
}> {}

const Reversed = Schema.transform(Schema.String, Schema.String, {
  decode: (str) => str.split("").reverse().join(""),
  encode: (str) => str.split("").reverse().join(""),
});
const AtomConfig = Schema.Config(
  "VITE_SECRET_API_KEY",
  Schema.Redacted(Reversed),
);

const secretAtom = Atom.make(
  Effect.gen(function* () {
    const key = yield* AtomConfig;
    yield* Effect.sleep("500 millis");
    yield* Console.log("Fetched secret key:", key);
    return Redacted.isRedacted(key);
  }).pipe(Effect.withConfigProvider(ConfigProvider.fromJson(import.meta.env))),
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
            class="p-4 min-w-32 sm:min-w-48 flex justify-center text-base sm:text-lg font-medium text-gray-700 bg-white w-full max-w-xs rounded-lg shadow relative"
          >
            ${matchResult(this.secretResult, {
              onInitial: () => html`
                <strong class="text-gray-400 px-2 sm:px-4">--</strong>
              `,
              onSuccess: (count) => html`
                <span class="opacity-50 text-sm sm:text-base">Has Secret:</span>
                <strong class="text-blue-500 px-2 sm:px-4">${count}</strong>
              `,
              onFailure: (error) => html`
                <strong class="text-red-500 px-2 sm:px-4 opacity-50 text-sm sm:text-base"
                  >${error.message}</strong
                >
              `,
              onWaiting: () =>
                html` <span class="text-blue-500">Loading...</span> `,
            })}
          </div>
        </div>
        <p class="text-gray-400 text-xs sm:text-sm text-center px-2">${this.docsHint}</p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "atom-secrets": AtomSecrets;
  }
}
