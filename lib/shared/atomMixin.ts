import { Atom, Registry, Result } from "@effect-atom/atom";
import type { TemplateResult } from "lit";
import type { LitElement } from "lit";
import { globalValue } from "effect/GlobalValue";
import * as Option from "effect/Option";
import * as HashMap from "effect/HashMap";
import * as Array from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Cause from "effect/Cause";
import { pipe } from "effect/Function";

type Constructor<T = object> = abstract new (...args: any[]) => T;

// Type-safe metadata interfaces with generic type parameters
declare global {
  export type AtomPropertyKey<A = any> = {
    readonly key: string | symbol;
    readonly atom: Atom.Atom<A>;
  };
  export type WritableAtomPropertyKey<R = any, W = R> = {
    readonly key: string | symbol;
    readonly atom: Atom.Writable<R, W>;
  };
  export type ResultAtomPropertyKey<A = any, E = never> = {
    readonly key: string | symbol;
    readonly atom: Atom.Atom<Result.Result<A, E>>;
  };
}

const globalRegistry: Registry.Registry = globalValue(
  "@effect-box-web-components/atomMixin/registry",
  () =>
    Registry.make({
      scheduleTask: (f) => queueMicrotask(f),
      timeoutResolution: 1000,
      defaultIdleTTL: 30_000,
    })
);

export type MatchResultOptions<A, E> = {
  onInitial?: () => TemplateResult | string | null;
  onSuccess: (
    value: A,
    result: Result.Success<A, E>
  ) => TemplateResult | string | null;
  onFailure?: (
    error: E,
    result: Result.Failure<A, E>
  ) => TemplateResult | string | null;
  onWaiting?: (result: Result.Result<A, E>) => TemplateResult | string | null;
};

const ATOM_PROPERTY_KEYS = Symbol("atomPropertyKeys");
const WRITABLE_ATOM_PROPERTY_KEYS = Symbol("writableAtomPropertyKeys");
const RESULT_ATOM_PROPERTY_KEYS = Symbol("resultAtomPropertyKeys");
const ATOM_SUBSCRIPTIONS = Symbol("atomSubscriptions");

type AtomMetadataConstructor = {
  [ATOM_PROPERTY_KEYS]?: ReadonlyArray<AtomPropertyKey<any>>;
  [WRITABLE_ATOM_PROPERTY_KEYS]?: ReadonlyArray<
    WritableAtomPropertyKey<any, any>
  >;
  [RESULT_ATOM_PROPERTY_KEYS]?: ReadonlyArray<ResultAtomPropertyKey<any, any>>;
};

export interface IAtomMixin {
  getAtom<A>(key: string | symbol): Option.Option<Atom.Atom<A>>;
  setAtom<A>(key: string | symbol, value: A): Option.Option<void>;
  getAtomValue<A>(key: string | symbol): Option.Option<A>;
  getAtomRegistry(): Registry.Registry;
}

const getAtomMetadata = (ctor: Function): AtomMetadataConstructor =>
  ctor as AtomMetadataConstructor;

/**
 * Mixin that integrates Effect-atom with Lit components
 * @template T - The base class type that extends LitElement
 */
export const AtomMixin = <T extends Constructor<LitElement>>(superClass: T) => {
  abstract class AtomMixinClass extends superClass implements IAtomMixin {
    private [ATOM_SUBSCRIPTIONS]: HashMap.HashMap<string | symbol, () => void> =
      HashMap.empty();

    connectedCallback() {
      super.connectedCallback();
      this._subscribeToAtoms();
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      this._unsubscribeFromAtoms();
    }

    private _subscribeToAtoms() {
      const registry = globalRegistry;
      const ctor = getAtomMetadata(this.constructor);

      // Helper to subscribe to an atom and store the unsubscribe function
      const subscribeToAtom = <A>(
        key: string | symbol,
        atom: Atom.Atom<A>,
        handler: (value: A) => void
      ): void => {
        const unsubscribe = registry.subscribe(atom, handler, {
          immediate: true,
        });
        this[ATOM_SUBSCRIPTIONS] = HashMap.set(
          this[ATOM_SUBSCRIPTIONS],
          key,
          unsubscribe
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
          Array.map(({ key, atom }) => {
            subscribeToAtom(key, atom, (value) => {
              updateProperty(key, value);
            });
          })
        )
      );

      // Subscribe to writable atoms
      pipe(
        Option.fromNullable(ctor[WRITABLE_ATOM_PROPERTY_KEYS]),
        Option.map(
          Array.map(({ key, atom }) => {
            subscribeToAtom(key, atom, (value) => {
              updateProperty(key, value);
            });
          })
        )
      );

      // Subscribe to Result atoms
      pipe(
        Option.fromNullable(ctor[RESULT_ATOM_PROPERTY_KEYS]),
        Option.map(
          Array.map(({ key, atom }) => {
            subscribeToAtom(key, atom, (result) => {
              updateProperty(key, result);
            });
          })
        )
      );
    }

    private _unsubscribeFromAtoms() {
      HashMap.forEach(this[ATOM_SUBSCRIPTIONS], (unsubscribe) => unsubscribe());
      this[ATOM_SUBSCRIPTIONS] = HashMap.empty();
    }

    getAtom<A>(key: string | symbol): Option.Option<Atom.Atom<A>> {
      const ctor = getAtomMetadata(this.constructor);

      // Helper to find atom in array by key with proper type narrowing
      const findAtomByKey = <
        T extends {
          readonly key: string | symbol;
          readonly atom: Atom.Atom<any>;
        }
      >(
        arr: ReadonlyArray<T> | undefined
      ): Option.Option<Atom.Atom<A>> =>
        pipe(
          Option.fromNullable(arr),
          Option.flatMap((keys) =>
            pipe(
              Array.findFirst(keys, (p) => p.key === key),
              Option.map((p) => p.atom as Atom.Atom<A>)
            )
          )
        );

      return pipe(
        findAtomByKey(ctor[ATOM_PROPERTY_KEYS]),
        Option.orElse(() => findAtomByKey(ctor[WRITABLE_ATOM_PROPERTY_KEYS])),
        Option.orElse(() => findAtomByKey(ctor[RESULT_ATOM_PROPERTY_KEYS]))
      );
    }

    setAtom<A>(key: string | symbol, value: A): Option.Option<void> {
      return pipe(
        this.getAtom<A>(key),
        Option.filter(Atom.isWritable),
        Option.map((atom) => {
          globalRegistry.set(atom, value);
        })
      );
    }

    getAtomValue<A>(key: string | symbol): Option.Option<A> {
      return pipe(
        this.getAtom<A>(key),
        Option.map((atom) => globalRegistry.get(atom))
      );
    }

    getAtomRegistry(): Registry.Registry {
      return globalRegistry;
    }
  }

  return AtomMixinClass as Constructor<IAtomMixin> & T;
};

/**
 * Decorator to bind a read-only atom to a component property
 */
export const atomProperty =
  <A>(atom: Atom.Atom<A>) =>
  <T extends object>(
    target: T,
    propertyKey: string | symbol,
    _descriptor?: PropertyDescriptor
  ): void => {
    const constructor = getAtomMetadata(target.constructor);
    const currentKeys = constructor[ATOM_PROPERTY_KEYS] ?? [];

    const exists = pipe(
      Array.findFirst(currentKeys, (k) => k.key === propertyKey),
      Option.isSome
    );

    if (!exists) {
      constructor[ATOM_PROPERTY_KEYS] = Array.append(currentKeys, {
        key: propertyKey,
        atom,
      });
    }
  };

/**
 * Decorator to bind a writable atom to a component property
 */
export const writableAtomProperty =
  <R, W = R>(atom: Atom.Writable<R, W>) =>
  <T extends object>(
    target: T,
    propertyKey: string | symbol,
    _descriptor?: PropertyDescriptor
  ): void => {
    const constructor = getAtomMetadata(target.constructor);
    const currentKeys = constructor[WRITABLE_ATOM_PROPERTY_KEYS] ?? [];

    // Check if already exists
    const exists = pipe(
      Array.findFirst(currentKeys, (k) => k.key === propertyKey),
      Option.isSome
    );

    if (!exists) {
      constructor[WRITABLE_ATOM_PROPERTY_KEYS] = Array.append(currentKeys, {
        key: propertyKey,
        atom,
      });
    }
  };

/**
 * Decorator to bind a Result atom to a component property
 */
export const resultAtomProperty =
  <A, E = never>(atom: Atom.Atom<Result.Result<A, E>>) =>
  <T extends object>(
    target: T,
    propertyKey: string | symbol,
    _descriptor?: PropertyDescriptor
  ): void => {
    const constructor = getAtomMetadata(target.constructor);
    const currentKeys = constructor[RESULT_ATOM_PROPERTY_KEYS] ?? [];

    // Check if already exists
    const exists = pipe(
      Array.findFirst(currentKeys, (k) => k.key === propertyKey),
      Option.isSome
    );

    if (!exists) {
      constructor[RESULT_ATOM_PROPERTY_KEYS] = Array.append(currentKeys, {
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
  options: MatchResultOptions<A, E>
): TemplateResult | string | null =>
  pipe(
    Option.fromNullable(
      Result.isWaiting(result) && options.onWaiting
        ? options.onWaiting(result)
        : null
    ),
    Option.orElse(() =>
      pipe(
        Option.liftPredicate(result, (r) => Result.isInitial(r)),
        Option.flatMap(() => Option.fromNullable(options.onInitial?.()))
      )
    ),
    Option.orElse(() =>
      pipe(
        Option.liftPredicate(result, (r) => Result.isSuccess(r)),
        Option.map((r) => options.onSuccess(r.value, r))
      )
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
                Option.getOrElse(() => r.cause as E)
              );
              return handler(error, r);
            })
          )
        )
      )
    ),
    Option.getOrNull
  );
