// Guardar e ler ficheiros JSON (promoções dos folhetos).
// - No Vercel: Vercel Blob. Ao ligar um Blob store ao projeto, o Vercel cria BLOB_STORE_ID e as
//   funções autenticam-se sozinhas (OIDC, sem chave fixa). Projetos antigos usam BLOB_READ_WRITE_TOKEN.
// - No teu computador, sem essas variáveis: pasta .dados-locais/ (fora do git)
import { put, get } from '@vercel/blob'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const usarBlob = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)
const PASTA_LOCAL = path.resolve(process.cwd(), '.dados-locais')

export async function guardarJson(caminho, dados) {
  const texto = JSON.stringify(dados)
  if (usarBlob()) {
    await put(caminho, texto, {
      access: 'private', // o Blob store é privado: só as nossas funções o leem (a app pede a /api/promocoes)
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
      // useCache: false = ler sempre a versão mais recente (o ficheiro "atual" muda todas as semanas)
      const resultado = await get(caminho, { access: 'private', useCache: false })
      if (!resultado || resultado.statusCode !== 200) return null
      return await new Response(resultado.stream).json()
    }
    return JSON.parse(await readFile(path.join(PASTA_LOCAL, caminho), 'utf8'))
  } catch {
    return null
  }
}
