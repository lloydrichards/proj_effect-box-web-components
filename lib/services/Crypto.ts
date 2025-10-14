import { Config, Data, Effect } from "effect";

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

class InvalidKeyError extends Data.TaggedError("InvalidKeyError")<{
  message: string;
}> {}

class EncryptionError extends Data.TaggedError("EncryptionError")<{
  message: string;
}> {}

class DecryptionError extends Data.TaggedError("DecryptionError")<{
  message: string;
}> {}

const hexToBytes = (hex: string): Effect.Effect<Uint8Array, InvalidKeyError> =>
  Effect.try({
    try: () => {
      if (hex.length !== 64) {
        throw new Error(
          "Encryption key must be 32 bytes (64 hex characters). Generate with: openssl rand -hex 32",
        );
      }
      const bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return bytes;
    },
    catch: (error) =>
      new InvalidKeyError({
        message: error instanceof Error ? error.message : String(error),
      }),
  });

const bytesToBase64 = (bytes: Uint8Array) =>
  Effect.sync(() =>
    btoa(Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("")),
  );

const base64ToBytes = (base64: string) =>
  Effect.sync(() =>
    Uint8Array.from(atob(base64), (m) => m.codePointAt(0) as number),
  );

export class CryptoService extends Effect.Service<CryptoService>()(
  "CryptoService",
  {
    effect: Effect.gen(function* () {
      const encryptionKey = yield* Config.string("VITE_ENCRYPTION_KEY");

      const encrypt = Effect.fn(function* (plaintext: string) {
        const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

        const keyBytes = yield* hexToBytes(encryptionKey);
        const cryptoKey = yield* Effect.tryPromise({
          try: () =>
            crypto.subtle.importKey(
              "raw",
              keyBytes as BufferSource,
              { name: ALGORITHM, length: KEY_LENGTH },
              false,
              ["encrypt"],
            ),
          catch: (error) =>
            new EncryptionError({
              message: `Failed to import key: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);
        const encrypted = yield* Effect.tryPromise({
          try: () =>
            crypto.subtle.encrypt({ name: ALGORITHM, iv }, cryptoKey, data),
          catch: (error) =>
            new EncryptionError({
              message: `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

        const ivBase64 = yield* bytesToBase64(iv);
        const encryptedBase64 = yield* bytesToBase64(new Uint8Array(encrypted));
        return `${ivBase64}:${encryptedBase64}`;
      });

      const decrypt = Effect.fn(function* (encryptedString: string) {
        const parts = encryptedString.split(":");
        if (parts.length !== 2 && parts.length !== 3) {
          return yield* Effect.fail(
            new DecryptionError({
              message:
                "Invalid encrypted string format. Expected: iv:encryptedData or iv:encryptedData:authTag",
            }),
          );
        }

        const [ivBase64, encryptedDataBase64] = parts;

        const iv = yield* base64ToBytes(ivBase64);
        const encryptedData = yield* base64ToBytes(encryptedDataBase64);

        const keyBytes = yield* hexToBytes(encryptionKey);
        const cryptoKey = yield* Effect.tryPromise({
          try: () =>
            crypto.subtle.importKey(
              "raw",
              keyBytes as BufferSource,
              { name: ALGORITHM, length: KEY_LENGTH },
              false,
              ["decrypt"],
            ),
          catch: (error) =>
            new DecryptionError({
              message: `Failed to import key: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

        const decrypted = yield* Effect.tryPromise({
          try: () =>
            crypto.subtle.decrypt(
              { name: ALGORITHM, iv: iv as BufferSource },
              cryptoKey,
              encryptedData as BufferSource,
            ),
          catch: (error) =>
            new DecryptionError({
              message: `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
            }),
        });

        return new TextDecoder().decode(decrypted);
      });

      return {
        encrypt,
        decrypt,
      } as const;
    }),
  },
) {}
