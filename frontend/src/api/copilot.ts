import type { CopilotChatMessage } from './types'

export interface StreamCopilotOptions {
  messages: CopilotChatMessage[]
  signal?: AbortSignal
  onDelta: (delta: string) => void
  onDone: () => void
  onError: (error: string) => void
}

export async function streamCopilot({
  messages,
  signal,
  onDelta,
  onDone,
  onError,
}: StreamCopilotOptions): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/copilot/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
      signal,
    })
  } catch (err: unknown) {
    if (signal?.aborted) return
    onError(err instanceof Error ? err.message : 'Network error')
    return
  }

  if (!response.ok) {
    let detail = `Server responded with ${response.status}`
    try {
      const errJson = await response.json()
      if (errJson?.detail) {
        detail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail)
      }
    } catch {
      // ignore json parse error
    }
    onError(detail)
    return
  }

  if (!response.body) {
    onError('No response body received from server')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const jsonStr = trimmed.slice(5).trim()
        if (!jsonStr) continue

        try {
          const parsed = JSON.parse(jsonStr)
          if (parsed.delta) {
            onDelta(parsed.delta)
          }
          if (parsed.done) {
            onDone()
          }
          if (parsed.error) {
            onError(parsed.error)
          }
        } catch {
          // Ignore incomplete/corrupted event json
        }
      }
    }
  } catch (err: unknown) {
    if (signal?.aborted) return
    onError(err instanceof Error ? err.message : 'Stream error occurred')
  } finally {
    reader.releaseLock()
  }
}
