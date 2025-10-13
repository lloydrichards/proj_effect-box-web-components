# Effect-Atom Web Components

A deep-dive into the integration of [Effect](https://effect.website/) with
[Lit](https://lit.dev/) web components using the
[Effect-Atom](https://github.com/tim-smart/effect-atom) state management
library. Building a suite of web-components that leverage Effect for building
applications on the client-side

## Project Structure

```
lib/
├── components/          # Web component examples
│   ├── ui/              # Reusable UI components
│   ├── atom-counter.ts
│   ├── atom-stream-counter.ts
│   ├── scoped-counter.ts
│   └── atom-secrets.ts
├── shared/
│   ├── atomMixin.ts     # Core AtomMixin implementation
│   ├── tailwindMixin.ts # Tailwind CSS integration
│   └── utils.ts         # Shared utilities
└── main.ts              # Entry point
```

## Getting Started

```bash
bun install

# Start dev server
bun run dev

# Build library
bun run build

# Type check
bun run type-check

# Lint & format
bun run lint
bun run format
```

## Quick Start

### 1. Create an Atom

Atoms are reactive containers for state. Use `Atom.fn` to create atoms that
execute Effect programs:

```typescript
import { Atom, Result } from "@effect-atom/atom";
import { Effect, Data } from "effect";

class CountError extends Data.TaggedError("CountError")<{ message: string }> {}

// Create a writable atom that runs an Effect
const countAtom = Atom.fn(
  (newValue: number) =>
    Effect.gen(function* () {
      if (newValue < 0) {
        return yield* new CountError({ message: "Count must be non-negative" });
      }
      yield* Effect.sleep("100 millis");
      return newValue;
    }),
  { initialValue: 0 }
);
```

### 2. Use AtomMixin in Your Component

The `AtomMixin` provides the bridge between Effect-Atom and Lit components:

```typescript
import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { AtomMixin, atomState } from "./shared/atomMixin";

@customElement("my-counter")
export class MyCounter extends AtomMixin(LitElement) {
  // Automatically sync atom state to component property
  @atomState(countAtom) declare count: Result.Result<number, CountError>;

  render() {
    return html`
      <div>
        <button @click=${this._increment}>Increment</button>
        <p>Count: ${Result.isSuccess(this.count) ? this.count.value : 0}</p>
      </div>
    `;
  }

  private _increment() {
    const setCount = this.useAtomSet(countAtom);
    const current = Result.isSuccess(this.count) ? this.count.value : 0;
    setCount(current + 1);
  }
}
```

## Core Concepts

### AtomMixin

The `AtomMixin` is a Lit mixin that adds reactive atom capabilities to your
components. It provides several methods for working with atoms:

#### `useAtom<R, W>(atom)`

Get both value and setter for a writable atom:

```typescript
const [count, setCount] = this.useAtom(countAtom);
setCount(5); // Set directly
setCount((prev) => prev + 1); // Update based on previous value
```

#### `useAtomValue<A>(atom)`

Read-only access to an atom's value:

```typescript
const count = this.useAtomValue(countAtom);
```

#### `useAtomSet<R, W>(atom)`

Get just the setter function without reading the value:

```typescript
const setCount = this.useAtomSet(countAtom);
setCount(10);
```

#### `useAtomPromise<A, E>(atom)`

Convert a Result atom into a Promise:

```typescript
const data = await this.useAtomPromise(dataAtom);
```

#### `useAtomRefresh<A>(atom)`

Get a function to manually refresh an atom:

```typescript
const refresh = this.useAtomRefresh(dataAtom);
refresh(); // Re-evaluate the atom
```

#### `useAtomMount<A>(atom, options?)`

Explicitly mount an atom with optional reactivity keys:

```typescript
this.useAtomMount(dataAtom, { reactivityKeys: ["user", "settings"] });
```

#### `invalidate(keys)`

Manually refresh atoms associated with specific reactivity keys:

```typescript
this.invalidate(["user"]); // Refresh all atoms tagged with "user"
```

### @atomState Decorator

The `@atomState` decorator automatically syncs atom values to component
properties and triggers re-renders on changes:

```typescript
@atomState(myAtom) declare myValue: number;
@atomState(resultAtom) declare myResult: Result.Result<string, Error>;
```

It uses Lit's `@state()` internally, making the property reactive but private
(not exposed as an HTML attribute).

### Result Pattern

Effect-Atom's `Result<A, E>` type represents async operations with four states:

- **Initial** - Not yet executed
- **Waiting** - In progress
- **Success** - Completed successfully with value `A`
- **Failure** - Failed with error `E`

Use the `matchResult` helper to handle all states:

```typescript
import { matchResult } from "./shared/atomMixin";

render() {
  return matchResult(this.result, {
    onInitial: () => html`<span>Not started</span>`,
    onWaiting: () => html`<span>Loading...</span>`,
    onSuccess: (value) => html`<span>Value: ${value}</span>`,
    onFailure: (error) => html`<span>Error: ${error.message}</span>`,
  });
}
```

### Global vs Scoped State

**Global Registry (default)** - Share state across all component instances:

```typescript
const countAtom = Atom.make(0);

// Both instances share the same count
@customElement("counter-a")
class CounterA extends AtomMixin(LitElement) {}

@customElement("counter-b")
class CounterB extends AtomMixin(LitElement) {}
```

**Scoped Registry** - Isolate state per component instance or component tree:

```typescript
import { Registry } from "@effect-atom/atom";

const scopedRegistry = Registry.make({
  scheduleTask: (f) => queueMicrotask(f),
  timeoutResolution: 1000,
  defaultIdleTTL: 30_000,
});

const scopedAtom = Atom.make(0);

// Each instance has its own independent count
@customElement("isolated-counter")
class IsolatedCounter extends AtomMixin(LitElement, scopedRegistry) {
  @atomState(scopedAtom) declare count: number;
}
```

## Learn More

- [Effect Documentation](https://effect.website/docs/introduction)
- [Effect-Atom](https://github.com/tim-smart/effect-atom)
- [Lit Documentation](https://lit.dev/)
