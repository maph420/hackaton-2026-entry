'use client'

import { useEffect, useRef } from 'react'
import { Download, ExternalLink, X } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { formatPages } from '@/lib/format-pages'

export type DocumentKind = 'pdf' | 'image'

export type ViewerDocument = {
  materialId: string
  title: string
  kind: DocumentKind
  pages: number[] | null
}

export function DocumentViewer({
  document,
  onClose,
}: {
  document: ViewerDocument | null
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (document && dialog && !dialog.open) dialog.showModal()
  }, [document])

  const fileUrl = document ? `/api/materials/${document.materialId}/file` : ''
  const firstPage = document?.pages?.[0]
  const viewUrl = document
    ? `${fileUrl}?view=1${document.kind === 'pdf' && firstPage ? `#page=${firstPage}` : ''}`
    : ''

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      aria-labelledby="viewer-title"
      className="m-auto h-[90dvh] w-[min(1100px,96vw)] max-w-none overflow-hidden rounded-xl border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/60"
    >
      {document && (
        <div className="flex h-full flex-col">
          <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 id="viewer-title" className="truncate text-sm font-semibold">
                {document.title}
              </h2>
              {document.pages && document.pages.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Leé {formatPages(document.pages)}
                </p>
              )}
            </div>
            <a
              href={viewUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              <ExternalLink aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Abrir en otra pestaña</span>
            </a>
            <a href={fileUrl} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <Download aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Descargar</span>
            </a>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
            >
              <X aria-hidden="true" />
              <span className="sr-only">Cerrar visor</span>
            </button>
          </header>
          <div className="min-h-0 flex-1 bg-muted">
            {document.kind === 'pdf' ? (
              <iframe
                key={viewUrl}
                src={viewUrl}
                title={`Documento: ${document.title}`}
                className="size-full border-0"
              />
            ) : (
              <div className="flex size-full items-start justify-center overflow-auto p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- private file served by an authenticated route */}
                <img src={viewUrl} alt={document.title} className="h-auto max-w-full rounded-md" />
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
