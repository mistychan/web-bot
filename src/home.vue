<template>
  <main class="chat">
    <div ref="listRef" class="messages">
      <p v-if="messagesList.length === 0" class="hint">输入一条消息开始对话</p>
      <div
        v-for="message in messagesList"
        :key="message.id"
        class="message"
        :class="message.role"
      >
        <span class="role">{{ message.role === "user" ? "你" : "AI" }}</span>
        <div class="content">
          {{ message.content
          }}<span v-if="message.streaming" class="cursor"></span>
        </div>
      </div>
    </div>

    <div class="composer">
      <textarea
        v-model="input"
        rows="1"
        placeholder="输入消息，Enter 发送，Shift + Enter 换行"
        @keydown="onKeydown"
      ></textarea>
      <button v-if="isStreaming" class="stop" @click="stop">停止</button>
      <button v-else class="send" :disabled="!input.trim()" @click="send">
        发送
      </button>
    </div>
  </main>
</template>
<script setup lang="ts">
import { nextTick, reactive, ref } from "vue";
import type { Message } from "./types/chat";
import { streamDeepSeek } from "./services/deepseek";

const MODEL = "deepseek-flash";

// 打字机播放参数。实测（366 字回答）：
// 40/130 → 13.5s 偏慢；55/110 → 10.4s 推荐；70/90 → 7.7s 接近原生速度
const TYPE_SPEED = 55; // 每秒吐多少字，调大变快
const PAUSE_MS = 110; // 遇到句读多停顿的毫秒数，调大停顿更明显
const PUNCTUATION = "，。！？；：、,.!?;:\n";

const messagesList = ref<Message[]>([]);
const input = ref("");
const isStreaming = ref(false);
const listRef = ref<HTMLElement | null>(null);
let controller: AbortController | null = null;

function scrollToBottom() {
  nextTick(() => {
    const el = listRef.value;
    if (el) el.scrollTop = el.scrollHeight;
  });
}

async function send() {
  const content = input.value.trim();
  if (!content || isStreaming.value) return;
  input.value = "";

  messagesList.value.push({ id: Date.now(), role: "user", content });
  // 必须是 reactive 对象：流式回调里改的是它，只有响应式对象才能触发重渲染
  const reply = reactive<Message>({
    id: Date.now() + 1,
    role: "assistant",
    content: "",
    streaming: true,
  });
  messagesList.value.push(reply);
  isStreaming.value = true;

  // 播放队列：收到的文本先入队，再按固定速度匀速播出去。
  // 服务端数据是突发到达的，来一片画一片会顿挫；匀速播放才有打字机观感。
  let pending = "";
  let rafId = 0;
  let last = 0;
  let carry = 0; // 不足一字的余量，累积到下一帧再吐
  let pauseUntil = 0;

  function pump(now: number) {
    if (!last) last = now;
    if (now < pauseUntil) {
      last = now;
      rafId = requestAnimationFrame(pump);
      return;
    }

    const dt = Math.min((now - last) / 1000, 0.1); // 掉帧时别一次补太多
    last = now;
    carry += TYPE_SPEED * dt;
    const take = Math.floor(carry);

    if (take > 0) {
      carry -= take;
      const chunk = pending.slice(0, take);
      pending = pending.slice(take);
      if (chunk) {
        reply.content += chunk;
        scrollToBottom();
        // 句读处顿一下，这是"活人感"的来源
        if (PUNCTUATION.includes(chunk[chunk.length - 1])) {
          pauseUntil = now + PAUSE_MS;
        }
      }
    }

    if (pending) {
      rafId = requestAnimationFrame(pump);
    } else {
      rafId = 0;
      last = 0;
      carry = 0;
    }
  }

  controller = new AbortController();
  try {
    // 传入历史消息（不含刚插入的空 assistant 占位）
    await streamDeepSeek(
      messagesList.value.slice(0, -1),
      MODEL,
      (delta) => {
        pending += delta; // 只入队，不直接渲染
        if (!rafId) rafId = requestAnimationFrame(pump);
      },
      controller.signal,
    );
  } catch (error) {
    pending = "";
    if ((error as Error).name !== "AbortError") {
      reply.content = `请求失败：${(error as Error).message}`;
    }
  } finally {
    cancelAnimationFrame(rafId);
    reply.content += pending; // 没播完的一次性补上，避免丢字
    pending = "";
    reply.streaming = false;
    isStreaming.value = false;
    controller = null;
  }
}

function stop() {
  controller?.abort();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    send();
  }
}
</script>