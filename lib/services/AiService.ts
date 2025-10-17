import { LanguageModel } from "@effect/ai/LanguageModel";
import type * as Prompt from "@effect/ai/Prompt";
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import { Config, Data, Effect, Layer, Redacted } from "effect";
import { CryptoService } from "./Crypto";

class AiGenerationError extends Data.TaggedError("AiGenerationError")<{
  message: string;
  cause?: unknown;
}> {}

class DecryptionError extends Data.TaggedError("DecryptionError")<{
  message: string;
}> {}

const decryptApiKey = Effect.gen(function* () {
  const crypto = yield* CryptoService;
  const encryptedKey = yield* Config.string("VITE_OPENAI_API_KEY");

  const decrypted = yield* crypto.decrypt(encryptedKey).pipe(
    Effect.mapError(
      (error) =>
        new DecryptionError({
          message: error.message,
        }),
    ),
  );

  return Redacted.make(decrypted);
});

const Gpt4o = OpenAiLanguageModel.model("gpt-4o");

const OpenAi = Layer.unwrapEffect(
  Effect.gen(function* () {
    const apiKey = yield* decryptApiKey;
    return OpenAiClient.layer({ apiKey });
  }),
).pipe(Layer.provide(CryptoService.Default));

const OpenAiLive = Layer.provide(Gpt4o, OpenAi);

export class AiService extends Effect.Service<AiService>()("AiService", {
  dependencies: [OpenAiLive],
  effect: Effect.gen(function* () {
    const model = yield* LanguageModel;

    const generateText = (prompt: Prompt.RawInput) =>
      Effect.gen(function* () {
        const response = yield* model.generateText({ prompt });
        return response.text;
      }).pipe(
        Effect.mapError(
          (error) =>
            new AiGenerationError({
              message: "Failed to generate text",
              cause: error,
            }),
        ),
      );

    const streamText = (prompt: Prompt.RawInput) =>
      model.streamText({ prompt });

    return { generateText, streamText } as const;
  }),
  accessors: true,
}) {}
