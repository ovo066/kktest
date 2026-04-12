function formatTimeLabel(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function buildMusicContextBlock(ctx) {
  if (!ctx) return ''
  if (typeof ctx === 'string') {
    return `<music_context>\n${ctx}\n</music_context>`
  }

  const parts = ['<music_context>']
  parts.push(`用户当前正在听：《${ctx.title || '未知曲目'}》 - ${ctx.artist || '未知歌手'}`)
  if (ctx.isPlaying) parts.push('状态：播放中')
  else parts.push('状态：已暂停')

  if (ctx.duration > 0) {
    const pct = Math.round((ctx.progress / ctx.duration) * 100)
    const hint = pct < 15 ? '刚开始听' : pct > 85 ? '快听完了' : `听到${pct}%`
    parts.push(`进度：${formatTimeLabel(ctx.progress)} / ${formatTimeLabel(ctx.duration)}（${hint}）`)
  }

  if (ctx.listenTogether) {
    parts.push('你们正在一起听这首歌，可以自然地聊聊对这首歌的感受。')
  }

  parts.push('</music_context>')
  return parts.join('\n')
}
