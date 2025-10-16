import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";
import { TW } from "../shared/tailwindMixin";
import { toast } from "./ui/Toast";

@customElement("toast-demo")
export class ToastDemo extends TW(LitElement) {
  private handleDefault() {
    toast("Event has been created", {
      description: new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date()),
    });
  }

  private handleSuccess() {
    toast.success("Success!", {
      description: "Your changes have been saved.",
    });
  }

  private handleError() {
    toast.error("Error!", {
      description: "Something went wrong.",
    });
  }

  private handleWarning() {
    toast.warning("Warning!", {
      description: "Please review your changes.",
    });
  }

  private handleInfo() {
    toast.info("Info", {
      description: "This is an informational message.",
    });
  }

  private handleAction() {
    toast("New update available", {
      description: "Click the button to refresh.",
      action: {
        label: "Refresh",
        onClick: () => alert("Refreshing..."),
      },
    });
  }

  private handlePromise() {
    const promise = new Promise<{ name: string }>((resolve, reject) => {
      setTimeout(() => {
        Math.random() > 0.5
          ? resolve({ name: "John" })
          : reject(new Error("Failed to load"));
      }, 2000);
    });

    toast.promise(promise, {
      loading: "Loading...",
      success: (data) => `Welcome ${data.name}!`,
      error: (err) => err.message,
    });
  }

  override render() {
    return html`
      <div class="flex flex-col gap-2">
        <ui-button @click=${this.handleDefault}>Default Toast</ui-button>
        <ui-button @click=${this.handleSuccess} variant="default"
          >Success Toast</ui-button
        >
        <ui-button @click=${this.handleError} variant="destructive"
          >Error Toast</ui-button
        >
        <ui-button @click=${this.handleWarning} variant="default"
          >Warning Toast</ui-button
        >
        <ui-button @click=${this.handleInfo} variant="default"
          >Info Toast</ui-button
        >
        <ui-button @click=${this.handleAction} variant="outline"
          >Toast with Action</ui-button
        >
        <ui-button @click=${this.handlePromise} variant="secondary"
          >Promise Toast</ui-button
        >
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "toast-demo": ToastDemo;
  }
}
