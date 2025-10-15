import { cva, type VariantProps } from "class-variance-authority";
import { css, html, LitElement, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TW } from "../../shared/tailwindMixin";
import { cn } from "../../shared/utils";

export const tooltipContentVariants = cva(
  "z-50 overflow-hidden rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
  {
    variants: {
      side: {
        top: "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2",
        bottom: "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2",
        left: "animate-in fade-in-0 zoom-in-95 slide-in-from-right-2",
        right: "animate-in fade-in-0 zoom-in-95 slide-in-from-left-2",
      },
    },
    defaultVariants: {
      side: "top",
    },
  },
);

type TooltipContentVariants = VariantProps<typeof tooltipContentVariants>;
type Side = NonNullable<TooltipContentVariants["side"]>;
type Align = "start" | "center" | "end";

@customElement("ui-tooltip")
export class Tooltip extends TW(LitElement) {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Number }) delayDuration = 700;

  @state() private _internalOpen = false;
  private showTimeout?: number;
  private hideTimeout?: number;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("tooltip-trigger-enter", this.handleTriggerEnter);
    this.addEventListener("tooltip-trigger-leave", this.handleTriggerLeave);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearTimers();
    this.removeEventListener("tooltip-trigger-enter", this.handleTriggerEnter);
    this.removeEventListener("tooltip-trigger-leave", this.handleTriggerLeave);
  }

  private clearTimers() {
    if (this.showTimeout) clearTimeout(this.showTimeout);
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
  }

  private handleTriggerEnter = () => {
    this.clearTimers();
    this.showTimeout = window.setTimeout(() => {
      this.setOpen(true);
    }, this.delayDuration);
  };

  private handleTriggerLeave = () => {
    this.clearTimers();
    this.hideTimeout = window.setTimeout(() => {
      this.setOpen(false);
    }, 100);
  };

  private setOpen(open: boolean) {
    this._internalOpen = open;
    this.open = open;
    this.dispatchEvent(
      new CustomEvent("tooltip-open-change", {
        detail: { open },
        bubbles: true,
        composed: true,
      }),
    );
  }

  override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (changedProperties.has("open")) {
      this._internalOpen = this.open;
    }
  }

  override render() {
    return html`<slot></slot>`;
  }

  getOpen(): boolean {
    return this._internalOpen;
  }
}

@customElement("ui-tooltip-trigger")
export class TooltipTrigger extends TW(LitElement) {
  static styles = css`
    :host {
      display: inline-block;
    }
  `;

  private triggerId =
    `tooltip-trigger-${Math.random().toString(36).substring(2, 11)}`;

  connectedCallback() {
    super.connectedCallback();
    this.id = this.triggerId;
  }

  private handleMouseEnter = () => {
    this.dispatchEvent(
      new CustomEvent("tooltip-trigger-enter", {
        bubbles: true,
        composed: true,
      }),
    );
  };

  private handleMouseLeave = () => {
    this.dispatchEvent(
      new CustomEvent("tooltip-trigger-leave", {
        bubbles: true,
        composed: true,
      }),
    );
  };

  private handleFocus = () => {
    this.dispatchEvent(
      new CustomEvent("tooltip-trigger-enter", {
        bubbles: true,
        composed: true,
      }),
    );
  };

  private handleBlur = () => {
    this.dispatchEvent(
      new CustomEvent("tooltip-trigger-leave", {
        bubbles: true,
        composed: true,
      }),
    );
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      this.dispatchEvent(
        new CustomEvent("tooltip-trigger-leave", {
          bubbles: true,
          composed: true,
        }),
      );
    }
  };

  override render() {
    return html`
      <div
        @mouseenter=${this.handleMouseEnter}
        @mouseleave=${this.handleMouseLeave}
        @focus=${this.handleFocus}
        @blur=${this.handleBlur}
        @keydown=${this.handleKeyDown}
        aria-describedby="tooltip-content-${this.triggerId}"
      >
        <slot></slot>
      </div>
    `;
  }
}

@customElement("ui-tooltip-content")
export class TooltipContent extends TW(LitElement) {
  @property({ type: String }) side: Side = "top";
  @property({ type: Number }) sideOffset = 4;
  @property({ type: String }) align: Align = "center";
  @property({ type: Boolean }) avoidCollisions = true;
  @property({ type: String, attribute: "aria-label" }) ariaLabel = "";

  @state() private isOpen = false;

  private tooltip: Tooltip | null = null;
  private trigger: TooltipTrigger | null = null;
  private contentId = "";
  private mutationObserver?: MutationObserver;

  connectedCallback() {
    super.connectedCallback();
    this.tooltip = this.closest("ui-tooltip");
    this.trigger = this.tooltip?.querySelector("ui-tooltip-trigger") || null;

    if (this.trigger) {
      this.contentId = `tooltip-content-${this.trigger.id}`;
    }

    this.setAttribute("popover", "manual");
    this.setAttribute("role", "tooltip");
    this.setAttribute("id", this.contentId);
    if (this.ariaLabel) {
      this.setAttribute("aria-label", this.ariaLabel);
    }

    this.observeTooltipState();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
  }

  private observeTooltipState() {
    if (this.tooltip) {
      this.mutationObserver = new MutationObserver(() => {
        const open = this.tooltip?.getOpen() || false;
        if (open !== this.isOpen) {
          this.isOpen = open;
          this.updatePopoverState();
        }
      });

      this.mutationObserver.observe(this.tooltip, {
        attributes: true,
        attributeFilter: ["open"],
      });

      this.isOpen = this.tooltip.getOpen();
      if (this.isOpen) {
        requestAnimationFrame(() => this.updatePopoverState());
      }
    }
  }

  private updatePopoverState() {
    try {
      if (this.isOpen) {
        if (!this.matches(":popover-open")) {
          this.showPopover();
        }
        this.updatePosition();
      } else {
        if (this.matches(":popover-open")) {
          this.hidePopover();
        }
      }
    } catch (e) {
      console.warn("Popover API not supported", e);
    }
  }

  private updatePosition() {
    if (!this.trigger || !this.isOpen) return;

    const triggerRect = this.trigger.getBoundingClientRect();
    const contentRect = this.getBoundingClientRect();

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let side = this.side;
    let top = 0;
    let left = 0;

    switch (side) {
      case "top":
        top = triggerRect.top - contentRect.height - this.sideOffset;
        break;
      case "bottom":
        top = triggerRect.bottom + this.sideOffset;
        break;
      case "left":
        left = triggerRect.left - contentRect.width - this.sideOffset;
        break;
      case "right":
        left = triggerRect.right + this.sideOffset;
        break;
    }

    if (side === "top" || side === "bottom") {
      switch (this.align) {
        case "start":
          left = triggerRect.left;
          break;
        case "center":
          left =
            triggerRect.left + triggerRect.width / 2 - contentRect.width / 2;
          break;
        case "end":
          left = triggerRect.right - contentRect.width;
          break;
      }
    } else {
      switch (this.align) {
        case "start":
          top = triggerRect.top;
          break;
        case "center":
          top =
            triggerRect.top + triggerRect.height / 2 - contentRect.height / 2;
          break;
        case "end":
          top = triggerRect.bottom - contentRect.height;
          break;
      }
    }

    if (this.avoidCollisions) {
      if (side === "top" && top < 0) {
        side = "bottom";
        top = triggerRect.bottom + this.sideOffset;
      } else if (
        side === "bottom" &&
        top + contentRect.height > viewport.height
      ) {
        side = "top";
        top = triggerRect.top - contentRect.height - this.sideOffset;
      } else if (side === "left" && left < 0) {
        side = "right";
        left = triggerRect.right + this.sideOffset;
      } else if (
        side === "right" &&
        left + contentRect.width > viewport.width
      ) {
        side = "left";
        left = triggerRect.left - contentRect.width - this.sideOffset;
      }

      if (left < 8) left = 8;
      if (left + contentRect.width > viewport.width) {
        left = viewport.width - contentRect.width - 8;
      }
      if (top < 8) top = 8;
      if (top + contentRect.height > viewport.height) {
        top = viewport.height - contentRect.height - 8;
      }
    }

    this.style.position = "fixed";
    this.style.top = `${top}px`;
    this.style.left = `${left}px`;
    this.style.margin = "0";
    this.setAttribute("data-side", side);
    this.className = cn(tooltipContentVariants({ side }));
  }

  override render() {
    return html`<slot></slot>`;
  }
}

@customElement("ui-tooltip-arrow")
export class TooltipArrow extends TW(LitElement) {
  @property({ type: Number }) width = 10;
  @property({ type: Number }) height = 5;

  @state() private side: Side = "top";

  connectedCallback() {
    super.connectedCallback();
    this.updateSide();
  }

  private updateSide() {
    const content = this.closest("ui-tooltip-content");
    if (content) {
      const observer = new MutationObserver(() => {
        const currentSide = content.getAttribute("data-side") as Side | null;
        if (currentSide) {
          this.side = currentSide;
        }
      });

      observer.observe(content, {
        attributes: true,
        attributeFilter: ["data-side"],
      });

      const currentSide = content.getAttribute("data-side") as Side | null;
      if (currentSide) {
        this.side = currentSide;
      }
    }
  }

  private getArrowStyle() {
    const baseStyle = `
      position: absolute;
      width: 0;
      height: 0;
      border-style: solid;
    `;

    switch (this.side) {
      case "top":
        return `${baseStyle}
          bottom: -${this.height}px;
          left: 50%;
          transform: translateX(-50%);
          border-width: ${this.height}px ${this.width / 2}px 0 ${this.width / 2}px;
          border-color: hsl(var(--popover)) transparent transparent transparent;
        `;
      case "bottom":
        return `${baseStyle}
          top: -${this.height}px;
          left: 50%;
          transform: translateX(-50%);
          border-width: 0 ${this.width / 2}px ${this.height}px ${this.width / 2}px;
          border-color: transparent transparent hsl(var(--popover)) transparent;
        `;
      case "left":
        return `${baseStyle}
          right: -${this.height}px;
          top: 50%;
          transform: translateY(-50%);
          border-width: ${this.width / 2}px 0 ${this.width / 2}px ${this.height}px;
          border-color: transparent transparent transparent hsl(var(--popover));
        `;
      case "right":
        return `${baseStyle}
          left: -${this.height}px;
          top: 50%;
          transform: translateY(-50%);
          border-width: ${this.width / 2}px ${this.height}px ${this.width / 2}px 0;
          border-color: transparent hsl(var(--popover)) transparent transparent;
        `;
    }
  }

  override render() {
    return html`
      <div style=${this.getArrowStyle()} aria-hidden="true"></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ui-tooltip": Tooltip;
    "ui-tooltip-trigger": TooltipTrigger;
    "ui-tooltip-content": TooltipContent;
    "ui-tooltip-arrow": TooltipArrow;
  }

  interface HTMLElementEventMap {
    "tooltip-open-change": CustomEvent<{ open: boolean }>;
    "tooltip-trigger-enter": CustomEvent;
    "tooltip-trigger-leave": CustomEvent;
  }
}
