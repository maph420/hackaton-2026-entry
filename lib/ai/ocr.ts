import 'server-only'
import { generateText } from 'ai'
import { structureModel } from '@/lib/ai/provider'

const INSTRUCTIONS = `Transcribí todo el texto de esta imagen (apunte, pizarrón, práctica o examen de una materia universitaria).
- Respetá el orden de lectura y los títulos.
- Escribí las fórmulas en LaTeX entre $...$ (en línea) o $$...$$ (en bloque).
- Si hay diagramas o gráficos, describilos en una línea entre corchetes.
- Devolvé solo la transcripción, sin comentarios.`

export async function transcribeImage(bytes: Uint8Array, mediaType: string): Promise<string> {
  const { text } = await generateText({
    model: structureModel,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: INSTRUCTIONS },
          { type: 'image', image: bytes, mediaType },
        ],
      },
    ],
  })
  return text.trim()
}
