import { addMaterial } from '@/app/actions/materials'
import { SubmitButton } from '@/components/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MATERIAL_KINDS } from '@/lib/types'

export const selectClassName =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function MaterialForm({ subjectId }: { subjectId: string }) {
  return (
    <form action={addMaterial} className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="material-title">Título</Label>
          <Input id="material-title" name="title" placeholder="Ej: Clase 3 - Integrales" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="material-kind">Tipo</Label>
          <select id="material-kind" name="kind" defaultValue="apunte" className={selectClassName}>
            {Object.entries(MATERIAL_KINDS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="material-file">Archivo (PDF, imagen o texto)</Label>
        <Input
          id="material-file"
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.markdown,.csv,.tex,application/pdf,image/png,image/jpeg,image/webp,image/gif,text/*"
          aria-describedby="material-file-hint"
        />
        <p id="material-file-hint" className="text-xs text-muted-foreground">
          {'Las fotos de apuntes o del pizarrón se transcriben automáticamente. Máximo 8 MB.'}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="material-text">O pegá el contenido</Label>
        <Textarea
          id="material-text"
          name="text"
          rows={5}
          placeholder="Pegá aquí tus apuntes si no tenés un archivo."
        />
      </div>
      <div>
        <SubmitButton pendingLabel="Indexando material…">Agregar a la biblioteca</SubmitButton>
      </div>
    </form>
  )
}
