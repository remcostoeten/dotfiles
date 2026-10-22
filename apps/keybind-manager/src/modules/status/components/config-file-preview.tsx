import { For, Match, Switch, createSignal } from "solid-js"

type Props = {
  name: string
  content: string
}

export function ConfigFilePreview(props: Props) {
  const [copied, setCopied] = createSignal(false)
  const lines = () => props.content.replace(/\n$/, "").split("\n")

  async function copy() {
    await navigator.clipboard.writeText(props.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <section class="overflow-hidden rounded-lg border border-line-strong bg-surface-0">
      <header class="flex items-center gap-2 border-b border-line bg-surface-2/50 px-3 py-2">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" class="shrink-0 text-ink-faint" aria-hidden="true">
          <path
            d="M4 1.75h5.5L13 5.25v9H4a1 1 0 01-1-1v-10.5a1 1 0 011-1z M9.25 1.75v3.75H13"
            stroke="currentColor"
            stroke-width="1.25"
            stroke-linejoin="round"
          />
        </svg>
        <span class="min-w-0 truncate font-mono text-[11.5px]">
          <span class="text-ink-faint">/etc/keyd/</span>
          <span class="text-ink">{props.name}</span>
        </span>
        <span class="ml-auto shrink-0 font-mono text-[10.5px] text-ink-faint">
          {lines().length} lines
        </span>
        <button
          type="button"
          class="shrink-0 rounded px-1.5 py-0.5 font-mono text-[10.5px] text-ink-dim transition-colors duration-100 hover:bg-surface-3 hover:text-ink"
          onClick={() => void copy()}
        >
          {copied() ? "copied" : "copy"}
        </button>
      </header>
      <pre class="max-h-72 overflow-auto py-2 font-mono text-[11.5px] leading-[1.7] select-text">
        <For each={lines()}>
          {(line, index) => (
            <div class="flex hover:bg-surface-2/60">
              <span class="w-10 shrink-0 pr-3 text-right text-ink-faint/50 select-none">{index() + 1}</span>
              <span class="pr-4">
                <ConfigLine line={line} />
              </span>
            </div>
          )}
        </For>
      </pre>
    </section>
  )
}

function ConfigLine(props: { line: string }) {
  const assignment = () => props.line.match(/^(\s*[^=#]+?)(\s*=\s*)(.*)$/)
  return (
    <Switch fallback={<span class="text-ink-dim">{props.line || " "}</span>}>
      <Match when={props.line.trimStart().startsWith("#")}>
        <span class="text-ink-faint italic">{props.line}</span>
      </Match>
      <Match when={/^\s*\[.+\]\s*$/.test(props.line)}>
        <span class="text-accent">{props.line}</span>
      </Match>
      <Match when={assignment()}>
        {(parts) => (
          <>
            <span class="text-ink">{parts()[1]}</span>
            <span class="text-ink-faint">{parts()[2]}</span>
            <span class="text-sky">{parts()[3]}</span>
          </>
        )}
      </Match>
    </Switch>
  )
}
