import { Atom, Registry, Result } from "@effect-atom/atom";
import { Data, Effect } from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Minus, Plus } from "lucide-static";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import "./status-panel";
import "./ui/button/button";
import type { ButtonSize, ButtonVariant } from "./ui/button/button";

class CountError extends Data.TaggedError("CountError")<{ message: string }> {}

export const globalCountAtom = Atom.fn(
  (newValue: number) =>
    Effect.gen(function* () {
      if (newValue < -3) {
        return yield* new CountError({ message: "Count must be at least -3" });
      }
      yield* Effect.sleep("100 millis");
      yield* Effect.log("Global counter updated to:", newValue);
      return newValue;
    }),
  { initialValue: 0 },
);

const scopedRegistry = Registry.make({
  scheduleTask: (f) => queueMicrotask(f),
  timeoutResolution: 1000,
  defaultIdleTTL: 30_000,
});

const scopedCountAtom = Atom.fn(
  (newValue: number) =>
    Effect.gen(function* () {
      if (newValue < -3) {
        return yield* new CountError({ message: "Count must be at least -3" });
      }
      yield* Effect.sleep("100 millis");
      yield* Effect.log("Scoped counter updated to:", newValue);
      return newValue;
    }),
  { initialValue: 0 },
);

@customElement("global-status-panel")
export class GlobalStatusPanel extends TW(AtomMixin(LitElement)) {
  @atomState(globalCountAtom) declare countResult: Result.Result<
    number,
    CountError
  >;

  render() {
    return html`
      <status-panel
        class="w-full"
        .countResult=${this.countResult}
        label="Count"
        variant="default"
        registryType="global"
      ></status-panel>
    `;
  }
}

@customElement("scoped-status-panel")
export class ScopedStatusPanel extends TW(
  AtomMixin(LitElement, scopedRegistry),
) {
  @atomState(scopedCountAtom) declare countResult: Result.Result<
    number,
    CountError
  >;

  render() {
    return html`
      <status-panel
        class="w-full"
        .countResult=${this.countResult}
        label="Count"
        variant="accent"
        registryType="scoped"
      ></status-panel>
    `;
  }
}

@customElement("global-counter-controls")
export class GlobalCounterControls extends TW(AtomMixin(LitElement)) {
  @atomState(globalCountAtom) declare countResult: Result.Result<
    number,
    CountError
  >;

  @property({ type: String }) variant: ButtonVariant = "default";
  @property({ type: String }) size: ButtonSize = "icon-lg";

  render() {
    const isLoading = Result.isWaiting(this.countResult);

    return html`
      <div class="flex gap-2 sm:gap-4">
        <ui-button
          variant=${this.variant}
          size=${this.size}
          @click=${this._decrement}
          ?disabled=${isLoading}
          aria-label="Decrement global counter"
        >
          ${unsafeSVG(Minus)}
        </ui-button>
        <ui-button
          variant=${this.variant}
          size=${this.size}
          @click=${this._increment}
          ?disabled=${isLoading}
          aria-label="Increment global counter"
        >
          ${unsafeSVG(Plus)}
        </ui-button>
      </div>
    `;
  }

  private _increment() {
    this._updateCount(1);
  }

  private _decrement() {
    this._updateCount(-1);
  }

  private _updateCount(delta: number) {
    const setCount = this.useAtomSet(globalCountAtom);
    const currentValue = Result.isSuccess(this.countResult)
      ? this.countResult.value
      : 0;
    setCount(currentValue + delta);
  }
}

@customElement("scoped-counter-controls")
export class ScopedCounterControls extends TW(
  AtomMixin(LitElement, scopedRegistry),
) {
  @atomState(scopedCountAtom) declare countResult: Result.Result<
    number,
    CountError
  >;

  @property({ type: String }) variant: ButtonVariant = "default";
  @property({ type: String }) size: ButtonSize = "icon-lg";

  render() {
    const isLoading = Result.isWaiting(this.countResult);

    return html`
      <div class="flex gap-2 sm:gap-4">
        <ui-button
          variant=${this.variant}
          size=${this.size}
          @click=${this._decrement}
          ?disabled=${isLoading}
          aria-label="Decrement scoped counter"
        >
          ${unsafeSVG(Minus)}
        </ui-button>
        <ui-button
          variant=${this.variant}
          size=${this.size}
          @click=${this._increment}
          ?disabled=${isLoading}
          aria-label="Increment scoped counter"
        >
          ${unsafeSVG(Plus)}
        </ui-button>
      </div>
    `;
  }

  private _increment() {
    this._updateCount(1);
  }

  private _decrement() {
    this._updateCount(-1);
  }

  private _updateCount(delta: number) {
    const setCount = this.useAtomSet(scopedCountAtom);
    const currentValue = Result.isSuccess(this.countResult)
      ? this.countResult.value
      : 0;
    setCount(currentValue + delta);
  }
}

@customElement("registry-demo")
export class RegistryDemo extends TW(LitElement) {
  @property({ type: String }) variant: ButtonVariant = "default";
  @property({ type: String }) size: ButtonSize = "icon-lg";

  render() {
    return html`
      <div class="flex flex-col justify-center items-center gap-6 w-full">
        <div
          class="flex flex-col lg:flex-row gap-6 w-full justify-center items-stretch"
        >
          <div class="flex flex-col w-full items-center gap-4">
            <global-counter-controls
              variant=${this.variant}
              size=${this.size}
            ></global-counter-controls>
            <global-status-panel class="w-full"></global-status-panel>
          </div>

          <div class="flex flex-col w-full items-center gap-4">
            <scoped-counter-controls
              variant=${this.variant}
              size=${this.size}
            ></scoped-counter-controls>
            <scoped-status-panel class="w-full"></scoped-status-panel>
          </div>
        </div>

        <p class="text-muted-foreground text-xs sm:text-sm text-center px-2 max-w-2xl">
          Same status panel component with different registries. Global registry shares state across all instances, while scoped registry isolates state per instance.
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "registry-demo": RegistryDemo;
    "global-status-panel": GlobalStatusPanel;
    "scoped-status-panel": ScopedStatusPanel;
    "global-counter-controls": GlobalCounterControls;
    "scoped-counter-controls": ScopedCounterControls;
  }
}
