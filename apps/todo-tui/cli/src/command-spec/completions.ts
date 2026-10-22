import { flagSpellings, visibleFlags } from "./tree";
import type { CommandSpec, ValueKind } from "./types";

/** Value kinds whose candidates come from the data files at completion time. */
export const DYNAMIC_KINDS = ["task", "epic", "board", "archive"] as const;
export type DynamicKind = (typeof DYNAMIC_KINDS)[number];

const PRIORITIES = ["none", "low", "medium", "high"];

export function dynamicKindOf(kind: ValueKind): DynamicKind | undefined {
  if (typeof kind === "object") return undefined;
  switch (kind) {
    case "task-id":
    case "pending-task-id":
    case "task-ids":
    case "task-selector":
    case "parent-id":
      return "task";
    case "epic-id":
    case "epic-selector":
      return "epic";
    case "board-name":
      return "board";
    case "archive-ref":
      return "archive";
    default:
      return undefined;
  }
}

function staticValues(kind: ValueKind): string[] | undefined {
  if (typeof kind === "object") return kind.oneOf;
  if (kind === "priority") return PRIORITIES;
  if (kind === "count-or-all") return ["all"];
  return undefined;
}

const PRELUDE = `# Generated from the command spec by \`todo completions fish\`. Do not edit by hand.

complete -c todo -e
complete -c todo -f

function __todo_walk --description 'Print the canonical todo command path and the count of arguments after it'
    set -l tokens (commandline -opc)
    set -e tokens[1]
    set -l path
    set -l extra 0
    for token in $tokens
        if string match -q -- '-*' $token
            continue
        end
        if test $extra -eq 0
            set -l key (string join ' ' -- $path $token)
            set -l index (contains -i -- $key $__todo_node_keys)
            if test -n "$index"
                set path (string split ' ' -- $__todo_node_paths[$index])
                continue
            end
        end
        set extra (math $extra + 1)
    end
    echo "path:$path"
    echo $extra
end

function __todo_at --description 'True when the command line sits right after the given todo command path'
    set -l state (__todo_walk)
    test "$state[1]" = "path:$argv[1]"; and test "$state[2]" -eq 0
end

function __todo_in --description 'True when the command line is inside the given todo command path'
    set -l state (__todo_walk)
    test "$state[1]" = "path:$argv[1]"
end
`;

/** Renders fish completions for the whole tree: subcommands, flags, enum values and live task, epic and board values. */
export function generateFishCompletions(root: CommandSpec): string {
  const keys: string[] = [];
  const paths: string[] = [];
  const lines: string[] = [];

  function visit(node: CommandSpec, path: string[]): void {
    const at = path.join(" ");
    for (const child of node.subcommands ?? []) {
      if (child.hidden === true) continue;
      const childPath = [...path, child.name];
      for (const spelling of [child.name, ...(child.aliases ?? [])].filter((name) => !name.startsWith("-"))) {
        keys.push([...path, spelling].join(" "));
        paths.push(childPath.join(" "));
      }
      lines.push(`complete -c todo -n ${quote(`__todo_at '${at}'`)} -a ${quote(child.name)} -d ${quote(child.summary)}`);
    }

    if (path.length > 0) {
      const firstArg = node.args?.[0];
      if (firstArg !== undefined) {
        const values = valueSource(firstArg.kind);
        if (values !== undefined) lines.push(`complete -c todo -n ${quote(`__todo_in '${at}'`)} -a ${values}`);
      }
      for (const flag of visibleFlags(node)) {
        const names = flagSpellings(flag).map((spelling) => (spelling.startsWith("--") ? `-l ${spelling.slice(2)}` : `-s ${spelling.slice(1)}`));
        const source = flag.value === undefined ? undefined : valueSource(flag.value);
        const value = flag.value === undefined ? "" : flag.value === "path" ? " -r -F" : ` -x${source === undefined ? "" : ` -a ${source}`}`;
        lines.push(`complete -c todo -n ${quote(`__todo_in '${at}'`)} ${names.join(" ")}${value} -d ${quote(flag.description)}`);
      }
    }

    for (const child of node.subcommands ?? []) {
      if (child.hidden !== true) visit(child, [...path, child.name]);
    }
  }

  visit(root, []);
  return [
    PRELUDE,
    `set -g __todo_node_keys ${keys.map(quote).join(" ")}`,
    `set -g __todo_node_paths ${paths.map(quote).join(" ")}`,
    "",
    "complete -c todo -s h -l help -d 'Show help for the command'",
    ...lines,
    "",
  ].join("\n");
}

function valueSource(kind: ValueKind): string | undefined {
  const dynamic = dynamicKindOf(kind);
  if (dynamic !== undefined) return `'(todo completions --list ${dynamic})'`;
  const values = staticValues(kind);
  return values === undefined ? undefined : quote(values.join(" "));
}

function quote(value: string): string {
  return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}
