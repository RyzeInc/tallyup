/**
 * Minimal SSE reader for OpenAI-compatible `chat/completions` streams.
 *
 * Both the OpenAI and Groq providers speak the same wire format: a sequence of
 * `data: {json}` lines terminated by `data: [DONE]`.
 */
export async function* iterateChatCompletionStream(
  response: Response
): AsyncGenerator<string, void, void> {
  const body = response.body;
  if (!body) throw new Error("Streaming response has no body.");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line. Keep the trailing partial.
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        for (const line of event.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          let parsed: {
            choices?: Array<{ delta?: { content?: string | null } }>;
          };
          try {
            parsed = JSON.parse(payload);
          } catch {
            // A partial or non-JSON keepalive frame; skip it.
            continue;
          }

          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
