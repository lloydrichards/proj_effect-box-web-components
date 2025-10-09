import { type Atom, Registry, Result } from "@effect-atom/atom";
import * as Array from "effect/Array";
import * as Cause from "effect/Cause";
import * as Chunk from "effect/Chunk";
import { pipe } from "effect/Function";
import { globalValue } from "effect/GlobalValue";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import type { LitElement, TemplateResult } from "lit";

type Constructor<T = object> = abstract new (...args: any[]) => T;

// Type-safe metadata interfaces with generic type parameters
declare global {
  export type AtomPropertyKey<A = any> = {
    readonly key: string | symbol;
    readonly atom: Atom.Atom<A>;
  };
}

const globalRegistry: Registry.Registry = globalValue(
  "@effect-box-web-components/atomMixin/registry",
  () =>
    Registry.make({
      scheduleTask: (f) => queueMicrotask(f),
      timeoutResolution: 1000,
      defaultIdleTTL: 30_000,
    }),
);

export type MatchResultOptions<A, E> = {
  onInitial?: () => TemplateResult | string | null;
  onSuccess: (
    value: A,
    result: Result.Success<A, E>,
  ) => TemplateResult | string | null;
  onFailure?: (
    error: E,
    result: Result.Failure<A, E>,
  ) => TemplateResult | string | null;
  onWaiting?: (result: Result.Result<A, E>) => TemplateResult | string | null;
};

const ATOM_PROPERTY_KEYS = Symbol("atomPropertyKeys");
const ATOM_SUBSCRIPTIONS = Symbol("atomSubscriptions");

type AtomMetadataConstructor = {
  [ATOM_PROPERTY_KEYS]?: ReadonlyArray<AtomPropertyKey<any>>;
};

export interface IAtomMixin {
  useAtom<R, W>(
    atom: Atom.Writable<R, W>,
  ): readonly [value: R, setValue: (value: W | ((prev: R) => W)) => void];
  useAtomValue<A>(atom: Atom.Atom<A>): A;
  useAtomSet<R, W>(
    atom: Atom.Writable<R, W>,
  ): (value: W | ((prev: R) => W)) => void;
  useAtomPromise<A, E>(
    atom: Atom.Atom<Result.Result<A, E>>,
    options?: { readonly suspendOnWaiting?: boolean },
  ): Promise<A>;
  useAtomRefresh<A>(atom: Atom.Atom<A>): () => void;
  useAtomMount<A>(atom: Atom.Atom<A>): void;
  getAtomRegistry(): Registry.Registry;
}

const getAtomMetadata = (ctor: Function) => ctor as AtomMetadataConstructor;

/**
 * Mixin that integrates Effect-atom with Lit components
 * @template T - The base class type that extends LitElement
 */
export const AtomMixin = <T extends Constructor<LitElement>>(superClass: T) => {
  abstract class AtomMixinClass extends superClass implements IAtomMixin {
    protected [ATOM_SUBSCRIPTIONS]: HashMap.HashMap<
      Atom.Atom<any>,
      () => void
    > = HashMap.empty();

    connectedCallback() {
      super.connectedCallback();
      this._subscribeToAtoms();
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this._unsubscribeFromAtoms();
    }

    protected _subscribeToAtoms() {
      const registry = globalRegistry;
      const ctor = getAtomMetadata(this.constructor);

      // Helper to subscribe to an atom and store the unsubscribe function
      const subscribeToAtom = <A>(
        atom: Atom.Atom<A>,
        handler: (value: A) => void,
      ): void => {
        const unsubscribe = registry.subscribe(atom, handler, {
          immediate: true,
        });
        this[ATOM_SUBSCRIPTIONS] = HashMap.set(
          this[ATOM_SUBSCRIPTIONS],
          atom,
          unsubscribe,
        );
      };

      // Helper to update instance property
      const updateProperty = <V>(key: string | symbol, value: V): void => {
        Reflect.set(this, key, value);
        this.requestUpdate(key);
      };

      // Subscribe to read-only atoms
      pipe(
        Option.fromNullable(ctor[ATOM_PROPERTY_KEYS]),
        Option.map(
          Array.forEach(({ key, atom }) => {
            subscribeToAtom(atom, (value) => {
              updateProperty(key, value);
            });
          }),
        ),
      );
    }

    protected _unsubscribeFromAtoms() {
      HashMap.forEach(this[ATOM_SUBSCRIPTIONS], (unsubscribe) => unsubscribe());
      this[ATOM_SUBSCRIPTIONS] = HashMap.empty();
    }

    protected _isSubscribed<A>(atom: Atom.Atom<A>): boolean {
      return HashMap.has(this[ATOM_SUBSCRIPTIONS], atom);
    }

    useAtom<R, W>(
      atom: Atom.Writable<R, W>,
    ): readonly [value: R, setValue: (value: W | ((prev: R) => W)) => void] {
      if (!this._isSubscribed(atom)) {
        console.error(
          `[AtomMixin] Attempted to use an atom that is not subscribed:`,
          atom,
        );
        throw new Error("Atom not subscribed");
      }

      const value = globalRegistry.get(atom);
      const setValue = (newValue: W | ((prev: R) => W)) => {
        const valueToSet =
          typeof newValue === "function"
            ? (newValue as (prev: R) => W)(globalRegistry.get(atom))
            : newValue;
        globalRegistry.set(atom, valueToSet);
      };

      return [value, setValue] as const;
    }

    useAtomValue<A>(atom: Atom.Atom<A>): A {
      if (!this._isSubscribed(atom)) {
        console.error(
          `[AtomMixin] Attempted to use an atom that is not subscribed:`,
          atom,
        );
        throw new Error("Atom not subscribed");
      }

      return globalRegistry.get(atom);
    }

    useAtomSet<R, W>(
      atom: Atom.Writable<R, W>,
    ): (value: W | ((prev: R) => W)) => void {
      if (!this._isSubscribed(atom)) {
        console.error(
          `[AtomMixin] Attempted to use an atom that is not subscribed:`,
          atom,
        );
        throw new Error("Atom not subscribed");
      }

      return (newValue: W | ((prev: R) => W)) => {
        const valueToSet =
          typeof newValue === "function"
            ? (newValue as (prev: R) => W)(globalRegistry.get(atom))
            : newValue;
        globalRegistry.set(atom, valueToSet);
      };
    }

    useAtomPromise<A, E>(
      atom: Atom.Atom<Result.Result<A, E>>,
      options?: { readonly suspendOnWaiting?: boolean },
    ): Promise<A> {
      if (!this._isSubscribed(atom)) {
        console.error(
          `[AtomMixin] Attempted to use an atom that is not subscribed:`,
          atom,
        );
        throw new Error("Atom not subscribed");
      }

      const suspendOnWaiting = options?.suspendOnWaiting ?? false;

      return new Promise<A>((resolve, reject) => {
        const checkAndResolve = (result: Result.Result<A, E>) => {
          if (Result.isInitial(result)) return;
          if (suspendOnWaiting && Result.isWaiting(result)) return;

          if (Result.isSuccess(result)) {
            resolve(result.value);
          } else if (Result.isFailure(result)) {
            const error = pipe(
              Chunk.head(Cause.failures(result.cause)),
              Option.getOrElse(() => result.cause as E),
            );
            reject(error);
          }
        };

        const current = globalRegistry.get(atom);
        checkAndResolve(current);

        const unsubscribe = globalRegistry.subscribe(atom, checkAndResolve);
        setTimeout(unsubscribe, 30000);
      });
    }

    useAtomRefresh<A>(atom: Atom.Atom<A>): () => void {
      if (!this._isSubscribed(atom)) {
        console.error(
          `[AtomMixin] Attempted to use an atom that is not subscribed:`,
          atom,
        );
        throw new Error("Atom not subscribed");
      }

      return () => {
        globalRegistry.refresh(atom);
      };
    }

    useAtomMount<A>(atom: Atom.Atom<A>): void {
      const registry = globalRegistry;
      const subscribeToAtom = <T>(
        atom: Atom.Atom<T>,
        handler: (value: T) => void,
      ): void => {
        const unsubscribe = registry.subscribe(atom, handler, {
          immediate: true,
        });
        this[ATOM_SUBSCRIPTIONS] = HashMap.set(
          this[ATOM_SUBSCRIPTIONS],
          atom,
          unsubscribe,
        );
      };

      if (!this._isSubscribed(atom)) {
        subscribeToAtom(atom, () => {
          this.requestUpdate();
        });
        registry.mount(atom);
      }
    }

    getAtomRegistry(): Registry.Registry {
      return globalRegistry;
    }
  }

  return AtomMixinClass;
};

/**
 * Decorator to bind an atom to a component property
 */
export const atomProperty =
  <A>(atom: Atom.Atom<A>) =>
  <T extends object>(
    target: T,
    propertyKey: string | symbol,
    _descriptor?: PropertyDescriptor,
  ): void => {
    const ctor = getAtomMetadata(target.constructor);
    const currentKeys = ctor[ATOM_PROPERTY_KEYS] ?? [];

    const exists = pipe(
      Array.findFirst(currentKeys, (k) => k.key === propertyKey),
      Option.isSome,
    );

    if (!exists) {
      ctor[ATOM_PROPERTY_KEYS] = Array.append(currentKeys, {
        key: propertyKey,
        atom,
      });
    }
  };

/**
 * Pattern match on a Result to render different UI for each state
 */
export const matchResult = <A, E>(
  result: Result.Result<A, E>,
  options: MatchResultOptions<A, E>,
): TemplateResult | string | null =>
  pipe(
    Option.fromNullable(
      Result.isWaiting(result) && options.onWaiting
        ? options.onWaiting(result)
        : null,
    ),
    Option.orElse(() =>
      pipe(
        Option.liftPredicate(result, (r) => Result.isInitial(r)),
        Option.flatMap(() => Option.fromNullable(options.onInitial?.())),
      ),
    ),
    Option.orElse(() =>
      pipe(
        Option.liftPredicate(result, (r) => Result.isSuccess(r)),
        Option.map((r) => options.onSuccess(r.value, r)),
      ),
    ),
    Option.orElse(() =>
      pipe(
        Option.liftPredicate(result, (r) => Result.isFailure(r)),
        Option.flatMap((r) =>
          pipe(
            Option.fromNullable(options.onFailure),
            Option.map((handler) => {
              const error = pipe(
                Chunk.head(Cause.failures(r.cause)),
                Option.getOrElse(() => r.cause as E),
              );
              return handler(error, r);
            }),
          ),
        ),
      ),
    ),
    Option.getOrNull,
  );
