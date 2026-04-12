/**
 * Embedding API client — calls OpenAI-compatible /embeddings endpoint.
 * Returns normalized Float32Array vectors for cosine similarity via dot product.
 */

const BATCH_SIZE = 20

function normalizeVector(vec) {
  let norm = 0
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm)
  if (norm === 0) return vec
  const out = new Float32Array(vec.length)
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm
  return out
}

/**
 * @param {string[]} texts - texts to embed
 * @param {{ url: string, key: string, model: string, dimensions?: number }} config
 * @returns {Promise<Float32Array[]>}
 */
export async function fetchEmbeddings(texts, config) {
  if (!texts?.length) return []
  if (!config?.url || !config?.key || !config?.model) {
    throw new Error('Embedding config incomplete: need url, key, model')
  }

  const url = config.url.replace(/\/+$/, '') + '/embeddings'
  const results = new Array(texts.length)

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const body = {
      model: config.model,
      input: batch
    }
    if (config.dimensions && config.dimensions > 0) {
      body.dimensions = config.dimensions
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.key
      },
      body: JSON.stringify(body)
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      throw new Error(`Embedding API ${resp.status}: ${text.slice(0, 200)}`)
    }

    const json = await resp.json()
    const data = json?.data
    if (!Array.isArray(data)) {
      throw new Error('Embedding API: unexpected response shape')
    }

    // Sort by index to handle out-of-order responses
    data.sort((a, b) => (a.index || 0) - (b.index || 0))

    for (let j = 0; j < batch.length; j++) {
      const embedding = data[j]?.embedding
      if (!Array.isArray(embedding)) {
        throw new Error(`Embedding API: missing embedding at index ${j}`)
      }
      results[i + j] = normalizeVector(new Float32Array(embedding))
    }
  }

  return results
}

/**
 * Test embedding API connection by embedding a short test string.
 * Returns { success, dimensions, error? }
 */
export async function testEmbeddingConnection(config) {
  try {
    const [vec] = await fetchEmbeddings(['test'], config)
    return { success: true, dimensions: vec.length }
  } catch (e) {
    return { success: false, error: e.message || String(e) }
  }
}
