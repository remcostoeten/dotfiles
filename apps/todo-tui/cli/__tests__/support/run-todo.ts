import { executeCommand } from "@/src/command-spec/execute";
import type { ParseOptions } from "@/src/command-spec/parse";
import { createCommandTree } from "@/src/plugins/builtins";
import type { TodoStore } from "@/src/storage/todo-store";

/** Runs one todo invocation against a store and returns everything it printed. Errors propagate. */
export async function runTodo(store: TodoStore, argv: string[], options: ParseOptions = {}): Promise<string> {
  let output = "";
  const sink = {
    write(chunk: string | Uint8Array) {
      output += chunk.toString();
      return true;
    },
  } as Pick<typeof process.stdout, "write">;
  const boardNames = (await store.loadBoardsFile())?.boards.map((board) => board.name) ?? [];
  await executeCommand(createCommandTree(), argv, { store, stdout: sink, stderr: sink, root: createCommandTree() }, { boardNames, ...options });
  return output;
}
