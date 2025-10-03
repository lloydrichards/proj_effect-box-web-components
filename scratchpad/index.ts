import { Console, Effect, pipe } from "effect";
import { Box, Ansi, Renderer } from "effect-boxes";

// Create a simple bordered box with colored text
const myBox = pipe(
  Box.text("Hello, Effect Boxes!"),
  Box.annotate(Ansi.blue),
  Box.moveRight(2),
  Box.moveDown(1)
);

const main = Effect.gen(function* () {
  const result = yield* Box.render(myBox,{});
  yield* Console.log(result);
})


Effect.runPromise(main.pipe(Effect.provide(Renderer.AnsiRendererLive)));