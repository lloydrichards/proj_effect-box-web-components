import { Atom } from "@effect-atom/atom";
import { cva } from "class-variance-authority";
import * as Array from "effect/Array";
import { pipe } from "effect/Function";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Check, Plus, Trash2, X } from "lucide-static";
import { AtomMixin, atomProperty } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";

const TwAtomElement = TW(AtomMixin(LitElement));

type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
};

export const todosAtom = Atom.make<TodoItem[]>([]);

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
  @atomProperty(todosAtom)
  todos!: TodoItem[];

  @property() docsHint = "Add items to the shared todo list";
  @property({ type: Number }) maxUnfinished = 3;

  private inputValue = "";

  render() {
    const activeTodosCount = pipe(
      this.todos,
      Array.filter((todo) => !todo.completed),
      (arr) => arr.length,
    );
    const isLimitReached = activeTodosCount >= this.maxUnfinished;
    const isInputDisabled = isLimitReached || !this.inputValue.trim();

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
            ?disabled=${isLimitReached}
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
          isLimitReached
            ? html`<p class="text-red-500 text-sm font-medium">
              Maximum of ${this.maxUnfinished} unfinished todos reached.
              Complete or delete one to add more.
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

    const activeTodosCount = pipe(
      this.todos,
      Array.filter((todo) => !todo.completed),
      (arr) => arr.length,
    );
    if (activeTodosCount >= this.maxUnfinished) return;

    const newTodo: TodoItem = {
      id: crypto.randomUUID(),
      text,
      completed: false,
    };

    this.setAtom("todos", [...this.todos, newTodo]);
    this.inputValue = "";
    this.requestUpdate();
  }
}

@customElement("todo-list")
export class TodoList extends TwAtomElement {
  @atomProperty(todosAtom)
  todos!: TodoItem[];

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
          ${unsafeSVG(todo.completed ? Check : X)}
        </button>

        <span
          class="flex-1 ${
            todo.completed ? "line-through text-gray-400" : "text-gray-700"
          }"
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
    const updatedTodos = pipe(
      this.todos,
      Array.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
    this.setAtom("todos", updatedTodos);
  }

  private _deleteTodo(id: string) {
    const updatedTodos = pipe(
      this.todos,
      Array.filter((todo) => todo.id !== id),
    );
    this.setAtom("todos", updatedTodos);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "todo-input": TodoInput;
    "todo-list": TodoList;
  }
}
