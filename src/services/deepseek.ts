import type { Message } from "../types/chat";

const endpoint =
  import.meta.env.VITE_DEEPSEEK_ENDPOINT ||
  "https://api.deepseek.com/chat/completions";
const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
interface DeepSeekChunk {
  choices?: Array<{ delta?: { content?: unknown } }>;
}

export async function streamDeepSeek(
  messages: Message[],
  model: string,
  onDelta: (content: string) => void,
  signal: AbortSignal,
) {
  if (!apiKey) throw new Error("缺少 VITE_DEEPSEEK_API_KEY");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
    signal,
  });

  if (!response.ok) throw new Error(`DeepSeek 请求失败：${response.status}`);
  if (!response.body) throw new Error("DeepSeek 响应不支持流式读取");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const event of events) {
        const line = event.split("\n").find((item) => item.startsWith("data:"));
        if (!line) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const content = (JSON.parse(data) as DeepSeekChunk).choices?.[0]?.delta
          ?.content;
        if (typeof content === "string") onDelta(content);
      }
    }
    buffer += decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
