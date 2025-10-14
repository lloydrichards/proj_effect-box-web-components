import { Atom } from "@effect-atom/atom";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Array,
  Duration,
  Effect,
  Option,
  Random,
  Schedule,
  Stream,
} from "effect";
import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { unsafeSVG } from "lit/directives/unsafe-svg.js";
import { RefreshCw } from "lucide-static";
import { AtomMixin, atomState } from "../shared/atomMixin";
import { TW } from "../shared/tailwindMixin";
import "./ui/Button";

interface Cell {
  x: number;
  y: number;
  walls: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
  visited: boolean;
}

interface Maze {
  width: number;
  height: number;
  cells: Cell[][];
  startPosition: { x: number; y: number };
  endPosition: { x: number; y: number };
  currentPosition: { x: number; y: number };
  completed: boolean;
}

interface MazeConfig {
  width: number;
  height: number;
  speed: number;
}

const cellVariant = cva("", {
  variants: {
    variant: {
      start: "bg-primary/60",
      end: "bg-destructive/60",
      current: "bg-accent",
      normal: null,
    },
    topWall: {
      true: "border-t",
      false: null,
    },
    rightWall: {
      true: "border-r",
      false: null,
    },
    bottomWall: {
      true: "border-b",
      false: null,
    },
    leftWall: {
      true: "border-l",
      false: null,
    },
    disabled: {
      true: "border-border/30",
      false: null,
    },
  },
  defaultVariants: {},
});

const createEmptyGrid = (width: number, height: number): Cell[][] => {
  return Array.makeBy(height, (y) =>
    Array.makeBy(width, (x) => ({
      x,
      y,
      walls: { top: true, right: true, bottom: true, left: true },
      visited: false,
    })),
  );
};

const getNeighbors = (
  cell: Cell,
  grid: Cell[][],
  width: number,
  height: number,
): Cell[] => {
  const neighbors: Cell[] = [];
  const { x, y } = cell;

  if (y > 0) neighbors.push(grid[y - 1][x]);
  if (x < width - 1) neighbors.push(grid[y][x + 1]);
  if (y < height - 1) neighbors.push(grid[y + 1][x]);
  if (x > 0) neighbors.push(grid[y][x - 1]);

  return neighbors.filter((n) => !n.visited);
};

const removeWallBetween = (current: Cell, next: Cell): void => {
  const dx = next.x - current.x;
  const dy = next.y - current.y;

  if (dx === 1) {
    current.walls.right = false;
    next.walls.left = false;
  } else if (dx === -1) {
    current.walls.left = false;
    next.walls.right = false;
  } else if (dy === 1) {
    current.walls.bottom = false;
    next.walls.top = false;
  } else if (dy === -1) {
    current.walls.top = false;
    next.walls.bottom = false;
  }
};

const currentMazeAtom = Atom.make<Maze | null>(null);

const mazeStreamAtom = Atom.family(({ height, width, speed }: MazeConfig) => {
  if (width < 3 || height < 3 || width > 50 || height > 50) {
    return Atom.make(() => Stream.empty);
  }

  const grid = createEmptyGrid(width, height);
  const startPosition = { x: 0, y: 0 };
  const endPosition = { x: width - 1, y: height - 1 };
  const startCell = grid[0][0];
  const initialStack: Cell[] = [startCell];
  startCell.visited = true;

  return Atom.make((get) =>
    Stream.unfoldEffect(initialStack, (stack) =>
      Effect.gen(function* () {
        if (stack.length === 0) {
          const completedMaze: Maze = {
            width,
            height,
            cells: grid,
            startPosition,
            endPosition,
            currentPosition: endPosition,
            completed: true,
          };
          get.set(currentMazeAtom, completedMaze);
          return Option.none();
        }

        const current = stack[stack.length - 1];
        const neighbors = getNeighbors(current, grid, width, height);

        if (neighbors.length > 0) {
          const randomIndex = yield* Random.nextIntBetween(0, neighbors.length);
          const next = neighbors[randomIndex];

          removeWallBetween(current, next);
          next.visited = true;
          stack.push(next);
        } else {
          stack.pop();
        }

        const maze: Maze = {
          width,
          height,
          cells: grid,
          startPosition,
          endPosition,
          currentPosition: { x: current.x, y: current.y },
          completed: false,
        };

        get.set(currentMazeAtom, maze);

        return Option.some([maze, [...stack]] as const);
      }),
    ).pipe(Stream.schedule(Schedule.spaced(Duration.millis(speed)))),
  );
});

@customElement("maze-generator")
export class MazeGenerator extends TW(AtomMixin(LitElement)) {
  @property({ type: Number }) width = 15;
  @property({ type: Number }) height = 15;
  @property({ type: Number }) private speed = 10;
  @atomState(currentMazeAtom) declare currentMaze: Maze | null;

  connectedCallback() {
    super.connectedCallback();
    const mazeAtom = mazeStreamAtom({
      width: this.width,
      height: this.height,
      speed: this.speed,
    });
    this.useAtomMount(mazeAtom);
  }

  private _regenerateMaze() {
    const mazeAtom = mazeStreamAtom({
      width: this.width,
      height: this.height,
      speed: this.speed,
    });
    this.useAtomRefresh(mazeAtom);
  }

  private _renderCell(
    cell: Cell,
    variant: VariantProps<typeof cellVariant>["variant"],
  ) {
    return html`
      <div
        class="${cellVariant({
          variant,
          topWall: cell.walls.top,
          rightWall: cell.walls.right,
          bottomWall: cell.walls.bottom,
          leftWall: cell.walls.left,
          disabled: !cell.visited,
        })}"
      ></div>
    `;
  }

  private _renderMaze(maze: Maze) {
    return html`
      <div
        class="grid gap-0 p-4 rounded-lg"
        style="grid-template-columns: repeat(${maze.width}, minmax(0, 1fr)); grid-template-rows: repeat(${maze.height}, minmax(0, 1fr)); width: min(90vw, 400px); height: min(90vw, 400px);"
      >
        ${Array.flatMap(maze.cells, (row) =>
          row.map((cell) => {
            const isStart =
              cell.x === maze.startPosition.x &&
              cell.y === maze.startPosition.y;
            const isEnd =
              cell.x === maze.endPosition.x && cell.y === maze.endPosition.y;
            const isCurrent =
              cell.x === maze.currentPosition.x &&
              cell.y === maze.currentPosition.y;
            const variant = isStart
              ? "start"
              : isEnd
                ? "end"
                : isCurrent
                  ? "current"
                  : "normal";
            return this._renderCell(cell, variant);
          }),
        )}
      </div>
    `;
  }

  render() {
    const maze = this.currentMaze;
    const isGenerating = maze === null || !maze.completed;
    return html`
      <div class="flex flex-col justify-center items-center gap-2 w-full">
          <slot></slot>
        ${
          maze
            ? this._renderMaze(maze)
            : html`<div class="text-muted-foreground">Initializing maze...</div>`
        }

        <div class="flex justify-between w-full text-sm px-8">
          <div class="flex flex-row gap-4 text-muted-foreground">
            <span class="flex items-center gap-1">
              <span class="w-4 h-4 bg-primary/60 border border-border"></span>
              Start
            </span>
            <span class="flex items-center gap-1">
              <span class="w-4 h-4 bg-destructive/60 border border-border"></span>
              End
            </span>
          </div>
          <ui-button
            variant="default"
            size="sm"
            @click=${this._regenerateMaze}
            ?disabled=${isGenerating}
          >
            ${unsafeSVG(RefreshCw)} Regenerate
          </ui-button>
        </div>
        
        <p class="text-muted-foreground text-xs sm:text-sm text-center px-2">
          Watch the maze slowly come to life using Effect Stream
        </p>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "maze-generator": MazeGenerator;
  }
}
