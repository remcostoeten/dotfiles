import { Dialog as Kobalte } from "@kobalte/core/dialog"
import { Show, type JSX } from "solid-js"

type Props = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: JSX.Element
  footer?: JSX.Element
  wide?: boolean
}

export function Dialog(props: Props) {
  return (
    <Kobalte open={props.open} onOpenChange={(open) => !open && props.onClose()} modal>
      <Kobalte.Portal>
        <Kobalte.Overlay class="kb-dialog-overlay fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-6">
          <Kobalte.Content
            class={`kb-dialog-content flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-line-strong bg-surface-1 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.8)] ${props.wide ? "max-w-2xl" : "max-w-md"}`}
          >
            <div class="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
              <div class="min-w-0">
                <Kobalte.Title class="text-[14px] font-semibold tracking-tight">
                  {props.title}
                </Kobalte.Title>
                <Show when={props.description}>
                  <Kobalte.Description class="mt-0.5 text-[12px] text-ink-faint">
                    {props.description}
                  </Kobalte.Description>
                </Show>
              </div>
              <Kobalte.CloseButton
                class="-mr-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-faint transition-colors duration-100 hover:bg-surface-3 hover:text-ink"
                aria-label="Close dialog"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2.5 2.5l7 7m0-7l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                </svg>
              </Kobalte.CloseButton>
            </div>
            <div class="min-h-0 flex-1 overflow-auto px-5 pb-4">{props.children}</div>
            <Show when={props.footer}>
              <div class="flex justify-end gap-2 border-t border-line bg-surface-0/60 px-5 py-3">
                {props.footer}
              </div>
            </Show>
          </Kobalte.Content>
        </div>
      </Kobalte.Portal>
    </Kobalte>
  )
}
