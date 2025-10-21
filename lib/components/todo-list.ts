import { Atom } from "@effect-atom/atom";
import { Effect, Ref } from "effect";
import * as Array from "effect/Array";
import { pipe } from "effect/Function";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Check, Plus, Square, Trash2 } from "lucide-static";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import "./ui/button/button";
import "./ui/card/card";
import "./ui/item/item";

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
            class="flex-1"
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
        <ui-card style="width: 100%; max-width: 42rem;">
          <ui-card-content style="min-height: 200px; max-height: 400px; overflow-y: auto;">
            ${
              this.todos.length === 0
                ? html`<p class="text-muted-foreground text-center py-8 text-sm">
                  No todos yet. Add one above!
                </p>`
                : html`
                  ${
                    activeTodos.length > 0
                      ? html`
                        <div class="mb-6">
                          <h4 class="text-xs sm:text-sm font-semibold text-muted-foreground mb-3 px-1">
                            Active (${activeTodos.length})
                          </h4>
                          <ui-item-group class="gap-2">
                            ${activeTodos.map(
                              (todo, index) => html`
                              ${this._renderTodoItem(todo)}
                              ${index < activeTodos.length - 1 ? html`<ui-item-separator></ui-item-separator>` : null}
                            `,
                            )}
                          </ui-item-group>
                        </div>
                      `
                      : null
                  }
                  ${
                    completedTodos.length > 0
                      ? html`
                        <div>
                          <h4 class="text-xs sm:text-sm font-semibold text-muted-foreground mb-3 px-1">
                            Completed (${completedTodos.length})
                          </h4>
                          <ui-item-group class="gap-2">
                            ${completedTodos.map(
                              (todo, index) => html`
                              ${this._renderTodoItem(todo)}
                              ${index < completedTodos.length - 1 ? html`<ui-item-separator></ui-item-separator>` : null}
                            `,
                            )}
                          </ui-item-group>
                        </div>
                      `
                      : null
                  }
                `
            }
          </ui-card-content>
        </ui-card>

        <p class="text-muted-foreground text-xs sm:text-sm text-center">${this.docsHint}</p>
      </div>
    `;
  }

  private _renderTodoItem(todo: TodoItem) {
    return html`
      <ui-item variant="outline" size="sm" class="group">
        <ui-item-media variant="icon" class="cursor-pointer" @click=${() => this._toggleTodo(todo.id)}>
          <span class="[&_svg]:size-4 ${todo.completed ? "text-foreground" : "text-muted-foreground"}">
            ${unsafeSVG(todo.completed ? Check : Square)}
          </span>
        </ui-item-media>

        <ui-item-content @click=${() => this._toggleTodo(todo.id)} class="cursor-pointer">
          <ui-item-title class="${todo.completed ? "line-through text-muted-foreground" : ""}">
            ${todo.text}
          </ui-item-title>
        </ui-item-content>

        <ui-item-actions class="ml-auto">
          <ui-button
            variant="ghost"
            size="icon-sm"
            class="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            @click=${() => this._deleteTodo(todo.id)}
            aria-label="Delete todo"
          >
            ${unsafeSVG(Trash2)}
          </ui-button>
        </ui-item-actions>
      </ui-item>
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
