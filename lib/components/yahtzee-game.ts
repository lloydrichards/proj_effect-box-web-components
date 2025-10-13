import { Atom } from "@effect-atom/atom";
import { Data, Effect, Random } from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import {
  Dice1,
  Dice2,
  Dice3,
  Dice4,
  Dice5,
  Dice6,
  RotateCcw,
  Trophy,
} from "lucide-static";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import { cn } from "../shared/utils";
import { buttonVariants } from "./ui/Button";

type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

interface PlayerState {
  name: string;
  dice: readonly DiceValue[];
  held: readonly boolean[];
  rollsRemaining: number;
  score: number;
  isActive: boolean;
}

interface GameState {
  players: readonly PlayerState[];
  currentPlayerIndex: number;
  round: number;
  gameOver: boolean;
  winners: readonly string[];
}

class YahtzeeError extends Data.TaggedError("YahtzeeError")<{
  message: string;
}> {}

class YahtzeeService extends Effect.Service<YahtzeeService>()(
  "YahtzeeService",
  {
    effect: Effect.gen(function* () {
      const rollDice = (
        heldDice: readonly boolean[],
        currentDice: readonly DiceValue[],
      ) =>
        Effect.gen(function* () {
          const newDice = yield* Effect.forEach(
            heldDice,
            (isHeld, index) =>
              isHeld
                ? Effect.succeed(currentDice[index] || (1 as DiceValue))
                : Random.nextIntBetween(1, 7).pipe(
                    Effect.map((n) => n as DiceValue),
                  ),
            { concurrency: "unbounded" },
          );
          return newDice;
        });

      const calculateScore = (dice: readonly DiceValue[]): number => {
        const counts = dice.reduce(
          (acc, val) => {
            acc[val] = (acc[val] || 0) + 1;
            return acc;
          },
          {} as Record<number, number>,
        );

        const values = Object.values(counts);
        const maxCount = Math.max(...values);

        if (maxCount === 5) return 50;
        if (maxCount === 4) return 40;
        if (maxCount === 3 && values.includes(2)) return 25;
        if (maxCount === 3) return 20;

        const sorted = [...dice].sort();
        const isSmallStraight =
          sorted.join("").includes("1234") || sorted.join("").includes("2345");
        const isLargeStraight =
          sorted.join("") === "12345" || sorted.join("") === "23456";

        if (isLargeStraight) return 40;
        if (isSmallStraight) return 30;

        return dice.reduce((sum, val) => sum + val, 0);
      };

      const endTurn = (
        playerIndex: number,
        players: readonly PlayerState[],
        currentRound: number,
      ) =>
        Effect.gen(function* () {
          const nextPlayerIndex = (playerIndex + 1) % players.length;
          const isRoundComplete = nextPlayerIndex === 0;

          const newRound = isRoundComplete ? currentRound + 1 : currentRound;

          if (newRound > 3) {
            const scores = players.map((p) => ({
              name: p.name,
              score: p.score,
            }));
            const maxScore = Math.max(...scores.map((s) => s.score));
            const winners = scores
              .filter((s) => s.score === maxScore)
              .map((s) => s.name);

            return yield* Effect.succeed({
              gameOver: true,
              winners,
            } as const);
          }

          return yield* Effect.succeed({
            gameOver: false,
            nextPlayerIndex,
            newRound,
          } as const);
        });

      const newGame = (playerNames: readonly string[]) =>
        Effect.succeed({
          players: playerNames.map((name, index) => ({
            name,
            dice: [1, 1, 1, 1, 1] as const,
            held: [false, false, false, false, false] as const,
            rollsRemaining: 3,
            score: 0,
            isActive: index === 0,
          })),
          currentPlayerIndex: 0,
          round: 1,
          gameOver: false,
          winners: [],
        });

      return {
        rollDice,
        calculateScore,
        endTurn,
        newGame,
      } as const;
    }),
  },
) {}

const gameStateAtom = Atom.make<GameState>({
  players: [],
  currentPlayerIndex: 0,
  round: 1,
  gameOver: false,
  winners: [],
});

const diceIcons = {
  1: Dice1,
  2: Dice2,
  3: Dice3,
  4: Dice4,
  5: Dice5,
  6: Dice6,
};

@customElement("yahtzee-status")
export class YahtzeeStatus extends TW(AtomMixin(LitElement)) {
  @atomState(gameStateAtom) declare gameState: GameState;

  render() {
    const currentPlayer =
      this.gameState.players[this.gameState.currentPlayerIndex];

    if (this.gameState.gameOver) {
      const isDraw = this.gameState.winners.length > 1;
      return html`
        <div class="flex flex-col items-center gap-2 p-4 bg-green-50/10 border-2 border-green-500 rounded-lg">
          <div class="flex items-center gap-2">
            <span class="[&_svg]:size-6 text-yellow-500">${unsafeSVG(Trophy)}</span>
            <h3 class="text-xl font-bold text-green-700">Game Over!</h3>
          </div>
          <p class="text-lg font-semibold">
            ${isDraw ? `Draw: ${this.gameState.winners.join(", ")}` : `Winner: ${this.gameState.winners[0]}`}
          </p>
          <div class="flex gap-4 text-sm">
            ${this.gameState.players.map(
              (p) => html`
                <span class="${this.gameState.winners.includes(p.name) ? "font-bold text-green-700" : ""}">
                  ${p.name}: ${p.score} pts
                </span>
              `,
            )}
          </div>
        </div>
      `;
    }

    return html`
      <div class="flex flex-row items-center justify-between gap-3 p-4 border-2 rounded-lg w-full">
          <div class="text-center">
            <span class="text-sm">Round</span>
            <p class="text-2xl font-bold">${this.gameState.round} / 3</p>
          </div>
          <div class="w-px h-12 bg-border"></div>
          <div class="text-center">
            <span class="text-sm">Current Player</span>
            <p class="text-xl font-bold">${currentPlayer?.name || "..."}</p>
          </div>
        <div class="flex gap-4 text-sm">
          ${this.gameState.players.map(
            (p) => html`
              <div class="text-center">
                <p class="font-semibold">
                  ${p.name}
                </p>
                <p class="text-xs">${p.score} pts</p>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }
}

@customElement("yahtzee-player")
export class YahtzeePlayer extends TW(AtomMixin(LitElement)) {
  @atomState(gameStateAtom) declare gameState: GameState;
  @property({ type: String }) name = "Player";
  @property({ type: Number }) playerIndex = 0;

  render() {
    const player = this.gameState.players[this.playerIndex];
    if (!player) return html``;

    const canRoll = player.isActive && player.rollsRemaining > 0;
    const isWinner =
      this.gameState.gameOver && this.gameState.winners.includes(player.name);
    const isLoser =
      this.gameState.gameOver && !this.gameState.winners.includes(player.name);

    return html`
      <div
        class="${cn(
          "flex flex-col justify-center items-center gap-3 p-4 rounded-lg border-2 transition-all",
          player.isActive && !this.gameState.gameOver
            ? "border-blue-500"
            : "border-gray-300",
          isWinner && "border-green-500 bg-green-50/10",
          isLoser && "opacity-60",
        )}"
      >
        <div class="flex items-center gap-2">
          <h4 class="text-lg font-bold">${player.name}</h4>
          ${
            isWinner
              ? html`<span class="[&_svg]:size-5 text-yellow-500"
                  >${unsafeSVG(Trophy)}</span
                >`
              : ""
          }
        </div>

        <div class="flex gap-2 flex-wrap justify-center">
          ${player.dice.map(
            (value, index) => html`
              <button
                class="${cn(
                  "p-3 rounded-lg transition-all",
                  player.held[index]
                    ? "bg-blue-100/10 border-2 border-blue-500"
                    : "border-2 border-gray-300/10 hover:border-gray-400",
                  "[&_svg]:size-10",
                )}"
                @click=${() => this._toggleHold(index)}
                ?disabled=${!canRoll || this.gameState.gameOver}
              >
                ${unsafeSVG(diceIcons[value])}
              </button>
            `,
          )}
        </div>

        <div class="flex gap-2 items-center w-full justify-stretch">
          <button
            class="${cn(
              buttonVariants({ variant: "default", size: "default" }),
              "flex-1",
            )}"
            @click=${this._rollDice}
            ?disabled=${!canRoll || this.gameState.gameOver}
          >
            Roll (${player.rollsRemaining} left)
          </button>

          <button
            class="${cn(
              buttonVariants({ variant: "outline", size: "default" }),
            )}"
            @click=${this._endTurn}
            ?disabled=${!player.isActive || this.gameState.gameOver}
          >
            End Turn
          </button>
        </div>

        <div class="text-center">
          <p class="text-sm">
            Score:
            <strong class="text-lg">${player.score}</strong>
          </p>
        </div>
      </div>
    `;
  }

  private _toggleHold(index: number) {
    const registry = this.getAtomRegistry();
    const currentState = registry.get(gameStateAtom);
    const player = currentState.players[this.playerIndex];

    if (!player || !player.isActive) return;

    const updatedPlayers = currentState.players.map((p, i) =>
      i === this.playerIndex
        ? {
            ...p,
            held: p.held.map((h, hIndex) => (hIndex === index ? !h : h)),
          }
        : p,
    );

    registry.set(gameStateAtom, {
      ...currentState,
      players: updatedPlayers,
    });
  }

  private _rollDice() {
    const registry = this.getAtomRegistry();
    const playerIndex = this.playerIndex;

    const program = Effect.gen(function* () {
      const service = yield* YahtzeeService;
      const currentState = registry.get(gameStateAtom);
      const player = currentState.players[playerIndex];

      if (!player || player.rollsRemaining <= 0) {
        return yield* new YahtzeeError({ message: "No rolls remaining" });
      }

      const newDice = yield* service.rollDice(player.held, player.dice);
      const newScore = service.calculateScore(newDice);

      const updatedPlayers = currentState.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              dice: newDice,
              rollsRemaining: p.rollsRemaining - 1,
              score: newScore,
            }
          : p,
      );

      registry.set(gameStateAtom, {
        ...currentState,
        players: updatedPlayers,
      });
    });

    Effect.runPromise(program.pipe(Effect.provide(YahtzeeService.Default)));
  }

  private _endTurn() {
    const registry = this.getAtomRegistry();
    const playerIndex = this.playerIndex;

    const program = Effect.gen(function* () {
      const service = yield* YahtzeeService;
      const currentState = registry.get(gameStateAtom);

      const result = yield* service.endTurn(
        playerIndex,
        currentState.players,
        currentState.round,
      );

      if (result.gameOver && "winners" in result) {
        registry.set(gameStateAtom, {
          ...currentState,
          gameOver: true,
          winners: result.winners,
          players: currentState.players.map((p) => ({ ...p, isActive: false })),
        });
      } else if ("nextPlayerIndex" in result) {
        const nextIndex = result.nextPlayerIndex;
        const updatedPlayers = currentState.players.map((p, i) => ({
          ...p,
          isActive: i === nextIndex,
          rollsRemaining: i === nextIndex ? 3 : p.rollsRemaining,
          held: i === nextIndex ? [false, false, false, false, false] : p.held,
        }));

        registry.set(gameStateAtom, {
          ...currentState,
          players: updatedPlayers,
          currentPlayerIndex: nextIndex,
          round: "newRound" in result ? result.newRound : currentState.round,
        });
      }
    });

    Effect.runPromise(program.pipe(Effect.provide(YahtzeeService.Default)));
  }
}

@customElement("yahtzee-game")
export class YahtzeeGame extends TW(AtomMixin(LitElement)) {
  @atomState(gameStateAtom) declare gameState: GameState;

  connectedCallback() {
    super.connectedCallback();
    this._initializeGame();
  }

  render() {
    return html`
      <div class="flex flex-col justify-center items-center gap-4 w-full">
        <div class="">
          <h3 class="text-2xl text-center font-bold mb-2">
            ${
              this.gameState.gameOver
                ? this.gameState.winners.length > 1
                  ? `🎉 Draw: ${this.gameState.winners.join(", ")}!`
                  : `🎉 ${this.gameState.winners[0]} Wins!`
                : "Yahtzee Game"
            }
          </h3>
          <div class="text-gray-400 text-xs max-w-md mb-4">
            <p class="font-medium mb-1">How to Play:</p>
            <p>
              Each player gets 3 rolls per turn. Click dice to hold them, then
              roll the rest. Higher scores win! Try for Yahtzee (all 5 dice
              matching) for 50 points!
            </p>
          </div>
        </div>

        <div class="flex flex-col gap-4 justify-center w-full">
          <slot name="status"></slot>
          <slot></slot>
        </div>

        <button
          class="${cn(
            buttonVariants({ variant: "ghost", size: "default" }),
            "[&_svg]:size-4 flex gap-2",
          )}"
          @click=${this._newGame}
          title="New Game"
        >
          <span>New Game</span> ${unsafeSVG(RotateCcw)}
        </button>
      </div>
    `;
  }

  private _initializeGame() {
    const registry = this.getAtomRegistry();
    const currentState = registry.get(gameStateAtom);

    if (currentState.players.length === 0) {
      const slots = this.querySelectorAll("yahtzee-player");
      const playerNames = Array.from(slots).map(
        (slot, i) => (slot as YahtzeePlayer).name || `Player ${i + 1}`,
      );

      const program = Effect.gen(function* () {
        const service = yield* YahtzeeService;
        const newState = yield* service.newGame(playerNames);
        registry.set(gameStateAtom, newState);
      });

      Effect.runPromise(program.pipe(Effect.provide(YahtzeeService.Default)));
    }
  }

  private _newGame() {
    const registry = this.getAtomRegistry();
    const slots = this.querySelectorAll("yahtzee-player");
    const playerNames = Array.from(slots).map(
      (slot, i) => (slot as YahtzeePlayer).name || `Player ${i + 1}`,
    );

    const program = Effect.gen(function* () {
      const service = yield* YahtzeeService;
      const newState = yield* service.newGame(playerNames);
      registry.set(gameStateAtom, newState);
    });

    Effect.runPromise(program.pipe(Effect.provide(YahtzeeService.Default)));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "yahtzee-game": YahtzeeGame;
    "yahtzee-player": YahtzeePlayer;
    "yahtzee-status": YahtzeeStatus;
  }
}
