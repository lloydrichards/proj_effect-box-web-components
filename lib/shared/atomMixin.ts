import { type Atom, Registry, Result } from "@effect-atom/atom";
import * as Array from "effect/Array";
import * as Cause from "effect/Cause";
import * as Chunk from "effect/Chunk";
import { pipe } from "effect/Function";
import { globalValue } from "effect/GlobalValue";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import type { LitElement, TemplateResult } from "lit";
import { state } from "lit/decorators.js";

// biome-ignore lint/suspicious/noExplicitAny: Required for mixin pattern compatibility
type Constructor<T = object> = abstract new (...args: any[]) => T;

const ATOM_PROPERTY_KEYS = Symbol("atomPropertyKeys");
const ATOM_SUBSCRIPTIONS = Symbol("atomSubscriptions");
const REACTIVITY_KEYS = Symbol("reactivityKeys");

declare global {
  export type AtomPropertyKey<A = unknown> = {
    readonly key: string | symbol;
    readonly atom: Atom.Atom<A>;
    readonly reactivityKeys?: readonly string[];
  };

  export type ReactivityKeyMap = {
    readonly keys: HashSet.HashSet<string>;
    readonly atoms: HashSet.HashSet<Atom.Atom<unknown>>;
  };
}

const defaultGlobalRegistry: Registry.Registry = globalValue(
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

type AtomMetadataConstructor = {
  [ATOM_PROPERTY_KEYS]?: ReadonlyArray<AtomPropertyKey<unknown>>;
  [REACTIVITY_KEYS]?: HashMap.HashMap<
    string,
    HashSet.HashSet<Atom.Atom<unknown>>
  >;
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
  useAtomMount<A>(
    atom: Atom.Atom<A>,
    options?: { readonly reactivityKeys?: readonly string[] },
  ): void;
  invalidate(keys: readonly string[]): void;
  getAtomRegistry(): Registry.Registry;
}

// biome-ignore lint/complexity/noBannedTypes: Function type needed for constructor property
const getAtomMetadata = (ctor: Function) => ctor as AtomMetadataConstructor;

export const AtomMixin = <T extends Constructor<LitElement>>(
  superClass: T,
  registry?: Registry.Registry,
) => {
  const globalRegistry = registry ?? defaultGlobalRegistry;
  abstract class AtomMixinClass extends superClass implements IAtomMixin {
    protected [ATOM_SUBSCRIPTIONS]: HashMap.HashMap<
      Atom.Atom<unknown>,
      () => void
    > = HashMap.empty();

    protected [REACTIVITY_KEYS]: HashMap.HashMap<
      string,
      HashSet.HashSet<Atom.Atom<unknown>>
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

      const subscribeToAtom = <A>(
        atom: Atom.Atom<A>,
        handler: (value: A) => void,
        reactivityKeys?: readonly string[],
      ): Option.Option<() => void> => {
        const unsubscribe = registry.subscribe(
          atom,
          (value) => {
            handler(value);
          },
          {
            immediate: true,
          },
        );

        this[ATOM_SUBSCRIPTIONS] = HashMap.set(
          this[ATOM_SUBSCRIPTIONS],
          atom,
          unsubscribe,
        );

        if (reactivityKeys && reactivityKeys.length > 0) {
          this._registerReactivityKeys(atom, reactivityKeys);
        }

        return Option.some(unsubscribe);
      };

      const updateProperty = <V>(key: string | symbol, value: V): void => {
        Reflect.set(this, key, value);
        this.requestUpdate(key);
      };

      pipe(
        Option.fromNullable(ctor[ATOM_PROPERTY_KEYS]),
        Option.map(
          Array.forEach(({ key, atom, reactivityKeys }) => {
            subscribeToAtom(
              atom,
              (value) => {
                updateProperty(key, value);
              },
              reactivityKeys,
            );
          }),
        ),
      );
    }

    protected _unsubscribeFromAtoms() {
      HashMap.forEach(this[ATOM_SUBSCRIPTIONS], (unsubscribe) => {
        unsubscribe();
      });
      this[ATOM_SUBSCRIPTIONS] = HashMap.empty();
      this[REACTIVITY_KEYS] = HashMap.empty();
    }

    protected _isSubscribed<A>(atom: Atom.Atom<A>): boolean {
      return HashMap.has(this[ATOM_SUBSCRIPTIONS], atom);
    }

    protected _autoSubscribe<A>(atom: Atom.Atom<A>): void {
      if (!this._isSubscribed(atom)) {
        const registry = globalRegistry;
        const unsubscribe = registry.subscribe(
          atom,
          () => {
            this.requestUpdate();
          },
          { immediate: true },
        );

        this[ATOM_SUBSCRIPTIONS] = HashMap.set(
          this[ATOM_SUBSCRIPTIONS],
          atom,
          unsubscribe,
        );
      }
    }

    protected _registerReactivityKeys<A>(
      atom: Atom.Atom<A>,
      keys: readonly string[],
    ): void {
      for (const key of keys) {
        const existing = HashMap.get(this[REACTIVITY_KEYS], key);
        const atomSet = pipe(
          existing,
          Option.map((set) => HashSet.add(set, atom)),
          Option.getOrElse(() => HashSet.make(atom)),
        );
        this[REACTIVITY_KEYS] = HashMap.set(
          this[REACTIVITY_KEYS],
          key,
          atomSet,
        );
      }
    }

    useAtom<R, W>(
      atom: Atom.Writable<R, W>,
    ): readonly [value: R, setValue: (value: W | ((prev: R) => W)) => void] {
      this._autoSubscribe(atom);

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
      this._autoSubscribe(atom);
      return globalRegistry.get(atom);
    }

    useAtomSet<R, W>(
      atom: Atom.Writable<R, W>,
    ): (value: W | ((prev: R) => W)) => void {
      this._autoSubscribe(atom);

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
      this._autoSubscribe(atom);

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
      this._autoSubscribe(atom);

      return () => {
        globalRegistry.refresh(atom);
      };
    }

    useAtomMount<A>(
      atom: Atom.Atom<A>,
      options?: { readonly reactivityKeys?: readonly string[] },
    ): void {
      const registry = globalRegistry;

      if (!this._isSubscribed(atom)) {
        const unsubscribe = registry.subscribe(
          atom,
          () => {
            this.requestUpdate();
          },
          {
            immediate: true,
          },
        );

        this[ATOM_SUBSCRIPTIONS] = HashMap.set(
          this[ATOM_SUBSCRIPTIONS],
          atom,
          unsubscribe,
        );

        if (options?.reactivityKeys && options.reactivityKeys.length > 0) {
          this._registerReactivityKeys(atom, options.reactivityKeys);
        }

        registry.mount(atom);
      }
    }

    invalidate(keys: readonly string[]): void {
      const registry = globalRegistry;

      for (const key of keys) {
        const atoms = HashMap.get(this[REACTIVITY_KEYS], key);
        pipe(
          atoms,
          Option.map((atomSet) => {
            HashSet.forEach(atomSet, (atom) => {
              registry.refresh(atom);
            });
            return atomSet;
          }),
        );
      }
    }

    getAtomRegistry(): Registry.Registry {
      return globalRegistry;
    }
  }

  return AtomMixinClass;
};

export const atomProperty =
  <A>(
    atom: Atom.Atom<A>,
    options?: { readonly reactivityKeys?: readonly string[] },
  ) =>
  <T extends object>(
    target: T,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor,
  ): void => {
    // Apply @state() decorator to mark as reactive internal state
    state()(target, propertyKey, descriptor);

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
        reactivityKeys: options?.reactivityKeys,
      });
    }
  };

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
