<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

type Role = "user" | "assistant";
interface Message {
  id: number;
  role: Role;
  content: string;
  time: string;
  streaming?: boolean;
}
interface Conversation {
  id: number;
  title: string;
  preview: string;
  time: string;
  active?: boolean;
}

const conversations = ref<Conversation[]>([
  {
    id: 1,
    title: "产品需求梳理",
    preview: "帮我把这个需求拆成 MVP...",
    time: "刚刚",
    active: true,
  },
  {
    id: 2,
    title: "周末旅行计划",
    preview: "上海周边两天一夜有什么推荐？",
    time: "昨天",
  },
  {
    id: 3,
    title: "TypeScript 学习",
    preview: "解释一下泛型约束的使用场景",
    time: "周二",
  },
  {
    id: 4,
    title: "营销文案优化",
    preview: "让这段文案更简洁有力",
    time: "上周",
  },
]);
const messages = ref<Message[]>([
  {
    id: 1,
    role: "user",
    content:
      "我正在做一个 AI 对话产品，帮我梳理一下第一版应该包含哪些核心功能。",
    time: "10:24",
  },
  {
    id: 2,
    role: "assistant",
    content:
      "当然可以。第一版建议聚焦于一条顺畅的对话主链路，先把“能聊、好找、可继续”做好。\n\n建议的 MVP 功能\n\n1. 流式对话：逐字显示模型回复，提供停止生成能力。\n2. 会话管理：新建、重命名、删除会话，并自动保存历史消息。\n3. 模型选择：支持在不同模型之间切换，展示上下文窗口和速度。\n4. 多模态入口：预留文件上传、图片和语音输入的扩展位。\n5. 反馈闭环：对单条回复进行复制、重新生成和点赞反馈。\n\n接下来可以先接入 SSE，把流式状态机跑通，再逐步补充持久化和鉴权。",
    time: "10:24",
  },
]);
const input = ref("");
const isStreaming = ref(false);
const isDark = ref(false);
const selectedModel = ref("Aurora 2.1");
const messageList = ref<HTMLElement | null>(null);
let streamTimer: ReturnType<typeof setInterval> | undefined;
const activeConversation = computed(() =>
  conversations.value.find((item) => item.active)
);
const canSend = computed(
  () => input.value.trim().length > 0 && !isStreaming.value
);
function scrollToBottom() {
  nextTick(() => {
    if (messageList.value)
      messageList.value.scrollTop = messageList.value.scrollHeight;
  });
}
function selectConversation(id: number) {
  conversations.value = conversations.value.map((item) => ({
    ...item,
    active: item.id === id,
  }));
}
function newConversation() {
  conversations.value = conversations.value.map((item) => ({
    ...item,
    active: false,
  }));
  conversations.value.unshift({
    id: Date.now(),
    title: "新对话",
    preview: "开始一段新的探索",
    time: "现在",
    active: true,
  });
  messages.value = [];
}
function stopStreaming() {
  if (streamTimer) clearInterval(streamTimer);
  streamTimer = undefined;
  isStreaming.value = false;
  const last = messages.value.at(-1);
  if (last) last.streaming = false;
}
function sendMessage() {
  const content = input.value.trim();
  if (!content || isStreaming.value) return;
  messages.value.push({ id: Date.now(), role: "user", content, time: "现在" });
  input.value = "";
  const assistant: Message = {
    id: Date.now() + 1,
    role: "assistant",
    content: "",
    time: "现在",
    streaming: true,
  };
  messages.value.push(assistant);
  isStreaming.value = true;
  const response =
    "这是一个本地模拟的流式回复。接入真实模型时，可以把这里替换为 SSE / WebSocket 的增量事件，并在每次收到 delta 后更新消息内容。";
  let index = 0;
  streamTimer = setInterval(() => {
    assistant.content += response[index] || "";
    index += 1;
    scrollToBottom();
    if (index >= response.length) stopStreaming();
  }, 28);
  scrollToBottom();
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}
function copyMessage(content: string) {
  navigator.clipboard?.writeText(content);
}
</script>

<template>
  <main class="app-shell" :class="{ 'is-dark': isDark }">
    <aside class="sidebar">
      <div class="brand-row">
        <div class="brand-mark">✦</div>
        <span class="brand-name">Luma</span
        ><button class="icon-button subtle" title="收起侧栏">‹</button>
      </div>
      <button class="new-chat" @click="newConversation">
        <span>＋</span> 新建对话 <kbd>⌘ K</kbd>
      </button>
      <div class="sidebar-section">
        <div class="section-label">最近对话 <span>•••</span></div>
        <nav class="conversation-list">
          <button
            v-for="conversation in conversations"
            :key="conversation.id"
            class="conversation-item"
            :class="{ active: conversation.active }"
            @click="selectConversation(conversation.id)"
          >
            <span class="conversation-icon">◌</span
            ><span class="conversation-copy"
              ><strong>{{ conversation.title }}</strong
              ><small>{{ conversation.preview }}</small></span
            ><time>{{ conversation.time }}</time>
          </button>
        </nav>
      </div>
      <div class="sidebar-bottom">
        <button class="utility-item"><span>▱</span> 提示词库 <em>12</em></button
        ><button class="utility-item"><span>⚙</span> 设置</button>
        <div class="profile-row">
          <div class="avatar">M</div>
          <div><strong>Misty Chen</strong><small>个人工作区</small></div>
          <span class="more">•••</span>
        </div>
      </div>
    </aside>
    <section class="chat-panel">
      <header class="chat-header">
        <div class="chat-heading">
          <span class="status-dot"></span>
          <div>
            <h1>{{ activeConversation?.title || "新对话" }}</h1>
            <p>与 Luma 对话</p>
          </div>
        </div>
        <div class="header-actions">
          <button class="header-button" title="搜索对话">⌕</button
          ><button class="header-button" title="更多操作">•••</button
          ><button class="avatar small">M</button>
        </div>
      </header>
      <div ref="messageList" class="message-list">
        <div v-if="messages.length === 0" class="empty-state">
          <div class="empty-orbit">✦</div>
          <h2>从一个问题开始</h2>
          <p>写下你的想法，Luma 会帮你一起把它变清晰。</p>
          <div class="suggestions">
            <button @click="input = '帮我制定一个学习计划'">
              制定一个学习计划 <span>↗</span></button
            ><button @click="input = '解释一个复杂的概念'">
              解释一个复杂的概念 <span>↗</span>
            </button>
          </div>
        </div>
        <article
          v-for="message in messages"
          :key="message.id"
          class="message-row"
          :class="message.role"
        >
          <div v-if="message.role === 'assistant'" class="message-avatar">
            ✦
          </div>
          <div class="message-body">
            <div v-if="message.role === 'assistant'" class="message-meta">
              Luma <span>{{ message.time }}</span>
            </div>
            <div class="message-content" :class="{ typing: message.streaming }">
              {{ message.content
              }}<span v-if="message.streaming" class="cursor"></span>
            </div>
            <div
              v-if="message.role === 'assistant' && !message.streaming"
              class="message-tools"
            >
              <button title="复制" @click="copyMessage(message.content)">
                ▣</button
              ><button title="重新生成">↻</button
              ><button title="有帮助">♡</button
              ><button title="没帮助">♧</button>
            </div>
          </div>
          <div
            v-if="message.role === 'user'"
            class="message-avatar user-avatar"
          >
            M
          </div>
        </article>
      </div>
      <div class="composer-wrap">
        <div class="composer">
          <textarea
            v-model="input"
            rows="1"
            placeholder="向 Luma 提问..."
            @keydown="onKeydown"
          ></textarea>
          <div class="composer-toolbar">
            <div class="toolbar-left">
              <button class="tool-button" title="添加附件">＋</button
              ><button class="model-select">
                <span class="model-dot"></span>{{ selectedModel }}
                <span class="chevron">⌄</span></button
              ><button class="tool-button" title="启用联网搜索">◎</button>
            </div>
            <div class="toolbar-right">
              <span class="shortcut">Enter 发送 · Shift + Enter 换行</span
              ><button
                v-if="isStreaming"
                class="stop-button"
                title="停止生成"
                @click="stopStreaming"
              >
                ■</button
              ><button
                v-else
                class="send-button"
                :disabled="!canSend"
                title="发送"
                @click="sendMessage"
              >
                ↑
              </button>
            </div>
          </div>
        </div>
        <p class="composer-note">Luma 可能会犯错，请核实重要信息。</p>
      </div>
    </section>
    <button class="theme-toggle" title="切换主题" @click="isDark = !isDark">
      {{ isDark ? "☼" : "☾" }}
    </button>
  </main>
</template>
