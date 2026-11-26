// Guardar e ler ficheiros JSON (promoções dos folhetos).
// - No Vercel: Vercel Blob (precisa da variável BLOB_READ_WRITE_TOKEN, criada ao ligar um Blob store ao projeto)
// - No teu computador, sem essa variável: pasta .dados-locais/ (fora do git)
import { put, head } from '@vercel/blob'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const usarBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN)
const PASTA_LOCAL = path.resolve(process.cwd(), '.dados-locais')

export async function guardarJson(caminho, dados) {
  const texto = JSON.stringify(dados)
  if (usarBlob()) {
    await put(caminho, texto, {
      access: 'public', // são promoções públicas dos folhetos, nada pessoal
      contentType: 'application/json; charset=utf-8',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60, // o ficheiro "atual" muda todas as semanas
    })
    return
  }
  const destino = path.join(PASTA_LOCAL, caminho)
  await mkdir(path.dirname(destino), { recursive: true })
  await writeFile(destino, texto)
}

// Devolve os dados, ou null se o ficheiro ainda não existir
export async function lerJson(caminho) {
  try {
    if (usarBlob()) {
      const { url } = await head(caminho)
      const resposta = await fetch(url, { cache: 'no-store' })
      return resposta.ok ? await resposta.json() : null
    }
    return JSON.parse(await readFile(path.join(PASTA_LOCAL, caminho), 'utf8'))
  } catch {
    return null
  }
}
