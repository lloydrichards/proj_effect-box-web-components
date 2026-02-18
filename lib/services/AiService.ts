import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai";
import { Data, Effect, Layer, type Redacted, ServiceMap } from "effect";
import * as LanguageModel from "effect/unstable/ai/LanguageModel";
import type * as Prompt from "effect/unstable/ai/Prompt";
import { FetchHttpClient } from "effect/unstable/http";

class AiGenerationError extends Data.TaggedError("AiGenerationError")<{
  message: string;
  cause?: unknown;
}> {}

export const ApiKey = ServiceMap.Service<Redacted.Redacted<string>>("ApiKey");

const makeOpenAiLayer = (apiKey: Redacted.Redacted<string>) =>
  OpenAiLanguageModel.layer({ model: "gpt-4o" }).pipe(
    Layer.provide(OpenAiClient.layer({ apiKey })),
  );

export class AiService extends ServiceMap.Service<AiService>()("AiService", {
  make: Effect.gen(function* () {
    const apiKey = yield* ApiKey;
    const model = yield* Effect.gen(function* () {
      return yield* LanguageModel.LanguageModel;
    }).pipe(Effect.provide(makeOpenAiLayer(apiKey)));

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
}) {
  static layer = Layer.effect(this, this.make).pipe(
    Layer.provide(FetchHttpClient.layer),
  );
}
