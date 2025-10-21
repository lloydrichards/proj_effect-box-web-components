import { Effect, Layer, Stream } from "effect";
import { html, LitElement } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Send, Trash2 } from "lucide-static";
import { AiService, ApiKey } from "../services/AiService";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { apiKeyStatusAtom, type ApiKeyStatus } from "./api-key-setup";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import "./api-key-setup";
import "./ui/button/button";
import "./ui/card/card";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
};

@customElement("ai-chat")
export class AiChat extends TW(AtomMixin(LitElement)) {
  @atomState(apiKeyStatusAtom) declare apiKeyStatus: ApiKeyStatus;

  @state() private _messages: Message[] = [];
  @state() private _inputValue = "";
  @state() private _isSending = false;

  @query("#messageInput") private _messageInput?: HTMLTextAreaElement;
  @query("#messagesContainer") private _messagesContainer?: HTMLDivElement;

  render() {
    if (this.apiKeyStatus.type !== "unlocked") {
      return html`
        <api-key-setup
          title="AI Chat Configuration"
          description="Configure your OpenAI API key to start chatting"
        ></api-key-setup>
      `;
    }
    return html`
      <ui-card>
        <ui-card-header class="relative border-b border-border ">
          <ui-card-title>AI Chat</ui-card-title>
          <ui-card-description>Chat with an AI assistant</ui-card-description>
          <ui-card-action>
            <ui-button
              class="top-0 right-8 absolute"
              variant="ghost"
              size="icon-sm"
              @click=${this._handleClear}
              aria-label="Clear chat"
            >
              ${unsafeSVG(Trash2)}
            </ui-button>
          </ui-card-action>
        </ui-card-header>

        <ui-card-content>
          <div id="messagesContainer" class="space-y-4">
            ${this._renderMessages()}
          </div>
        </ui-card-content>

        <ui-card-footer class="border-t border-border pt-4">
          <div class="flex gap-2 w-full">
            <textarea
              id="messageInput"
              .value=${this._inputValue}
              @input=${this._handleInput}
              @keydown=${this._handleKeyDown}
              placeholder="Type your message..."
              class="flex-1 resize-none min-h-[2.5rem]"
              rows="2"
            ></textarea>
            <ui-button
              variant="default"
              size="icon"
              @click=${this._handleSend}
              ?disabled=${!this._inputValue || this._isSending}
              aria-label="Send message"
            >
              ${unsafeSVG(Send)}
            </ui-button>
          </div>
        </ui-card-footer>
      </ui-card>
    `;
  }

  private _renderMessages() {
    if (!this._messages.length) {
      return html`
        <div class="text-center text-muted-foreground py-8">
          Start a conversation
        </div>
      `;
    }

    return html`
      ${this._messages.map((msg) => this._renderMessage(msg))}
      ${
        this._isSending
          ? html`
        <div class="flex items-start">
          <div class="px-4 py-2 rounded-lg max-w-[80%] bg-muted">
            <div class="flex items-center gap-2">
              <div class="animate-spin h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full"></div>
              <span class="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        </div>
      `
          : ""
      }
    `;
  }

  private _renderMessage(message: Message) {
    const isUser = message.role === "user";
    return html`
      <div class=${cn("flex", isUser ? "justify-end" : "justify-start")}>
        <div class=${cn(
          "px-4 py-2 rounded-lg max-w-[80%]",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}>
          <div class="whitespace-pre-wrap text-sm">${message.content}</div>
          <div class="text-xs mt-1 opacity-70">
            ${new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    `;
  }

  private _handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this._inputValue = target.value;
  }

  private _handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this._handleSend();
    }
  }

  private async _handleSend() {
    if (!this._inputValue || this._isSending) return;
    if (this.apiKeyStatus.type !== "unlocked") return;

    const userMessage = this._inputValue;
    this._inputValue = "";
    this._isSending = true;

    if (this._messageInput) {
      this._messageInput.value = "";
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userMessage,
      timestamp: Date.now(),
    };

    this._messages = [...this._messages, userMsg];

    try {
      const effect = Effect.gen(function* () {
        const stream = yield* AiService.streamText(userMessage);
        let fullText = "";

        yield* Stream.runForEach(stream, (chunk) =>
          Effect.sync(() => {
            if (chunk.type === "text-delta") {
              fullText += chunk.delta;
            }
          }),
        );

        return fullText;
      }).pipe(
        Effect.provide(
          AiService.Default.pipe(
            Layer.provide(Layer.succeed(ApiKey, this.apiKeyStatus.apiKey)),
          ),
        ),
      );

      const fullText = await Effect.runPromise(effect);

      if (fullText) {
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullText,
          timestamp: Date.now(),
        };

        this._messages = [...this._messages, assistantMsg];
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      };
      this._messages = [...this._messages, errorMsg];
    } finally {
      this._isSending = false;
      this._scrollToBottom();
    }
  }

  private _handleClear() {
    this._messages = [];
  }

  private _scrollToBottom() {
    requestAnimationFrame(() => {
      if (this._messagesContainer) {
        this._messagesContainer.scrollTop =
          this._messagesContainer.scrollHeight;
      }
    });
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has("_messages")) {
      this._scrollToBottom();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ai-chat": AiChat;
  }
}
