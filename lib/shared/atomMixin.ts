import { Atom, Registry, Result } from "@effect-atom/atom";
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
  getAtom<A>(key: string | symbol): Option.Option<Atom.Atom<A>>;
  setAtom<A>(key: string | symbol, value: A): Option.Option<void>;
  getAtomValue<A>(key: string | symbol): Option.Option<A>;
  getAtomRegistry(): Registry.Registry;
}

const getAtomMetadata = (ctor: Function) => ctor as AtomMetadataConstructor;

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
        handler: (value: A) => void,
      ): void => {
        const unsubscribe = registry.subscribe(atom, handler, {
          immediate: true,
        });
        this[ATOM_SUBSCRIPTIONS] = HashMap.set(
          this[ATOM_SUBSCRIPTIONS],
          key,
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
            subscribeToAtom(key, atom, (value) => {
              updateProperty(key, value);
            });
          }),
        ),
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
          readonly atom: Atom.Atom<A>;
        },
      >(
        arr: ReadonlyArray<T> | undefined,
      ): Option.Option<Atom.Atom<A>> =>
        pipe(
          Option.fromNullable(arr),
          Option.flatMap((keys) =>
            pipe(
              Array.findFirst(keys, (p) => p.key === key),
              Option.map((p) => p.atom as Atom.Atom<A>),
            ),
          ),
        );

      return pipe(findAtomByKey(ctor[ATOM_PROPERTY_KEYS]));
    }

    setAtom<A>(key: string | symbol, value: A): Option.Option<void> {
      return pipe(
        this.getAtom<A>(key),
        Option.filter(Atom.isWritable),
        Option.map((atom) => globalRegistry.set(atom, value)),
      );
    }

    getAtomValue<A>(key: string | symbol): Option.Option<A> {
      return pipe(
        this.getAtom<A>(key),
        Option.map((atom) => globalRegistry.get(atom)),
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
