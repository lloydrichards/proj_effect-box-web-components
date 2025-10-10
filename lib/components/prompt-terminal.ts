import { Array, Data, Effect, Match, Option, pipe } from "effect";
import { Ansi, Box, Renderer } from "effect-boxes";
import { FancyAnsi } from "fancy-ansi";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { TW } from "../shared/tailwindMixin";
import { Border } from "./ui/Border";
import { createTable, TableServiceLayer } from "./ui/Table";

const TwLitElement = TW(LitElement);
const fancyAnsi = new FancyAnsi();

class PromptError extends Data.TaggedError("PromptError")<{
  message: string;
}> {}

type PromptItem = {
  readonly key: string;
  readonly message: string;
  readonly value: string;
};

type PromptState = {
  readonly input: string;
  readonly submitted: boolean;
};

type TerminalState = {
  readonly completed: ReadonlyArray<PromptItem>;
  readonly current: {
    key: string;
    message: string;
    state: PromptState;
    maxLength: number;
  } | null;
  readonly showResults: boolean;
};

export interface PromptRenderContext {
  readonly message: string;
  readonly inputValue: string;
  readonly maxLength: number;
  readonly isFocused: boolean;
  readonly cursorPosition: number;
  readonly hasError: boolean;
  readonly errorMessage?: string;
}

export interface BasePrompt {
  readonly _tag: "BasePrompt";
  readonly key: string;
  readonly message: string;
  readonly maxLength: number;
  renderActive(context: PromptRenderContext): Effect.Effect<string>;
  renderCompleted(item: PromptItem): Effect.Effect<string>;
}

const isBasePrompt = (el: Element): el is Element & BasePrompt => {
  return "_tag" in el && (el as { _tag?: unknown })._tag === "BasePrompt";
};

@customElement("text-prompt")
export class TextPrompt extends LitElement implements BasePrompt {
  readonly _tag = "BasePrompt" as const;
  @property() key = "";
  @property() message = "";
  @property({ type: Number }) maxLength = 100;

  render() {
    return html`<slot></slot>`;
  }

  renderActive(context: PromptRenderContext): Effect.Effect<string> {
    const maxWidth = 80;

    const inputText = context.inputValue;

    const inputLine = context.isFocused
      ? Box.combineAll([
          Box.text(inputText.slice(0, context.cursorPosition)),
          Box.char(inputText[context.cursorPosition] || "\u00A0").pipe(
            Box.annotate(Ansi.combine(Ansi.bgWhite, Ansi.black)),
          ),
          Box.text(inputText.slice(context.cursorPosition + 1)),
        ])
      : Box.text(inputText);

    const promptLine = Box.punctuateH(
      [
        Box.text("?").pipe(Box.annotate(Ansi.green)),
        Box.text(context.message).pipe(
          Box.annotate(Ansi.combine(Ansi.bold, Ansi.yellow)),
        ),
        Box.char("›"),
        inputLine,
      ],
      Box.left,
      Box.char(" "),
    );

    const counterLine = pipe(
      Box.text(`${context.inputValue.length}/${context.maxLength}`),
      Box.annotate(Ansi.dim),
      Box.alignHoriz(Box.right, maxWidth),
    );

    const errorBox =
      context.hasError && context.errorMessage
        ? Box.text(context.errorMessage).pipe(Box.annotate(Ansi.red))
        : Box.emptyBox();

    const content = Box.vcat(
      [promptLine, errorBox, counterLine],
      Box.left,
    ).pipe(Box.moveLeft(2), Box.moveRight(2), Border, Box.moveDown(1));

    return Box.render(content, { preserveWhitespace: true }).pipe(
      Effect.provide(Renderer.AnsiRendererLive),
    );
  }

  renderCompleted(item: PromptItem): Effect.Effect<string> {
    return pipe(
      Box.punctuateH(
        [
          Box.text("✓").pipe(Box.annotate(Ansi.green)),
          Box.text(item.key).pipe(Box.annotate(Ansi.dim)),
          Box.text(item.value).pipe(
            Box.annotate(Ansi.combine(Ansi.bold, Ansi.cyan)),
          ),
        ],
        Box.left,
        Box.char(" "),
      ),
      Box.render({ preserveWhitespace: true }),
      Effect.provide(Renderer.AnsiRendererLive),
    );
  }
}

@customElement("prompt-terminal")
export class PromptTerminal extends TwLitElement {
  @state() private terminalState: TerminalState = {
    completed: [],
    current: null,
    showResults: false,
  };
  @state() private content = "";
  @state() private isFocused = false;
  @state() private error: PromptError | null = null;
  @state() private cursorPosition = 0;

  private prompts: BasePrompt[] = [];
  private currentPromptIndex = 0;
  private startTime = new Date();

  connectedCallback() {
    super.connectedCallback();
    this.updateComplete.then(() => {
      this._initializePrompts();
    });
  }

  private _initializePrompts() {
    const slot = this.shadowRoot?.querySelector("slot");
    if (!slot) return;

    const elements = slot.assignedElements({ flatten: true });
    this.prompts = elements.filter(isBasePrompt) as BasePrompt[];

    if (this.prompts.length > 0) {
      this._showNextPrompt();
    }
  }

  private _showNextPrompt() {
    if (this.currentPromptIndex >= this.prompts.length) {
      this.terminalState = {
        ...this.terminalState,
        showResults: true,
      };
      return;
    }

    const prompt = this.prompts[this.currentPromptIndex];
    this.terminalState = {
      ...this.terminalState,
      current: {
        key: prompt.key,
        message: prompt.message,
        state: { input: "", submitted: false },
        maxLength: prompt.maxLength,
      },
    };
    this.cursorPosition = 0;
  }

  private _resetTerminal() {
    this.terminalState = {
      completed: [],
      current: null,
      showResults: false,
    };
    this.currentPromptIndex = 0;
    this.cursorPosition = 0;
    this.error = null;
    this.startTime = new Date();
    this._showNextPrompt();
  }

  updated(changedProperties: Map<string, unknown>) {
    if (
      changedProperties.has("terminalState") ||
      changedProperties.has("isFocused") ||
      changedProperties.has("error") ||
      changedProperties.has("cursorPosition")
    ) {
      Effect.runPromise(
        this.generateEffect().pipe(
          Effect.tap((htmlString) => {
            this.content = htmlString;
          }),
        ),
      );
    }
  }

  protected generateEffect(): Effect.Effect<string> {
    const completedParts = Array.zipWith(
      this.terminalState.completed,
      this.prompts,
      (item, prompt) => prompt.renderCompleted(item),
    );

    const currentPart = pipe(
      Option.fromNullable(this.terminalState.current),
      Option.filter(() => !this.terminalState.showResults),
      Option.map((current) =>
        this.prompts[this.currentPromptIndex]?.renderActive({
          message: current.message,
          inputValue: this.error ? "" : current.state.input,
          maxLength: current.maxLength,
          isFocused: this.isFocused,
          cursorPosition: this.cursorPosition,
          hasError: !!this.error,
          errorMessage: this.error?.message,
        }),
      ),
      Option.toArray,
      Array.filterMap(Option.fromNullable),
    );

    const resultsPart = this.terminalState.showResults
      ? [this._renderResultsTable(this.terminalState.completed)]
      : [];

    return pipe(
      [
        [this._renderStartupLine()],
        completedParts,
        resultsPart,
        currentPart,
        [this._renderShortcutHelper()],
      ],
      Array.flatten,
      Effect.all,
      Effect.map(Array.join("\n")),
    );
  }

  private _renderStartupLine(): Effect.Effect<string> {
    const now = this.startTime;
    const time = now.toLocaleTimeString();
    const content = Box.combineAll([
      Box.text("["),
      Box.text(time).pipe(Box.annotate(Ansi.green)),
      Box.text("]"),
      Box.text(" "),
      Box.text("prompt-terminal").pipe(Box.annotate(Ansi.cyan)),
      Box.text(" started"),
    ]).pipe(Box.annotate(Ansi.dim));

    return Box.render(content, { preserveWhitespace: true }).pipe(
      Effect.provide(Renderer.AnsiRendererLive),
    );
  }

  private _renderShortcutHelper(): Effect.Effect<string> {
    const shortcuts = [
      { key: "Enter", desc: "Submit" },
      { key: "Ctrl+C", desc: "Reset" },
      { key: "←/→", desc: "Move cursor" },
    ];

    const shortcutBoxes = shortcuts.map((shortcut) =>
      Box.combineAll([
        Box.text(shortcut.key).pipe(
          Box.annotate(Ansi.combine(Ansi.bold, Ansi.cyan)),
        ),
        Box.text(" "),
        Box.text(shortcut.desc).pipe(Box.annotate(Ansi.dim)),
      ]),
    );

    const content = Box.hsep(shortcutBoxes, 2, Box.center1).pipe(
      Box.alignHoriz(Box.center1, 80),
    );

    return Box.render(content, { preserveWhitespace: true }).pipe(
      Effect.provide(Renderer.AnsiRendererLive),
    );
  }

  private _renderResultsTable(
    items: ReadonlyArray<PromptItem>,
  ): Effect.Effect<string> {
    if (items.length === 0) {
      return Effect.succeed("");
    }

    const maxKeyWidth = Math.max(...items.map((item) => item.key.length), 10);
    const maxAnswerWidth = Math.max(
      ...items.map((item) => item.value.length),
      6,
    );

    const headers = ["Setting", "Value"];
    const rows = items.map((item) => [item.key, item.value]);
    const colWidths = [maxKeyWidth, maxAnswerWidth];

    return createTable(headers, rows, colWidths).pipe(
      Effect.provide(TableServiceLayer),
      Effect.flatMap((table) =>
        Box.render(table, { preserveWhitespace: true }).pipe(
          Effect.provide(Renderer.AnsiRendererLive),
        ),
      ),
    );
  }

  render() {
    return html`
      <div style="display: none">
        <slot @slotchange=${this._initializePrompts}></slot>
      </div>
      <div
        class="flex flex-col gap-2 p-2 w-full h-100 overflow-auto bg-background/10"
        tabindex="0"
        @focus=${this._handleFocus}
        @blur=${this._handleBlur}
        @keydown=${this._handleKeyDown}
      >
        <pre class="whitespace-pre"><code>${unsafeHTML(
          fancyAnsi.toHtml(this.content),
        )}</code></pre>
      </div>
    `;
  }

  private _handleFocus() {
    this.isFocused = true;
  }

  private _handleBlur() {
    this.isFocused = false;
  }

  private _handleKeyDown(e: KeyboardEvent) {
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      this._resetTerminal();
      return;
    }

    if (
      !this.terminalState.current ||
      this.terminalState.current.state.submitted
    )
      return;

    const currentState = this.terminalState.current.state;

    pipe(
      Match.value(e.key),
      Match.when("Enter", () => {
        if (currentState.input.trim()) {
          const value = currentState.input;
          const key = this.terminalState.current!.key;
          const message = this.terminalState.current!.message;

          this.terminalState = {
            ...this.terminalState,
            completed: [
              ...this.terminalState.completed,
              { key, message, value },
            ],
            current: null,
          };

          this.currentPromptIndex++;
          this.cursorPosition = 0;

          this.dispatchEvent(
            new CustomEvent("prompt-submit", {
              detail: {
                key,
                message,
                value,
                index: this.currentPromptIndex - 1,
              },
              bubbles: true,
              composed: true,
            }),
          );

          setTimeout(() => this._showNextPrompt(), 0);
        }
      }),
      Match.when("Backspace", () => {
        e.preventDefault();
        if (this.cursorPosition > 0) {
          const before = currentState.input.slice(0, this.cursorPosition - 1);
          const after = currentState.input.slice(this.cursorPosition);
          const newInput = before + after;
          this.cursorPosition--;
          this._updateInput(newInput);
        }
      }),
      Match.when("ArrowLeft", () => {
        e.preventDefault();
        if (this.cursorPosition > 0) {
          this.cursorPosition--;
        }
      }),
      Match.when("ArrowRight", () => {
        e.preventDefault();
        if (this.cursorPosition < currentState.input.length) {
          this.cursorPosition++;
        }
      }),
      Match.when("Home", () => {
        e.preventDefault();
        this.cursorPosition = 0;
      }),
      Match.when("End", () => {
        e.preventDefault();
        this.cursorPosition = currentState.input.length;
      }),
      Match.when(
        (key) => key.length === 1,
        (key) => {
          const before = currentState.input.slice(0, this.cursorPosition);
          const after = currentState.input.slice(this.cursorPosition);
          const newInput = before + key + after;
          this.cursorPosition++;
          this._updateInput(newInput);
        },
      ),
      Match.orElse(() => {}),
    );
  }

  private _updateInput(newInput: string) {
    if (!this.terminalState.current) return;

    const maxLength = this.terminalState.current.maxLength;

    pipe(
      Match.value(newInput.length > maxLength),
      Match.when(true, () => {
        this.error = new PromptError({
          message: `Input exceeds maximum length of ${maxLength} characters`,
        });
        this.cursorPosition = Math.min(this.cursorPosition, maxLength);
      }),
      Match.when(false, () => {
        this.error = null;
        this.terminalState = {
          ...this.terminalState,
          current: {
            ...this.terminalState.current!,
            state: { ...this.terminalState.current!.state, input: newInput },
          },
        };
        this.cursorPosition = Math.min(this.cursorPosition, newInput.length);
      }),
      Match.exhaustive,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "text-prompt": TextPrompt;
    "prompt-terminal": PromptTerminal;
  }
}
