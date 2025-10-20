import { LanguageModel } from "@effect/ai/LanguageModel";
import type * as Prompt from "@effect/ai/Prompt";
import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import { Context, Data, Effect, Layer, Redacted } from "effect";
import { FetchHttpClient } from "@effect/platform";

class AiGenerationError extends Data.TaggedError("AiGenerationError")<{
  message: string;
  cause?: unknown;
}> {}

export class ApiKey extends Context.Tag("ApiKey")<
  ApiKey,
  Redacted.Redacted<string>
>() {}

const Gpt4o = OpenAiLanguageModel.model("gpt-4o");

const makeOpenAiLayer = (apiKey: Redacted.Redacted<string>) =>
  Layer.provide(Gpt4o, OpenAiClient.layer({ apiKey }));

export class AiService extends Effect.Service<AiService>()("AiService", {
  dependencies: [FetchHttpClient.layer],
  effect: Effect.gen(function* () {
    const apiKey = yield* ApiKey;
    const model = yield* LanguageModel.pipe(
      Effect.provide(makeOpenAiLayer(apiKey)),
    );

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
