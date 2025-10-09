import { Atom } from "@effect-atom/atom";
import { cva } from "class-variance-authority";
import { Effect, Ref } from "effect";
import * as Array from "effect/Array";
import { pipe } from "effect/Function";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Check, Plus, Trash2, Square } from "lucide-static";
import { AtomMixin, atomProperty } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";

const TwAtomElement = TW(AtomMixin(LitElement));

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
  "w-full px-4 py-2 border rounded-md focus:outline-hidden focus:ring-2 focus:ring-primary transition-colors",
  {
    variants: {
      variant: {
        default: "border-gray-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outlined: "border hover:bg-gray-100",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        ghost: "hover:bg-gray-100/10",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3",
        icon: "p-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

@customElement("todo-input")
export class TodoInput extends TwAtomElement {
  @atomProperty(addTodoErrorAtom) declare addTodoError: string | null;
  @atomProperty(addTodoEffect)
  @property()
  docsHint = "Add items to the shared todo list";

  private inputValue = "";

  render() {
    const isInputDisabled = !this.inputValue.trim();

    return html`
      <div class="flex flex-col items-center gap-4 w-full">
        <slot></slot>
        <div class="flex w-full gap-2 max-w-xl">
          <input
            type="text"
            class="${inputVariants({ variant: "default" })}"
            placeholder="Enter a new todo..."
            .value=${this.inputValue}
            @input=${this._handleInput}
            @keypress=${this._handleKeyPress}
          />
          <button
            class="${cn(
              buttonVariants({ variant: "default", size: "default" }),
              "[&_svg]:size-4",
            )}"
            @click=${this._addTodo}
            ?disabled=${isInputDisabled}
          >
            ${unsafeSVG(Plus)}
            <span class="ml-2">Add</span>
          </button>
        </div>
        ${
          this.addTodoError
            ? html`<p class="text-red-500 text-sm font-medium">
                ${this.addTodoError}
              </p>`
            : html`<p class="text-gray-400 text-sm">${this.docsHint}</p>`
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

    this.setAtom(addTodoEffect, text);
    this.inputValue = "";
    this.requestUpdate();
  }
}

@customElement("todo-list")
export class TodoList extends TwAtomElement {
  @atomProperty(todosAtom)
  todos!: TodoItem[];

  @atomProperty(updateTodoEffect)
  declare _updateTodoEffectSubscription: any;

  @atomProperty(removeTodoEffect)
  declare _removeTodoEffectSubscription: any;

  @property() docsHint = "Shared todo list state with Effect atoms";

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
      <div class="flex flex-col items-center gap-4 w-full">
        <slot></slot>

        <div
          class="border border-border/50 w-full max-w-xl rounded-lg shadow-md p-4 min-h-[200px] max-h-[400px] overflow-y-auto"
        >
          ${
            this.todos.length === 0
              ? html`<p class="text-gray-400 text-center py-8">
                No todos yet. Add one above!
              </p>`
              : html`
                ${
                  activeTodos.length > 0
                    ? html`
                      <div class="mb-4">
                        <h4 class="text-sm font-semibold text-gray-600 mb-2">
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
                        <h4 class="text-sm font-semibold text-gray-600 mb-2">
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

        <p class="text-gray-400 text-sm">${this.docsHint}</p>
      </div>
    `;
  }

  private _renderTodoItem(todo: TodoItem) {
    return html`
      <div
        class="flex items-center gap-3 p-3 border border-transparent hover:border-border rounded-md group transition-colors"
      >
        <button
          class="${cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "[&_svg]:size-5",
            todo.completed ? "text-green-600" : "text-gray-400",
          )}"
          @click=${() => this._toggleTodo(todo.id)}
          title="${todo.completed ? "Mark as incomplete" : "Mark as complete"}"
        >
          ${unsafeSVG(todo.completed ? Check : Square)}
        </button>

        <span
          class="flex-1 ${todo.completed ? "line-through text-gray-400" : ""}"
        >
          ${todo.text}
        </span>

        <button
          class="${cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "[&_svg]:size-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity",
          )}"
          @click=${() => this._deleteTodo(todo.id)}
          title="Delete todo"
        >
          ${unsafeSVG(Trash2)}
        </button>
      </div>
    `;
  }

  private _toggleTodo(id: string) {
    const todo = this.todos.find((t) => t.id === id);
    if (!todo) return;

    this.setAtom(updateTodoEffect, {
      id,
      updates: { completed: !todo.completed },
    });
  }

  private _deleteTodo(id: string) {
    this.setAtom(removeTodoEffect, id);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "todo-input": TodoInput;
    "todo-list": TodoList;
  }
}
