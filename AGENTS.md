# AGENTS.md

> **Note:** This file is the authoritative source for coding agent instructions.
> If in doubt, prefer AGENTS.md over README.md.

## 🚦 Quick Reference

- **Install dependencies:** `bun install`
- **Start dev server:** `bun run dev`
- **Build for production:** `bun run build`
- **Preview build:** `bun run preview`
- **Search code:** `rg "pattern"`
- **Add package:** `bun add <package-name>`

**Note**: Testing with Vitest can be added later.

---

This file provides comprehensive guidance for coding agents when working with
Lit web components and Tailwind CSS v4 in this starter template.

## Core Development Philosophy

### KISS (Keep It Simple, Stupid)

Simplicity should be a key goal in design. Choose straightforward solutions over
complex ones whenever possible. Simple solutions are easier to understand,
maintain, and debug.

### YAGNI (You Aren't Gonna Need It)

Avoid building functionality on speculation. Implement features only when they
are needed, not when you anticipate they might be useful in the future.

### HTML-first

Prioritize HTML structure and semantics in your components. Use native HTML
elements with proper ARIA attributes when needed. Shadow DOM provides
encapsulation, but your markup should still be semantic and accessible.

### Design Principles

- **Component Encapsulation**: Use Shadow DOM for style and DOM isolation
- **Reactive Properties**: Leverage Lit's reactive system for automatic updates
- **Type Safety**: Use TypeScript with decorators for compile-time correctness
- **Single Responsibility**: Each component should have one clear purpose
- **Composability**: Build complex UIs by composing simple, reusable components

## 🧱 Project Structure & Library Architecture

This is a **starter template** for building web component libraries with Lit and
Tailwind CSS v4.

### Directory Structure

```plaintext
.
├── lib/                         # Library source code
│   ├── assets/                  # Static assets (images, icons)
│   ├── components/              # Lit components (*.ts)
│   ├── shared/                  # Shared utilities and mixins
│   │   ├── atomMixin.ts         # Atom state management mixin
│   │   ├── tailwindMixin.ts     # TW mixin for Shadow DOM
│   │   ├── tailwindMixin.d.ts   # Type definitions
│   │   └── utils.ts             # Utility functions (cn, etc.)
│   ├── styles/                  # Global styles
│   │   └── tailwind.global.css  # Tailwind configuration
│   └── main.ts                  # Library entry point
├── src/                         # Development playground
│   ├── index.html               # Dev server entry
│   ├── index.css                # Dev styles
│   └── vite-env.d.ts            # Vite type definitions
├── public/                      # Public assets for dev server
├── dist/                        # Build output (gitignored)
├── vite.config.js               # Vite configuration
├── tsconfig.json                # TypeScript configuration
└── package.json                 # Project dependencies
```

### Build Output

The build produces:

- `dist/my-element.js` - ES module
- `dist/my-element.umd.cjs` - UMD module
- `dist/my-element.d.ts` - TypeScript definitions

### Key Files

- **lib/main.ts**: Export all components here for library consumers
- **lib/shared/atomMixin.ts**: Mixin for Effect-Atom state management in
  components
- **lib/shared/tailwindMixin.ts**: Mixin to apply Tailwind to Shadow DOM
- **lib/shared/utils.ts**: Helper functions like `cn()` for class merging
- **lib/styles/tailwind.global.css**: Tailwind v4 configuration with `@theme`

## Lit & Web Components

### Core Concepts

Lit is a lightweight library for building fast web components. It provides:

- **Reactive properties** that trigger re-renders
- **Efficient rendering** using lit-html templates
- **Shadow DOM** integration for encapsulation
- **Lifecycle hooks** for component behavior

### Component Structure

**TypeScript (Preferred):**

```typescript
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { TW } from "../shared/tailwindMixin";

const TwLitElement = TW(LitElement);

@customElement("my-component")
export class MyComponent extends TwLitElement {
  @property({ type: String }) name = "World";
  @property({ type: Number }) count = 0;

  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`
      <div class="p-4">
        <h1>Hello, ${this.name}!</h1>
        <button
          @click=${this._increment}
          class="bg-blue-500 text-white px-4 py-2"
        >
          Count: ${this.count}
        </button>
      </div>
    `;
  }

  private _increment() {
    this.count++;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "my-component": MyComponent;
  }
}
```

### Reactive Properties

```typescript
@property({ type: String }) name = 'default';
@property({ type: Number }) count = 0;
@property({ type: Boolean, reflect: true }) active = false;
@property({ attribute: false }) data = {};  // No attribute binding
@state() private _internal = '';  // Internal state
```

**Key options**: `type`, `reflect`, `attribute`, `converter`. See
[Lit docs](https://lit.dev/docs/components/properties/) for details.

### Lifecycle & Querying

```typescript
// Lifecycle hooks (always call super first)
connectedCallback() { super.connectedCallback(); }
willUpdate(changedProperties) { }
updated(changedProperties) { }
firstUpdated() { }  // Use for initial DOM access

// Query decorators
@query('#myButton') private button!: HTMLButtonElement;
@queryAll('.item') private items!: NodeListOf<HTMLElement>;
```

### Events & Slots

```typescript
// Dispatch custom events with composed: true
private _handleClick() {
  this.dispatchEvent(new CustomEvent('my-event', {
    detail: { value: 'data' },
    bubbles: true,
    composed: true  // Cross shadow boundary
  }));
}

// Named slots
render() {
  return html`
    <slot name="header"></slot>
    <slot></slot>
  `;
}
```

## Tailwind CSS v4 Integration

### Shadow DOM Integration

**CRITICAL**: Tailwind v4 requires special setup for Shadow DOM. This project
uses a custom mixin approach.

**The TW Mixin (lib/shared/tailwindMixin.ts):**

```typescript
import { adoptStyles, type LitElement, unsafeCSS } from "lit";
import tailwindCss from "../styles/tailwind.global.css?inline";

export const TW = <T extends LitMixin>(superClass: T): T =>
  class extends superClass {
    connectedCallback() {
      super.connectedCallback();
      if (this.shadowRoot) adoptStyles(this.shadowRoot, [tailwind]);
    }
  };
```

**Usage in Components:**

```typescript
import { TW } from "../shared/tailwindMixin";

const TwLitElement = TW(LitElement);

@customElement("my-component")
export class MyComponent extends TwLitElement {}
```

### Tailwind v4 Configuration

**Global Styles (lib/styles/tailwind.global.css):**

```css
@import "tailwindcss";

@theme {
  --color-primary: oklch(0.55 0.22 264);
  --color-secondary: oklch(0.7 0.15 120);

  --radius-lg: 0.5rem;
  --radius-xl: 1rem;
}

@layer base {
  :root,
  :host {
  }
}
```

### Responsive Design

**Breakpoints**: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl`
(1536px)

```css
/* Custom breakpoints */
@theme {
  --breakpoint-xs: 30rem;
  --breakpoint-3xl: 120rem;
}
```

```typescript
// Usage
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 p-4 md:p-6">
```

### Dark Mode

**Setup (lib/styles/tailwind.global.css):**

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--_background);
  --color-foreground: var(--_foreground);
}

@layer base {
  :root,
  :host {
    --_background: var(--background, oklch(1 0 0));
    --_foreground: var(--foreground, oklch(0.147 0.004 49.25));
  }
  .dark,
  :host(.dark),
  :host-context(.dark) {
    --_background: var(--background, oklch(0.147 0.004 49.25));
    --_foreground: var(--foreground, oklch(0.985 0.001 106.423));
  }
}
```

**Usage:** Apply `dark:` prefix to utilities. Toggle:
`document.documentElement.classList.toggle('dark')`

### Utility Functions

**cn() - Merge Tailwind classes (lib/shared/utils.ts):**

```typescript
import { cn } from '../shared/utils';

render() {
  return html`
    <div class=${cn('base-class', this.active && 'active-class')}>
      Content
    </div>
  `;
}
```

**CVA - Component variants:**

```typescript
import { cva, VariantProps } from "class-variance-authority";

const buttonVariants = cva("base-styles", {
  variants: {
    variant: { default: "bg-primary", destructive: "bg-destructive" },
    size: { sm: "h-9 px-3", lg: "h-11 px-8" }
  }
});

@property({ type: String }) variant: VariantProps<typeof buttonVariants>["variant"];

render() {
  return html`
    <button class=${cn(buttonVariants({ variant: this.variant }))}>
      <slot></slot>
    </button>
  `;
}
```

### Custom Utilities & Theming

**Custom utilities (tailwind.global.css):**

```css
@utility scrollbar-hidden {
  &::-webkit-scrollbar {
    display: none;
  }
}
```

**Theming with pseudo-private properties:**

```css
@theme inline {
  --color-primary: var(--_primary);
}
@layer base {
  :root,
  :host {
    --_primary: var(--primary, oklch(0.55 0.22 264));
  }
}
```

Users override: `<style>:root { --primary: oklch(...); }</style>`

## State Management with Effect & Effect-Atom

This project uses **Effect** (functional effect system) and **effect-atom**
(reactive state management) for advanced state handling beyond Lit's built-in
reactivity.

### When to Use Effect-Atom

Use Effect-Atom when you need:

- **Shared state** across multiple components
- **Async operations** with loading/error states
- **Effect Services** for complex business logic
- **Derived state** that depends on other atoms
- **Global state** that persists across component lifecycles

For simple component-local state, use Lit's `@property()` and `@state()`.

### Core Concepts

**Effect**: A functional effect system providing type-safe async/error handling.

```typescript
import { Effect } from "effect";

// Effect<Success, Error, Requirements>
const myEffect = Effect.gen(function* () {
  yield* Effect.sleep("100 millis");
  yield* Effect.log("Hello");
  return 42;
});
```

**Atoms**: Reactive primitives that hold state and automatically update
subscribed components.

```typescript
import { Atom } from "@effect-atom/atom";

// Simple atom
const countAtom = Atom.make(0);

// Derived atom (computed from other atoms)
const doubleAtom = Atom.make((get) => get(countAtom) * 2);
```

**Result Pattern**: Atoms returning `Result<A, E>` represent async operations
with Initial, Success, Failure, and Waiting states.

### AtomMixin for Lit Components

To use atoms in Lit components, apply the `AtomMixin`:

```typescript
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { Atom } from "@effect-atom/atom";

const countAtom = Atom.make(0);

@customElement("my-counter")
export class MyCounter extends TW(AtomMixin(LitElement)) {
  @atomState(countAtom) declare count: number;

  render() {
    return html`<div>Count: ${this.count}</div>`;
  }
}
```

**Key points**:

- Extend with `AtomMixin(LitElement)` to enable atom support
- Use `@atomState()` decorator to sync atom values with component properties
- Atoms auto-subscribe on `connectedCallback()` and unsubscribe on
  `disconnectedCallback()`

### AtomMixin Hook Methods

For imperative atom access (not declarative with `@atomState`):

```typescript
// Read and write (for writable atoms)
const [value, setValue] = this.useAtom(myAtom);

// Read only
const value = this.useAtomValue(myAtom);

// Write only (setter function)
const setValue = this.useAtomSet(myAtom);

// Convert Result atom to Promise
const data = await this.useAtomPromise(resultAtom);

// Refresh/re-evaluate an atom
const refresh = this.useAtomRefresh(myAtom);
refresh();
```

### Result Pattern & Rendering

Atoms returning `Result<A, E>` have four states: Initial, Success, Failure,
Waiting.

```typescript
import { Atom, Result } from "@effect-atom/atom";
import { Effect } from "effect";

const dataAtom = Atom.fn(
  (id: number) =>
    Effect.gen(function* () {
      yield* Effect.sleep("500 millis");
      if (id < 0) return yield* Effect.fail("Invalid ID");
      return { id, name: "User" };
    }),
  { initialValue: { id: 0, name: "" } }
);

@customElement("my-component")
export class MyComponent extends TW(AtomMixin(LitElement)) {
  @atomState(dataAtom) declare data: Result.Result<User, string>;

  render() {
    return matchResult(this.data, {
      onInitial: () => html`<p>Not loaded</p>`,
      onWaiting: () => html`<p>Loading...</p>`,
      onSuccess: (user) => html`<p>User: ${user.name}</p>`,
      onFailure: (error) => html`<p class="error">${error}</p>`,
    });
  }
}
```

### Effect Services & Layers

For complex logic, create Effect Services:

```typescript
import { Effect, Ref } from "effect";
import { Atom } from "@effect-atom/atom";

class TodoService extends Effect.Service<TodoService>()("TodoService", {
  effect: Effect.gen(function* () {
    const todos = yield* Ref.make<Todo[]>([]);

    const addTodo = (text: string) =>
      Ref.update(todos, (current) => [
        ...current,
        { id: crypto.randomUUID(), text },
      ]);

    const getTodos = Ref.get(todos);

    return { addTodo, getTodos } as const;
  }),
}) {}

// Create runtime from service layer
const runtime = Atom.runtime(TodoService.Default);

// Atom using the service
const todosAtom = runtime.atom(
  Effect.gen(function* () {
    const service = yield* TodoService;
    return yield* service.getTodos;
  })
);

// Function atom with side effects
const addTodoFn = runtime.fn(
  Effect.fn(function* (text: string) {
    const service = yield* TodoService;
    yield* service.addTodo(text);
  }),
  { reactivityKeys: ["todos"] } // Invalidate atoms with this key
);
```

### Reactivity Keys & Invalidation

Reactivity keys allow selective atom updates when mutations occur:

```typescript
// Register atom with reactivity keys
const userAtom = Atom.make(() => fetchUser()).pipe(
  Atom.withReactivity(["user"])
);

// Or via @atomState decorator
@atomState(userAtom, { reactivityKeys: ["user"] })
declare user: User;

// Function that invalidates related atoms
const updateUserFn = runtime.fn(
  Effect.fn(function* (data: UserData) {
    yield* updateUserInDb(data);
  }),
  { reactivityKeys: ["user"] } // Refreshes atoms with "user" key
);

// Manual invalidation
this.invalidate(["user", "profile"]);
```

### Import Organization with Effect

```typescript
// Effect core
import { Effect, pipe } from "effect";
import * as Option from "effect/Option";
import * as Array from "effect/Array";

// Effect-Atom
import { Atom, Result } from "@effect-atom/atom";
import { AtomMixin, atomState, matchResult } from "../shared/atomMixin";

// Lit
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

// Local
import { TW } from "../shared/tailwindMixin";
```

Order: Effect → Effect-Atom → Lit → Local utilities

## Testing Strategy

Testing setup with Vitest can be added later. For now, test components manually
using the dev server (`bun run dev`).

## Development Environment

### Package Manager: Bun

```bash
bun install              # Install dependencies
bun add <package-name>   # Add package
bun add -D <pkg>         # Add dev dependency
```

### TypeScript Configuration

**CRITICAL settings in tsconfig.json:**

- `experimentalDecorators: true` - Required for Lit
- `useDefineForClassFields: false` - Required for Lit reactive properties

See `tsconfig.json` for full configuration.

### Vite Configuration

**Key plugins** (see `vite.config.js`):

- `vite-plugin-dts`: TypeScript definitions
- `vite-tsconfig-paths`: Path aliases
- `@tailwindcss/vite`: Tailwind v4

Commands: `bun run dev` | `bun run build` | `bun run preview`

## Style & Conventions

### File Naming

- **Components**: `kebab-case.ts` (e.g., `my-button.ts`)
- **Utilities**: `camelCase.ts` (e.g., `utils.ts`, `tailwindMixin.ts`)
- **Types**: `PascalCase.ts` or `camelCase.d.ts`

### Component Naming

**Custom element names:**

- Must contain a hyphen (-)
- Use lowercase
- Be descriptive

```typescript
@customElement('my-button')
@customElement('user-card')
@customElement('data-table')
```

**Class names:**

- Use PascalCase
- Match element name

```typescript
@customElement("my-button")
export class MyButton extends TwLitElement {}
```

### Property Conventions

**Public properties (reactive):**

```typescript
@property({ type: String })
variant = 'default';

@property({ type: Boolean })
disabled = false;
```

**Internal state:**

```typescript
@state()
private _isOpen = false;
```

**Private properties (non-reactive):**

```typescript
private _elementRef?: HTMLElement;
```

### Method Naming

**Public methods**: camelCase

```typescript
open() { }
close() { }
```

**Private methods**: \_camelCase (prefixed with underscore)

```typescript
private _handleClick() { }
private _updateState() { }
```

**Event handlers**: \_handleEventName

```typescript
private _handleClick(e: Event) { }
private _handleInput(e: InputEvent) { }
```

### Import Organization

```typescript
// Effect (if using state management)
import { Effect, pipe } from "effect";
import * as Option from "effect/Option";
import { Atom, Result } from "@effect-atom/atom";
import { AtomMixin, atomState } from "../shared/atomMixin";

// Lit core
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { query } from "lit/decorators/query.js";

// Local utilities
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";

// Third-party libraries
import { cva } from "class-variance-authority";

// Type imports (last)
import type { VariantProps } from "class-variance-authority";
```

Order:

1. Effect imports (if using atoms)
2. Lit core imports
3. Lit decorators
4. Local utilities
5. Third-party libraries
6. Type imports (last)

### Code Organization

**Standard component:**

```typescript
@customElement("my-component")
export class MyComponent extends TwLitElement {
  static styles = css`...`;

  @property() publicProp = "";

  @state() private _internalState = "";

  private _privateProperty = "";

  @query("#element") private _element!: HTMLElement;

  connectedCallback() {}

  render() {}

  private _handleEvent() {}

  private _helperMethod() {}
}

declare global {
  interface HTMLElementTagNameMap {
    "my-component": MyComponent;
  }
}
```

**With AtomMixin (for state management):**

```typescript
@customElement("my-component")
export class MyComponent extends TW(AtomMixin(LitElement)) {
  static styles = css`...`;

  @atomState(myAtom) declare atomValue: number;

  @property() publicProp = "";

  @state() private _internalState = "";

  connectedCallback() {
    super.connectedCallback();
    // Atoms auto-subscribe here
  }

  render() {
    return html`<div>${this.atomValue}</div>`;
  }

  private _handleClick() {
    const setValue = this.useAtomSet(myAtom);
    setValue(42);
  }
}
```

### Type Declarations

Always declare custom elements in `HTMLElementTagNameMap`:

```typescript
declare global {
  interface HTMLElementTagNameMap {
    "my-component": MyComponent;
  }
}
```

This enables:

- TypeScript autocomplete
- Type checking in JSX/TSX
- Better IDE support

## Common Pitfalls & Anti-patterns

### ❌ DON'T: Forget TW Mixin

```typescript
export class MyComponent extends LitElement {} // ❌ No Tailwind
const TwLitElement = TW(LitElement);
export class MyComponent extends TwLitElement {} // ✅
```

### ❌ DON'T: Forget `super.connectedCallback()`

```typescript
connectedCallback() { this.doSomething(); }  // ❌ Breaks Lit
connectedCallback() { super.connectedCallback(); this.doSomething(); }  // ✅
```

### ❌ DON'T: Mutate Properties in render()

```typescript
render() { this.count++; ... }  // ❌ Infinite loop
private _handleClick() { this.count++; }  // ✅
```

### ❌ DON'T: Use `static styles` with Tailwind

```typescript
static styles = css`.btn { @apply bg-blue-500; }`;  // ❌
render() { return html`<button class="bg-blue-500">`; }  // ✅
```

**Exception**: Use for `:host`, `::slotted()`, etc.

### ❌ DON'T: Concatenate Classes

```typescript
class=${'btn ' + (active ? 'active' : '')}  // ❌
class=${cn('btn', active && 'active')}  // ✅
```

### ❌ DON'T: Forget `composed: true` on Events

```typescript
new CustomEvent("evt", { detail }); // ❌ Won't cross shadow DOM
new CustomEvent("evt", { detail, bubbles: true, composed: true }); // ✅
```

### ❌ DON'T: Forget AtomMixin for State Management

```typescript
export class MyComponent extends TwLitElement {} // ❌ Can't use atoms
export class MyComponent extends TW(AtomMixin(LitElement)) {} // ✅
```

### ❌ DON'T: Call useAtom\* Hooks in render()

```typescript
render() {
  const [value] = this.useAtom(myAtom); // ❌ Re-subscribes every render
  return html`${value}`;
}

// ✅ Use @atomState decorator instead
@atomState(myAtom) declare value: number;
render() { return html`${this.value}`; }
```

### ❌ DON'T: Access Result Value Without Checking State

```typescript
render() {
  return html`${this.result.value}`; // ❌ May not exist
}

// ✅ Use matchResult helper
render() {
  return matchResult(this.result, {
    onSuccess: (value) => html`${value}`,
    onFailure: (error) => html`Error: ${error}`,
  });
}
```

### ❌ DON'T: Mix @state() with @atomState() for Same Property

```typescript
@state()
@atomState(myAtom)
declare count: number; // ❌ Conflicting decorators

// ✅ Choose one approach
@atomState(myAtom) declare count: number; // For atoms
@state() private _count = 0; // For local state
```

## Documentation Standards

### Component Documentation

Use JSDoc for public APIs:

```typescript
/**
 * Button component with variant support.
 * @element my-button
 * @fires {CustomEvent} click
 * @slot - Button content
 */
@customElement("my-button")
export class MyButton extends TwLitElement {
  /** @type {'default' | 'primary'} */
  @property({ type: String }) variant = "default";
}
```

Update README.md when adding components.

## Where to Find More Information

### Official Documentation

- **Lit**: <https://lit.dev/docs/> - Comprehensive Lit documentation
- **Tailwind CSS v4**: <https://tailwindcss.com/docs> - Latest Tailwind docs
- **Effect**: <https://effect.website/docs/introduction> - Effect functional
  programming
- **Effect-Atom**: <https://github.com/tim-smart/effect-atom> - Reactive state
  management
- **Web Components**:
  <https://developer.mozilla.org/en-US/docs/Web/API/Web_components>
- **TypeScript Decorators**:
  <https://www.typescriptlang.org/docs/handbook/decorators.html>

### Project Files

- **README.md**: Human-readable project overview and setup guide
- **AGENTS.md** (this file): Agent-specific build, test, and style instructions
- **package.json**: Dependencies and npm scripts
- **vite.config.js**: Build configuration
- **tsconfig.json**: TypeScript configuration

---

## 📝 How to Update AGENTS.md

**Keep this file current!** Update AGENTS.md whenever you add new scripts,
change test commands, or update code style rules. Treat it as living
documentation for all coding agents and future maintainers.

---

## ❓ FAQ for Coding Agents

**Q: What if instructions conflict with README.md?**  
A: AGENTS.md takes precedence for agent tasks.

**Q: Should I use JavaScript or TypeScript?**  
A: Always use TypeScript with decorators.

**Q: Reactive property not updating?**  
A: Check `@property()` decorator, `useDefineForClassFields: false`, and that
you're replacing (not mutating) objects/arrays.

**Q: Component not rendering?**  
A: Verify `@customElement()`, extends `TwLitElement`, tag has hyphen, returns
`html` from `render()`.

**Q: Tailwind classes not working?**  
A: Ensure component extends `TwLitElement`, classes in template (not
`static styles`).

**Q: Customize theme?**  
A: Edit `lib/styles/tailwind.global.css` with `@theme` directive.

**Q: Changes not showing?**  
A: Hard refresh (Cmd/Ctrl + Shift + R), restart dev server, check console.

**Q: When to use @state() vs @atomState()?**  
A: Use `@state()` for component-local state. Use `@atomState()` for
shared/global state managed by atoms that needs to sync across multiple
components.

**Q: How do atoms share state between components?**  
A: Atoms are global by default. Multiple components using `@atomState(sameAtom)`
automatically share the same state and update together when the atom changes.

**Q: Atom not updating component?**  
A: Ensure component extends `AtomMixin(LitElement)`, uses `@atomState()`
decorator or hook methods, and atom reference is stable (not recreated on each
render).

**Q: How to handle async operations with atoms?**  
A: Use `Atom.fn()` with Effect that returns `Result<A, E>`. The Result
automatically tracks Initial, Waiting, Success, and Failure states. Render with
`matchResult()`.

**Q: When to use Effect Services vs simple atoms?**  
A: Use simple atoms (`Atom.make`) for straightforward state. Use Effect Services
when you need complex business logic, dependency injection, multiple related
operations, or integration with Effect ecosystem features.

---

## 📚 Useful Resources

### Essential Tools

**Core**: Lit (v3.3.1), Tailwind CSS (v4.1.14), Vite (v7.1.9), TypeScript
(v5.9.3)  
**State Management**: Effect (v3.18.4), @effect-atom/atom (v0.3.0)  
**Utilities**: class-variance-authority, clsx, tailwind-merge, tw-animate-css  
**VSCode Extensions**: Lit Plugin, Tailwind CSS IntelliSense, Effect Language
Service

## ⚠️ Important Notes

- **NEVER ASSUME OR GUESS** - When in doubt, ask for clarification
- **Always extend TwLitElement** - Not plain LitElement (for Tailwind support)
- **For atoms, extend TW(AtomMixin(LitElement))** - Combines Tailwind + state
  management
- **Use TypeScript decorators** - `@customElement()`, `@property()`,
  `@atomState()`, etc.
- **Keep AGENTS.md updated** - Document new patterns or dependencies here
- **Test manually via dev server** - Run `bun run dev` to verify changes
- **Check TypeScript errors** - Run `bun run build` to catch type issues
- **Use `cn()` for dynamic classes** - Don't concatenate strings
- **Always call super** - In lifecycle methods (connectedCallback, etc.)
- **Set `composed: true`** - For custom events that need to bubble out
- **Declare custom elements** - In `HTMLElementTagNameMap` for TypeScript
- **Use `@atomState()` for atoms** - Not `@property()` or `@state()`
- **Handle Result states properly** - Use `matchResult()` helper for rendering

## 🔍 Search Command Requirements

**CRITICAL**: Always use `rg` (ripgrep) for search operations:

```bash
# ✅ Use rg for pattern searches
rg "pattern"

# ✅ Use rg for file filtering
rg --files -g "*.ts"
rg --files -g "*.test.ts"
```

---

_This document is a living guide. Update it as the project evolves and new
patterns emerge._
