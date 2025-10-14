import { Atom } from "@effect-atom/atom";
import { cva } from "class-variance-authority";
import { Effect, Ref } from "effect";
import * as Array from "effect/Array";
import { pipe } from "effect/Function";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Check, Plus, Square, Trash2 } from "lucide-static";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import "./ui/Button";

type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
};

class TodoService extends Effect.Service<TodoService>()("TodoService", {
  effect: Effect.gen(function* () {
    const todos = yield* Ref.make<TodoItem[]>([]);

    const addTodo = (text: string) =>
      Effect.gen(function* () {
        const current = yield* Ref.get(todos);
        const activeCount = current.filter((t) => !t.completed).length;

        if (activeCount >= 3) {
          return yield* Effect.fail({
            _tag: "MaxTodosReached" as const,
            message: "Maximum of 3 unfinished todos reached",
          });
        }

        const newTodo: TodoItem = {
          id: crypto.randomUUID(),
          text,
          completed: false,
        };

        yield* Ref.update(todos, (current) => [...current, newTodo]);
        return newTodo;
      });

    const removeTodo = (id: string) =>
      Ref.update(todos, (current) => current.filter((t) => t.id !== id));

    const updateTodo = (id: string, updates: Partial<TodoItem>) =>
      Ref.update(todos, (current) =>
        current.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );

    const getTodos = Ref.get(todos);

    return {
      addTodo,
      removeTodo,
      updateTodo,
      getTodos,
    } as const;
  }),
}) {}

const todosRuntime = Atom.runtime(TodoService.Default);

const todosResultAtom = todosRuntime
  .atom(
    Effect.gen(function* () {
      const service = yield* TodoService;
      return yield* service.getTodos;
    }),
  )
  .pipe(Atom.withReactivity(["todos"]));

export const todosAtom = Atom.make((get) => {
  const result = get(todosResultAtom);
  if (result._tag === "Success") {
    return result.value;
  }
  return [];
});

const addTodoEffect = todosRuntime.fn(
  Effect.fn(function* (text: string) {
    const service = yield* TodoService;
    return yield* service.addTodo(text);
  }),
  { reactivityKeys: ["todos"] },
);

export const addTodoErrorAtom = Atom.make((get) => {
  const result = get(addTodoEffect);
  if (result._tag === "Failure") {
    const error = result.cause;
    if (error._tag === "Fail" && error.error._tag === "MaxTodosReached") {
      return error.error.message;
    }
  }
  return null;
});

export const removeTodoEffect = todosRuntime.fn(
  Effect.fn(function* (id: string) {
    const service = yield* TodoService;
    yield* service.removeTodo(id);
  }),
  { reactivityKeys: ["todos"] },
);

export const updateTodoEffect = todosRuntime.fn(
  Effect.fn(function* (args: { id: string; updates: Partial<TodoItem> }) {
    const service = yield* TodoService;
    yield* service.updateTodo(args.id, args.updates);
  }),
  { reactivityKeys: ["todos"] },
);

const inputVariants = cva(
  "w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-ring transition-colors bg-background text-foreground",
  {
    variants: {
      variant: {
        default: "border-input",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

@customElement("todo-input")
export class TodoInput extends TW(AtomMixin(LitElement)) {
  @atomState(addTodoErrorAtom) declare addTodoError: string | null;
  @atomState(addTodoEffect, { reactivityKeys: ["todos"] })
  @property()
  docsHint = "Effect Service managing shared todo state with validation";

  private inputValue = "";

  render() {
    const isInputDisabled = !this.inputValue.trim();

    return html`
      <div class="flex flex-col items-center gap-4 w-full px-2">
        <slot></slot>
        <div class="flex w-full gap-2 max-w-xl flex-col sm:flex-row">
          <input
            type="text"
            class="${inputVariants({ variant: "default" })}"
            placeholder="Enter a new todo..."
            .value=${this.inputValue}
            @input=${this._handleInput}
            @keypress=${this._handleKeyPress}
          />
          <ui-button
            variant="default"
            size="default"
            @click=${this._addTodo}
            ?disabled=${isInputDisabled}
          >
            ${unsafeSVG(Plus)}
            <span class="ml-2">Add</span>
          </ui-button>
        </div>
        ${
          this.addTodoError
            ? html`<p class="text-destructive text-xs sm:text-sm font-medium text-center">
                ${this.addTodoError}
              </p>`
            : html`<p class="text-muted-foreground text-xs sm:text-sm text-center">${this.docsHint}</p>`
        }
      </div>
    `;
  }

  private _handleInput(e: Event) {
    this.inputValue = (e.target as HTMLInputElement).value;
    this.requestUpdate();
  }

  private _handleKeyPress(e: KeyboardEvent) {
    if (e.key === "Enter") {
      this._addTodo();
    }
  }

  private _addTodo() {
    const text = this.inputValue.trim();
    if (!text) return;

    const addTodo = this.useAtomSet(addTodoEffect);
    addTodo(text);
    this.inputValue = "";
    this.requestUpdate();
  }
}

@customElement("todo-list")
export class TodoList extends TW(AtomMixin(LitElement)) {
  @atomState(todosAtom) declare todos: TodoItem[];
  @atomState(updateTodoEffect, { reactivityKeys: ["todos"] })
  declare updateTodo: (args: { id: string; text: string }) => void;
  @atomState(removeTodoEffect, { reactivityKeys: ["todos"] })
  declare removeTodo: (id: string) => void;
  @property()
  docsHint = "Reactive todo display with Effect Atom subscriptions";

  render() {
    const activeTodos = pipe(
      this.todos,
      Array.filter((todo) => !todo.completed),
    );
    const completedTodos = pipe(
      this.todos,
      Array.filter((todo) => todo.completed),
    );

    return html`
      <div class="flex flex-col items-center gap-4 w-full px-2">
        <div
          class="border border-border w-full max-w-xl rounded-lg bg-card p-4 min-h-[200px] max-h-[400px] overflow-y-auto"
        >
          ${
            this.todos.length === 0
              ? html`<p class="text-muted-foreground text-center py-8 text-sm">
                No todos yet. Add one above!
              </p>`
              : html`
                ${
                  activeTodos.length > 0
                    ? html`
                      <div class="mb-4">
                        <h4 class="text-xs sm:text-sm font-semibold text-muted-foreground mb-2">
                          Active (${activeTodos.length})
                        </h4>
                        ${activeTodos.map((todo) => this._renderTodoItem(todo))}
                      </div>
                    `
                    : null
                }
                ${
                  completedTodos.length > 0
                    ? html`
                      <div>
                        <h4 class="text-xs sm:text-sm font-semibold text-muted-foreground mb-2">
                          Completed (${completedTodos.length})
                        </h4>
                        ${completedTodos.map((todo) =>
                          this._renderTodoItem(todo),
                        )}
                      </div>
                    `
                    : null
                }
              `
          }
        </div>

        <p class="text-muted-foreground text-xs sm:text-sm text-center">${this.docsHint}</p>
      </div>
    `;
  }

  private _renderTodoItem(todo: TodoItem) {
    return html`
      <div
        class="flex items-center gap-3 p-3 border border-transparent hover:border-border hover:bg-accent/50 rounded-md group transition-colors"
      >
        <ui-button
          variant="ghost"
          size="icon"
          class="${todo.completed ? "text-foreground" : "text-muted-foreground"}"
          @click=${() => this._toggleTodo(todo.id)}
          title="${todo.completed ? "Mark as incomplete" : "Mark as complete"}"
        >
          ${unsafeSVG(todo.completed ? Check : Square)}
        </ui-button>

        <span
          class="flex-1 ${todo.completed ? "line-through text-muted-foreground" : "text-card-foreground"}"
        >
          ${todo.text}
        </span>

        <ui-button
          variant="ghost"
          size="icon"
          class="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          @click=${() => this._deleteTodo(todo.id)}
          title="Delete todo"
        >
          ${unsafeSVG(Trash2)}
        </ui-button>
      </div>
    `;
  }

  private _toggleTodo(id: string) {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) return;

    const updateTodo = this.useAtomSet(updateTodoEffect);
    updateTodo({
      id,
      updates: { completed: !todo.completed },
    });
  }

  private _deleteTodo(id: string) {
    const removeTodo = this.useAtomSet(removeTodoEffect);
    removeTodo(id);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "todo-input": TodoInput;
    "todo-list": TodoList;
  }
}
