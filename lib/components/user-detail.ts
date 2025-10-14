import { Atom, Result } from "@effect-atom/atom";
import { Data, Effect } from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { Mail, RefreshCw, User } from "lucide-static";
import { AtomMixin, matchResult } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import { buttonVariants } from "./ui/Button";
import "./ui/Button";
import "./ui/Card";
import "./ui/Item";

class UserError extends Data.TaggedError("UserError")<{ message: string }> {}

class UserService extends Effect.Service<UserService>()("UserService", {
  effect: Effect.gen(function* () {
    const fetchUser = (id: string) =>
      Effect.gen(function* () {
        if (id === "error") {
          return yield* new UserError({ message: "User not found" });
        }

        yield* Effect.sleep("500 millis");

        return {
          id,
          name: `User ${id}`,
          email: `user${id}@example.com`,
          loadedAt: Date.now(),
        };
      });

    return { fetchUser } as const;
  }),
}) {}

const userRuntime = Atom.runtime(UserService.Default);

const userAtomFamily = Atom.family((userId: string) =>
  userRuntime
    .atom(
      Effect.gen(function* () {
        const service = yield* UserService;
        const user = yield* service.fetchUser(userId);
        return user;
      }),
    )
    .pipe(Atom.withReactivity(["users"])),
);

const refreshCountAtom = Atom.make(0);

@customElement("user-detail")
export class UserDetail extends TW(AtomMixin(LitElement)) {
  @property({ type: String }) userId = "1";
  @property() docsHint =
    "Demonstrates Atom.family, auto-subscribe, and reactivity keys";

  render() {
    const userAtom = userAtomFamily(this.userId);
    this.useAtomMount(userAtom, { reactivityKeys: ["users"] });
    const userResult = this.useAtomValue(userAtom);
    const refreshCount = this.useAtomValue(refreshCountAtom);
    const refresh = this.useAtomRefresh(userAtom);

    return html`
      <div class="flex flex-col justify-center items-center gap-4 w-full">
        <slot></slot>

        <ui-card style="width: 100%; max-width: 28rem;">
          <ui-card-header>
            <ui-card-title>
              <span class="flex items-center gap-2">
                <span class="[&_svg]:size-4">${unsafeSVG(User)}</span>
                User Details
              </span>
            </ui-card-title>
            <ui-card-action>
              <button
                class="${cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "[&_svg]:size-3.5",
                )}"
                @click=${() => {
                  refresh();
                  const setCount = this.useAtomSet(refreshCountAtom);
                  setCount((c) => c + 1);
                }}
                ?disabled=${Result.isWaiting(userResult)}
                title="Refresh user data"
              >
                ${unsafeSVG(RefreshCw)}
              </button>
            </ui-card-action>
          </ui-card-header>

          <ui-card-content>
            ${matchResult(userResult, {
              onInitial: () => html`
                <div class="text-center py-6">
                  <p class="text-sm text-muted-foreground">Loading user...</p>
                </div>
              `,
              onSuccess: (user) => html`
                <ui-item variant="outline" size="default">
                  <ui-item-media variant="icon">
                    <span class="[&_svg]:size-5">${unsafeSVG(User)}</span>
                  </ui-item-media>
                  
                  <ui-item-content>
                    <ui-item-title>${user.name}</ui-item-title>
                    <ui-item-description>
                      <span class="inline-flex items-center gap-1.5">
                        <span class="[&_svg]:size-3.5">${unsafeSVG(Mail)}</span>
                        ${user.email}
                      </span>
                    </ui-item-description>
                  </ui-item-content>
                </ui-item>
                
                <div class="mt-4 flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>User ID: <span class="font-mono font-medium">${user.id}</span></span>
                  <span>Loaded at ${new Date(user.loadedAt).toLocaleTimeString()}</span>
                </div>
              `,
              onFailure: (error) => html`
                <div class="text-center py-6">
                  <p class="text-sm text-destructive font-medium">${error.message}</p>
                </div>
              `,
              onWaiting: () => html`
                <div class="text-center py-6">
                  <p class="text-sm text-foreground">Loading user...</p>
                </div>
              `,
            })}
          </ui-card-content>

          <ui-card-footer style="border-top: 1px solid hsl(var(--border));">
            <p class="text-xs text-muted-foreground text-center w-full">
              Refreshed ${refreshCount}×
            </p>
          </ui-card-footer>
        </ui-card>

        <div class="flex gap-2 flex-wrap justify-center max-w-sm">
          ${["1", "2", "3", "error"].map(
            (id) => html`
              <button
                class="${cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}"
                @click=${() => {
                  this.userId = id;
                }}
              >
                User ${id}
              </ui-button>
            `,
          )}
        </div>

        <p class="text-muted-foreground text-xs sm:text-sm text-center px-2 max-w-sm">
          ${this.docsHint}
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "user-detail": UserDetail;
  }
}
