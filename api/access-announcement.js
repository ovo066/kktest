import { readAccessAnnouncement } from '../src/utils/accessGuardStorage.js'
import { readAccessEnv } from '../src/utils/accessControlServer.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(204).end()
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }

  const env = readAccessEnv()

  try {
    const announcement = await readAccessAnnouncement(env)
    return res.status(200).json({ ok: true, announcement })
  } catch (error) {
    console.warn('[access-control]', error instanceof Error ? error.message : String(error))
    return res.status(200).json({ ok: true, announcement: null })
  }
}
