import * as Array from "effect/Array";
import * as Cause from "effect/Cause";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import {
  AsyncResult,
  type Atom,
  AtomRegistry,
} from "effect/unstable/reactivity";
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

const registryCache = new WeakMap<object, AtomRegistry.AtomRegistry>();

const getDefaultRegistry = (): AtomRegistry.AtomRegistry => {
  const key = globalThis as object;
  const existing = registryCache.get(key);
  if (existing) return existing;

  const created = AtomRegistry.make({
    scheduleTask: (f: () => void) => {
      queueMicrotask(f);
      return () => undefined;
    },
    timeoutResolution: 1000,
    defaultIdleTTL: 30_000,
  });

  registryCache.set(key, created);
  return created;
};

export type MatchResultOptions<A, E> = {
  onInitial?: () => TemplateResult | string | null;
  onSuccess: (
    value: A,
    result: AsyncResult.Success<A, E>,
  ) => TemplateResult | string | null;
  onFailure?: (
    error: E,
    result: AsyncResult.Failure<A, E>,
  ) => TemplateResult | string | null;
  onWaiting?: (
    result: AsyncResult.AsyncResult<A, E>,
  ) => TemplateResult | string | null;
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
    atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
    options?: { readonly suspendOnWaiting?: boolean },
  ): Promise<A>;
  useAtomRefresh<A>(atom: Atom.Atom<A>): () => void;
  useAtomMount<A>(
    atom: Atom.Atom<A>,
    options?: { readonly reactivityKeys?: readonly string[] },
  ): void;
  invalidate(keys: readonly string[]): void;
  getAtomRegistry(): AtomRegistry.AtomRegistry;
}

// biome-ignore lint/complexity/noBannedTypes: Function type needed for constructor property
const getAtomMetadata = (ctor: Function) => ctor as AtomMetadataConstructor;

export const AtomMixin = <T extends Constructor<LitElement>>(
  superClass: T,
  registry?: AtomRegistry.AtomRegistry,
) => {
  const globalRegistry = registry ?? getDefaultRegistry();
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
        Option.fromNullishOr(ctor[ATOM_PROPERTY_KEYS]),
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

    /**
     * Subscribe to a writable atom and get both its value and a setter function.
     * Auto-subscribes the component to atom updates, triggering re-renders when the atom changes.
     */
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

    /**
     * Subscribe to an atom and get its current value.
     * Auto-subscribes the component to atom updates, triggering re-renders when the atom changes.
     * Use this when you only need to read the atom value, not update it.
     */
    useAtomValue<A>(atom: Atom.Atom<A>): A {
      this._autoSubscribe(atom);
      return globalRegistry.get(atom);
    }

    /**
     * Get a setter function for a writable atom without reading its value.
     * Auto-subscribes the component to atom updates. Use this when you only need
     * to update the atom but don't need its current value in the render.
     */
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

    /**
     * Convert an AsyncResult atom into a Promise that resolves with the success value.
     * Auto-subscribes the component to atom updates. The promise resolves when the
     * AsyncResult becomes successful, or rejects when it fails.
     */
    useAtomPromise<A, E>(
      atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
      options?: { readonly suspendOnWaiting?: boolean },
    ): Promise<A> {
      this._autoSubscribe(atom);

      const suspendOnWaiting = options?.suspendOnWaiting ?? false;

      return new Promise<A>((resolve, reject) => {
        const checkAndResolve = (result: AsyncResult.AsyncResult<A, E>) => {
          if (AsyncResult.isInitial(result)) return;
          if (suspendOnWaiting && AsyncResult.isWaiting(result)) return;

          if (AsyncResult.isSuccess(result)) {
            resolve(result.value);
          } else if (AsyncResult.isFailure(result)) {
            const error = this._getFailureError(result.cause);
            reject(error);
          }
        };

        const current = globalRegistry.get(atom);
        checkAndResolve(current);

        const unsubscribe = globalRegistry.subscribe(atom, checkAndResolve);
        setTimeout(unsubscribe, 30000);
      });
    }

    /**
     * Get a function that refreshes (re-evaluates) an atom.
     * Auto-subscribes the component to atom updates. Useful for atoms that
     * derive their value from effects or computations.
     */
    useAtomRefresh<A>(atom: Atom.Atom<A>): () => void {
      this._autoSubscribe(atom);

      return () => {
        globalRegistry.refresh(atom);
      };
    }

    /**
     * Subscribe to an atom and mount it in the registry.
     * Use this in connectedCallback() or firstUpdated() for atoms that need to be
     * explicitly mounted. Subscribes the component to updates and calls registry.mount().
     */
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

    /**
     * Manually invalidate (refresh) all atoms associated with the given reactivity keys.
     * Use this to trigger selective updates when certain data changes.
     */
    invalidate(keys: readonly string[]): void {
      const registry = globalRegistry;

      for (const key of keys) {
        const atoms = HashMap.get(this[REACTIVITY_KEYS], key);
        pipe(
          atoms,
          Option.map((atomSet) => {
            for (const atom of atomSet) {
              registry.refresh(atom);
            }
            return atomSet;
          }),
        );
      }
    }

    private _getFailureError<E>(cause: Cause.Cause<E>): E {
      return pipe(
        Cause.findErrorOption(cause),
        Option.getOrElse(() => cause as E),
      );
    }

    /**
     * Get direct access to the underlying Atom Registry.
     * Use this for advanced operations or when you need to work with the registry directly.
     */
    getAtomRegistry(): AtomRegistry.AtomRegistry {
      return globalRegistry;
    }
  }

  return AtomMixinClass;
};

/**
 * Decorator that synchronizes an Atom value with a Lit component's internal reactive state.
 *
 * This decorator creates private reactive state (using `@state()` internally) that automatically
 * subscribes to an Atom and updates the component when the Atom's value changes. It follows
 * Lit's `@state()` convention for internal component state rather than `@property()` which
 * would expose the value as a public API with attribute binding.
 *
 * The decorated property will be automatically updated whenever the Atom value changes,
 * triggering a component re-render. The subscription is managed by the AtomMixin lifecycle,
 * subscribing on `connectedCallback()` and unsubscribing on `disconnectedCallback()`.
 *
 * @example
 * Basic usage with a simple atom:
 * ```ts
 * const countAtom = Atom.make(0);
 *
 * @customElement("my-counter")
 * export class MyCounter extends AtomMixin(LitElement) {
 *   @atomState(countAtom) declare count: number;
 *
 *   render() {
 *     return html`<div>Count: ${this.count}</div>`;
 *   }
 * }
 * ```
 */
export const atomState =
  <A>(
    atom: Atom.Atom<A>,
    options?: { readonly reactivityKeys?: readonly string[] },
  ) =>
  <T extends object>(
    target: T,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor,
  ): void => {
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
  result: AsyncResult.AsyncResult<A, E>,
  options: MatchResultOptions<A, E>,
): TemplateResult | string | null =>
  pipe(
    Option.fromNullishOr(
      AsyncResult.isWaiting(result) && options.onWaiting
        ? options.onWaiting(result)
        : null,
    ),
    Option.orElse(() =>
      pipe(
        Option.liftPredicate(result, (r) => AsyncResult.isInitial(r)),
        Option.flatMap(() => Option.fromNullishOr(options.onInitial?.())),
      ),
    ),
    Option.orElse(() =>
      pipe(
        Option.liftPredicate(result, (r) => AsyncResult.isSuccess(r)),
        Option.map((r) => options.onSuccess(r.value, r)),
      ),
    ),
    Option.orElse(() =>
      pipe(
        Option.liftPredicate(result, (r) => AsyncResult.isFailure(r)),
        Option.flatMap((r) =>
          pipe(
            Option.fromNullishOr(options.onFailure),
            Option.map((handler) => {
              const error = pipe(
                Cause.findErrorOption(r.cause),
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
