import { Atom, Registry, Result } from "@effect-atom/atom";
import type { TemplateResult } from "lit";
import { globalValue } from "effect/GlobalValue";
import * as Option from "effect/Option";
import * as HashMap from "effect/HashMap";
import * as Array from "effect/Array";
import * as Chunk from "effect/Chunk";
import * as Cause from "effect/Cause";
import { pipe } from "effect/Function";

declare global {
  export type AtomPropertyKey = {
    readonly key: string | symbol;
    readonly atom: Atom.Atom<any>;
  };
  export type WritableAtomPropertyKey = {
    readonly key: string | symbol;
    readonly atom: Atom.Writable<any, any>;
  };
  export type ResultAtomPropertyKey = {
    readonly key: string | symbol;
    readonly atom: Atom.Atom<Result.Result<any, any>>;
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

export interface IAtomMixin {
  getAtom<A>(key: string | symbol): Option.Option<Atom.Atom<A>>;
  setAtom<A>(key: string | symbol, value: A): Option.Option<void>;
  getAtomValue<A>(key: string | symbol): Option.Option<A>;
  getAtomRegistry(): Registry.Registry;
}

/**
 * Mixin that integrates Effect-atom with Lit components
 */
export const AtomMixin = <T extends LitMixin>(
  superClass: T
): T & (new (...args: any[]) => IAtomMixin) =>
  class extends superClass {
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

      // Subscribe to read-only atoms
      pipe(
        Option.fromNullable(
          (this.constructor as any)[ATOM_PROPERTY_KEYS] as
            | ReadonlyArray<AtomPropertyKey>
            | undefined
        ),
        Option.map(
          Array.map(({ key, atom }) => {
            subscribeToAtom(key, atom, (value) => {
              (this as any)[key] = value;
              this.requestUpdate(key as PropertyKey);
            });
          })
        )
      );

      // Subscribe to writable atoms
      pipe(
        Option.fromNullable(
          (this.constructor as any)[WRITABLE_ATOM_PROPERTY_KEYS] as
            | ReadonlyArray<WritableAtomPropertyKey>
            | undefined
        ),
        Option.map(
          Array.map(({ key, atom }) => {
            subscribeToAtom(key, atom, (value) => {
              (this as any)[key] = value;
              this.requestUpdate(key as PropertyKey);
            });
          })
        )
      );

      // Subscribe to Result atoms
      pipe(
        Option.fromNullable(
          (this.constructor as any)[RESULT_ATOM_PROPERTY_KEYS] as
            | ReadonlyArray<ResultAtomPropertyKey>
            | undefined
        ),
        Option.map(
          Array.map(({ key, atom }) => {
            subscribeToAtom(key, atom, (result: Result.Result<any, any>) => {
              (this as any)[key] = result;
              this.requestUpdate(key);
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
      // Helper to find atom in array by key
      const findAtomByKey = <
        T extends { readonly key: string | symbol; readonly atom: any }
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
        findAtomByKey((this.constructor as any)[ATOM_PROPERTY_KEYS]),
        Option.orElse(() =>
          findAtomByKey((this.constructor as any)[WRITABLE_ATOM_PROPERTY_KEYS])
        ),
        Option.orElse(() =>
          findAtomByKey((this.constructor as any)[RESULT_ATOM_PROPERTY_KEYS])
        )
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
  };

/**
 * Decorator to bind a read-only atom to a component property
 */
export const atomProperty =
  <A>(atom: Atom.Atom<A>) =>
  (target: any, propertyKey: string | symbol) => {
    const constructor = target.constructor;
    const currentKeys =
      (constructor[ATOM_PROPERTY_KEYS] as
        | ReadonlyArray<AtomPropertyKey>
        | undefined) ?? [];

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
  (target: any, propertyKey: string | symbol) => {
    const currentKeys =
      (target.constructor[WRITABLE_ATOM_PROPERTY_KEYS] as
        | ReadonlyArray<WritableAtomPropertyKey>
        | undefined) ?? [];

    // Check if already exists
    const exists = pipe(
      Array.findFirst(currentKeys, (k) => k.key === propertyKey),
      Option.isSome
    );

    if (!exists) {
      target.constructor[WRITABLE_ATOM_PROPERTY_KEYS] = Array.append(
        currentKeys,
        { key: propertyKey, atom }
      );
    }
  };

/**
 * Decorator to bind a Result atom to a component property
 */
export const resultAtomProperty =
  <A, E = never>(atom: Atom.Atom<Result.Result<A, E>>) =>
  (target: any, propertyKey: string | symbol) => {
    const currentKeys =
      (target.constructor[RESULT_ATOM_PROPERTY_KEYS] as
        | ReadonlyArray<ResultAtomPropertyKey>
        | undefined) ?? [];

    // Check if already exists
    const exists = pipe(
      Array.findFirst(currentKeys, (k) => k.key === propertyKey),
      Option.isSome
    );

    if (!exists) {
      target.constructor[RESULT_ATOM_PROPERTY_KEYS] = Array.append(
        currentKeys,
        { key: propertyKey, atom }
      );
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
