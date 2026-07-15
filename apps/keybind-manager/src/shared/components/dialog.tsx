import { Dialog as Kobalte } from "@kobalte/core/dialog"
import type { JSX } from "solid-js"

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: JSX.Element
  footer?: JSX.Element
  wide?: boolean
}

export function Dialog(props: Props) {
  return (
    <Kobalte open={props.open} onOpenChange={(open) => !open && props.onClose()} modal>
      <Kobalte.Portal>
        <Kobalte.Overlay class="fixed inset-0 z-40 bg-black/55" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-6">
          <Kobalte.Content
            class={`flex max-h-[85vh] w-full flex-col rounded-md border border-line-strong bg-surface-1 shadow-xl ${props.wide ? "max-w-2xl" : "max-w-md"}`}
          >
            <div class="flex items-center justify-between border-b border-line px-4 py-2.5">
              <Kobalte.Title class="text-[13px] font-semibold">{props.title}</Kobalte.Title>
              <Kobalte.CloseButton
                class="rounded px-1.5 text-ink-dim hover:bg-surface-2 hover:text-ink"
                aria-label="Close dialog"
              >
                ✕
              </Kobalte.CloseButton>
            </div>
            <div class="min-h-0 flex-1 overflow-auto px-4 py-3">{props.children}</div>
            {props.footer && (
              <div class="flex justify-end gap-2 border-t border-line px-4 py-2.5">
                {props.footer}
              </div>
            )}
          </Kobalte.Content>
        </div>
      </Kobalte.Portal>
    </Kobalte>
  )
}
