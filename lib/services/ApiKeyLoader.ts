import { KeyValueStore } from "@effect/platform";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Data, Effect, Option, Redacted } from "effect";
import { CryptoService } from "./Crypto";

const STORAGE_KEY = "effect-box:ai:apiKey";
const PASSKEY_HASH_KEY = "effect-box:ai:passkeyHash";
const MAX_ATTEMPTS = 3;
const ATTEMPT_KEY = "effect-box:ai:attempts";

export class ApiKeyError extends Data.TaggedError("ApiKeyError")<{
  message: string;
}> {}

export class PasskeyError extends Data.TaggedError("PasskeyError")<{
  message: string;
  remainingAttempts?: number;
}> {}

export class StorageError extends Data.TaggedError("StorageError")<{
  message: string;
}> {}

const hashPasskey = (passkey: string): Effect.Effect<string, ApiKeyError> =>
  Effect.gen(function* () {
    const encoder = new TextEncoder();
    const data = encoder.encode(passkey);

    const hashBuffer = yield* Effect.tryPromise({
      try: () => crypto.subtle.digest("SHA-256", data),
      catch: (error) =>
        new ApiKeyError({
          message: `Failed to hash passkey: ${error instanceof Error ? error.message : String(error)}`,
        }),
    });

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  });

const derivePasskeyString = (
  passkey: string,
  storedHash: string,
): Effect.Effect<string, PasskeyError> =>
  Effect.gen(function* () {
    const currentHash = yield* hashPasskey(passkey).pipe(
      Effect.mapError((error) => new PasskeyError({ message: error.message })),
    );

    if (currentHash !== storedHash) {
      return yield* Effect.fail(
        new PasskeyError({ message: "Invalid passkey" }),
      );
    }

    // Use passkey as the encryption key base
    // In a real app, you might want to derive this differently
    return passkey;
  });

export class ApiKeyLoaderService extends Effect.Service<ApiKeyLoaderService>()(
  "ApiKeyLoaderService",
  {
    dependencies: [
      BrowserKeyValueStore.layerLocalStorage,
      CryptoService.Default,
    ],
    effect: Effect.gen(function* () {
      const kv = yield* KeyValueStore.KeyValueStore;
      const crypto = yield* CryptoService;

      const validatePasskey = (passkey: string) =>
        Effect.gen(function* () {
          if (!passkey || passkey.length < 6) {
            return yield* Effect.fail(
              new PasskeyError({
                message: "Passkey must be at least 6 characters long",
              }),
            );
          }
          return passkey;
        });

      const getFailedAttempts = Effect.gen(function* () {
        const attemptsStr = yield* kv.get(ATTEMPT_KEY);
        return Option.match(attemptsStr, {
          onNone: () => 0,
          onSome: (str) => parseInt(str, 10) || 0,
        });
      });

      const incrementFailedAttempts = Effect.gen(function* () {
        const current = yield* getFailedAttempts;
        const newCount = current + 1;
        yield* kv.set(ATTEMPT_KEY, String(newCount));
        return newCount;
      });

      const resetFailedAttempts = kv.remove(ATTEMPT_KEY);

      const clearAllData = Effect.gen(function* () {
        yield* kv.remove(STORAGE_KEY);
        yield* kv.remove(PASSKEY_HASH_KEY);
        yield* kv.remove(ATTEMPT_KEY);
      });

      const saveApiKey = (apiKey: string, passkey: string) =>
        Effect.gen(function* () {
          yield* validatePasskey(passkey);

          // Store hash of passkey for validation
          const passkeyHash = yield* hashPasskey(passkey).pipe(
            Effect.mapError(
              (error) =>
                new StorageError({
                  message: `Failed to hash passkey: ${error.message}`,
                }),
            ),
          );

          // Encrypt the API key using CryptoService
          const encryptedApiKey = yield* crypto.encrypt(apiKey).pipe(
            Effect.mapError(
              (error) =>
                new StorageError({
                  message: `Failed to encrypt API key: ${error.message}`,
                }),
            ),
          );

          yield* kv.set(STORAGE_KEY, encryptedApiKey);
          yield* kv.set(PASSKEY_HASH_KEY, passkeyHash);
          yield* resetFailedAttempts;

          return Redacted.make(apiKey);
        }).pipe(
          Effect.mapError((error) => {
            if (error._tag === "PasskeyError") return error;
            if (error._tag === "StorageError") return error;
            return new StorageError({
              message: `Failed to save API key: ${String(error)}`,
            });
          }),
        );

      const loadApiKey = (passkey: string) =>
        Effect.gen(function* () {
          yield* validatePasskey(passkey);

          const attempts = yield* getFailedAttempts;
          if (attempts >= MAX_ATTEMPTS) {
            yield* clearAllData;
            return yield* Effect.fail(
              new PasskeyError({
                message: "Maximum attempts exceeded. Data has been cleared.",
                remainingAttempts: 0,
              }),
            );
          }

          const encryptedApiKey = yield* kv.get(STORAGE_KEY);
          const storedPasskeyHash = yield* kv.get(PASSKEY_HASH_KEY);

          if (
            Option.isNone(encryptedApiKey) ||
            Option.isNone(storedPasskeyHash)
          ) {
            return yield* Effect.fail(
              new StorageError({
                message: "No stored API key found",
              }),
            );
          }

          // Validate passkey by comparing hashes
          yield* derivePasskeyString(passkey, storedPasskeyHash.value).pipe(
            Effect.tapError(() => incrementFailedAttempts),
            Effect.tap(() => resetFailedAttempts),
            Effect.mapError(() => {
              const currentAttempts = Effect.runSync(getFailedAttempts);
              return new PasskeyError({
                message: "Invalid passkey",
                remainingAttempts: MAX_ATTEMPTS - currentAttempts,
              });
            }),
          );

          // Decrypt the API key using CryptoService
          const apiKey = yield* crypto.decrypt(encryptedApiKey.value).pipe(
            Effect.mapError(
              (error) =>
                new StorageError({
                  message: `Failed to decrypt API key: ${error.message}`,
                }),
            ),
          );

          return Redacted.make(apiKey);
        });

      const hasStoredApiKey = Effect.gen(function* () {
        const apiKey = yield* kv.get(STORAGE_KEY);
        return Option.isSome(apiKey);
      });

      const clearApiKey = clearAllData;

      return {
        saveApiKey,
        loadApiKey,
        hasStoredApiKey,
        clearApiKey,
      } as const;
    }),
    accessors: true,
  },
) {}
