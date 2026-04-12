/**
 * Accumulates streaming tool_calls deltas into complete tool call objects.
 *
 * OpenAI streaming sends tool calls as incremental fragments:
 *   chunk 1: { index:0, id:"call_abc", type:"function", function:{ name:"foo", arguments:"{\"a" } }
 *   chunk 2: { index:0, function:{ arguments:"\":1}" } }
 *   ...
 *   finish_reason: "tool_calls"
 *
 * This accumulator reassembles them.
 */

export function createToolCallAccumulator() {
  const pending = new Map()  // index → { id, type, name, arguments }

  /**
   * Feed a `delta.tool_calls` array from a single SSE chunk.
   */
  function push(toolCallsDelta) {
    if (!Array.isArray(toolCallsDelta)) return

    for (const item of toolCallsDelta) {
      const idx = item.index ?? 0

      if (!pending.has(idx)) {
        pending.set(idx, {
          id: item.id || '',
          type: item.type || 'function',
          name: item.function?.name || '',
          arguments: ''
        })
      }

      const entry = pending.get(idx)

      // First chunk for this index carries the id and name
      if (item.id) entry.id = item.id
      if (item.function?.name) entry.name = item.function.name

      // Arguments arrive as incremental string fragments
      if (typeof item.function?.arguments === 'string') {
        entry.arguments += item.function.arguments
      }
    }
  }

  /**
   * Return all accumulated tool calls as complete objects.
   * Call after finish_reason === 'tool_calls'.
   *
   * @returns {Array<{id:string, type:string, function:{name:string, arguments:string}}>}
   */
  function getCompleted() {
    const result = []
    const sorted = [...pending.entries()].sort((a, b) => a[0] - b[0])

    for (const [, entry] of sorted) {
      result.push({
        id: entry.id,
        type: entry.type,
        function: {
          name: entry.name,
          arguments: entry.arguments
        }
      })
    }
    return result
  }

  /**
   * Check if any tool calls have been accumulated.
   */
  function hasToolCalls() {
    return pending.size > 0
  }

  /**
   * Reset the accumulator.
   */
  function clear() {
    pending.clear()
  }

  return { push, getCompleted, hasToolCalls, clear }
}
