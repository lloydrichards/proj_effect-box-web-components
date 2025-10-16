import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { HelpCircle } from "lucide-static";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import "./ui/Button";
import "./ui/Card";
import "./ui/Field";
import { inputStyles } from "./ui/Input";
import "./ui/Select";
import "./ui/Tabs";
import "./ui/Tooltip";

type FormData = {
  name: string;
  role: string;
  subscribe: boolean;
};

@customElement("registration-form")
export class RegistrationForm extends TW(LitElement) {
  @state() private submittedData: FormData | null = null;
  @state() private errors: Partial<Record<keyof FormData, string>> = {};
  @state() private activeTab = "form";

  private handleSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const data: FormData = {
      name: formData.get("name") as string,
      role: formData.get("role") as string,
      subscribe: formData.get("subscribe") === "on",
    };

    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!data.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!data.role) {
      newErrors.role = "Please select a role";
    }

    this.errors = newErrors;

    this.submittedData = data;
    this.activeTab = "result";
  }

  private handleReset() {
    this.submittedData = null;
    this.errors = {};
    this.activeTab = "form";
  }

  render() {
    return html`
      <div class="flex flex-col items-center gap-6 w-full px-4 py-8">
        <div class="w-full max-w-2xl">
          <ui-tabs
            .value=${this.activeTab}
            @change=${(e: CustomEvent) => {
              if (
                e.target instanceof HTMLElement &&
                e.target.tagName === "UI-TABS"
              ) {
                this.activeTab = e.detail.value;
              }
            }}
          >
            <ui-tabs-list>
              <ui-tabs-trigger value="form">Form</ui-tabs-trigger>
              <ui-tabs-trigger value="result">Result</ui-tabs-trigger>
            </ui-tabs-list>

            <ui-tabs-content value="form">
              ${this.renderForm()}
            </ui-tabs-content>

            <ui-tabs-content value="result">
              ${this.renderResults()}
            </ui-tabs-content>
          </ui-tabs>
        </div>

        <p class="text-muted-foreground text-xs sm:text-sm text-center max-w-2xl">
          This is a demo registration form. Fill it out and submit to see the
          results in the Result tab.
        </p>
      </div>
    `;
  }

  private renderForm() {
    return html`
      <ui-card>
            <ui-card-header>
              <ui-card-title><slot></slot></ui-card-title>
              <ui-card-description>
                Fill out the form below to register.
              </ui-card-description>
            </ui-card-header>

            <ui-card-content>
              <form @submit=${this.handleSubmit} @reset=${this.handleReset} novalidate>
                <ui-field-group>
                  <ui-field ?invalid=${!!this.errors.name}>
                    <div class="flex items-center gap-2">
                      <label for="name" class="text-sm font-medium"
                        >Full Name</label
                      >
                      <ui-tooltip delay-duration="300">
                        <ui-tooltip-trigger>
                          <ui-button
                            variant="ghost"
                            size="icon-sm"
                            class="text-muted-foreground/60"
                            aria-label="Name field help"
                          >
                           ${unsafeSVG(HelpCircle)}
                          </ui-button>
                        </ui-tooltip-trigger>
                        <ui-tooltip-content side="top">
                          Enter your first and last name
                        </ui-tooltip-content>
                      </ui-tooltip>
                    </div>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      class=${cn(inputStyles)}
                      placeholder="John Doe"
                      aria-invalid=${!!this.errors.name}
                    />
                    ${
                      this.errors.name
                        ? html`<ui-field-error
                          >${this.errors.name}</ui-field-error
                        >`
                        : ""
                    }
                  </ui-field>

                  <ui-field ?invalid=${!!this.errors.role}>
                    <div class="flex items-center gap-2">
                      <label for="role" class="text-sm font-medium">Role</label>
                      <ui-tooltip delay-duration="300">
                        <ui-tooltip-trigger>
                          <ui-button
                            variant="ghost"
                            size="icon-sm"
                            class="text-muted-foreground/60"
                            aria-label="Role field help"
                          >
                            ${unsafeSVG(HelpCircle)}
                          </ui-button>
                        </ui-tooltip-trigger>
                        <ui-tooltip-content side="top">
                          Select your primary role
                        
                        </ui-tooltip-content>
                      </ui-tooltip>
                    </div>
                    <ui-select id="role" name="role" value="">
                      <ui-select-trigger>
                        <ui-select-value placeholder="Select a role..."></ui-select-value>
                      </ui-select-trigger>
                      <ui-select-content>
                        <ui-select-item value="developer">Developer</ui-select-item>
                        <ui-select-item value="designer">Designer</ui-select-item>
                        <ui-select-item value="manager">Manager</ui-select-item>
                        <ui-select-item value="other">Other</ui-select-item>
                      </ui-select-content>
                    </ui-select>
                    ${
                      this.errors.role
                        ? html`<ui-field-error
                          >${this.errors.role}</ui-field-error
                        >`
                        : ""
                    }
                  </ui-field>

                  <ui-field orientation="horizontal">
                    <div class="flex items-center gap-2">
                      <input
                        id="subscribe"
                        name="subscribe"
                        type="checkbox"
                        class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
                      />
                      <label for="subscribe" class="text-sm font-medium"
                        >Subscribe to newsletter</label
                      >
                      <ui-tooltip delay-duration="300">
                        <ui-tooltip-trigger>
                          <ui-button
                            variant="ghost"
                            size="icon-sm"
                            class="text-muted-foreground/60"
                            aria-label="Newsletter subscription help"
                          >
                            ${unsafeSVG(HelpCircle)}
                          </ui-button>
                        </ui-tooltip-trigger>
                        <ui-tooltip-content side="top">
                          Receive updates and news via email
                        </ui-tooltip-content>
                      </ui-tooltip>
                    </div>
                  </ui-field>
                </ui-field-group>

                <div class="flex gap-3 mt-6">
                  <ui-button type="submit" variant="default">
                    Submit
                  </ui-button>
                  <ui-button type="reset" variant="outline"> Reset </ui-button>
                </div>
              </form>
            </ui-card-content>
          </ui-card>
    `;
  }

  private renderResults() {
    const hasErrors = Object.keys(this.errors).length > 0;
    const hasData = this.submittedData !== null;

    return html`
      <ui-card>
        <ui-card-header>
          <ui-card-title>Form Submission Results</ui-card-title>
          <ui-card-description>
            ${
              hasData
                ? hasErrors
                  ? "Form data submitted with validation errors"
                  : "Here's the data that was submitted from the form"
                : "No data submitted yet. Fill out the form and press Submit."
            }
          </ui-card-description>
        </ui-card-header>

        <ui-card-content>
          ${
            hasData
              ? html`
                ${
                  hasErrors
                    ? html`
                      <div class="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <p class="text-sm font-medium text-destructive mb-2">
                          Validation Errors:
                        </p>
                        <ul class="text-sm text-destructive/90 list-disc list-inside">
                          ${Object.entries(this.errors).map(
                            ([field, error]) =>
                              html`<li>${field}: ${error}</li>`,
                          )}
                        </ul>
                      </div>
                    `
                    : ""
                }
                <pre
                  class="bg-muted text-foreground p-4 rounded-lg overflow-x-auto text-sm"
                >${JSON.stringify(this.submittedData, null, 2)}</pre>
              `
              : html`
                <p class="text-muted-foreground text-sm">
                  Submit the form to see the results here.
                </p>
              `
          }

          <ui-button
            @click=${() => {
              this.activeTab = "form";
            }}
            variant="outline"
            class="mt-6"
          >
            Back to Form
          </ui-button>

          ${
            hasData
              ? html`
                <ui-button
                  @click=${this.handleReset}
                  variant="default"
                  class="mt-6 ml-3"
                >
                  Reset Form
                </ui-button>
              `
              : ""
          }
        </ui-card-content>
      </ui-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "registration-form": RegistrationForm;
  }
}
