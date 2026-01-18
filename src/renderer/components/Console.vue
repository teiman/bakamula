<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { useServerStore } from '../stores/serverStore'

const serverStore = useServerStore()

const command = ref('')
const outputRef = ref(null)
const rawMode = ref(false)

// Auto-scroll to bottom when new content arrives
watch(
  () => serverStore.consoleBuffer.length,
  async () => {
    await nextTick()
    if (outputRef.value) {
      outputRef.value.scrollTop = outputRef.value.scrollHeight
    }
  }
)

// Setup output listener on mount
onMounted(() => {
  serverStore.setupOutputListener()
})

function handleSubmit() {
  if (command.value.trim()) {
    serverStore.sendCommand(command.value)
    command.value = ''
  }
}

function handleKeydown(e) {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = serverStore.historyUp()
    if (prev !== null) {
      command.value = prev
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    const next = serverStore.historyDown()
    if (next !== null) {
      command.value = next
    }
  }
}

const colorMap = {
  '0': '#999999', // Gray (Brightened from dark gray)
  '1': '#ff6666', // Red (Lightened)
  '2': '#66ff66', // Green (Lightened)
  '3': '#ffff66', // Yellow
  '4': '#6699ff', // Blue (Significantly lightened for contrast)
  '5': '#66ffff', // Cyan
  '6': '#ff66ff', // Magenta
  '7': '#ffffff', // White
  '8': '#bbbbbb', // Gray (Light)
  '9': '#888888', // Dark Gray
  'h': '#ffffff'  // Highlight
};

// HTML escape helper
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatLine(text) {
  if (!text) return '';
  
  if (rawMode.value) {
    return escapeHtml(text);
  }

  let htmlOutput = '';
  let currentBuffer = '';
  
  // State
  let currentColor = null;
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;

  const flush = () => {
    if (!currentBuffer) return;
    
    let style = '';
    if (currentColor) style += `color: ${currentColor};`;
    if (isBold) style += 'font-weight: bold;';
    if (isItalic) style += 'font-style: italic;';
    if (isUnderline) style += 'text-decoration: underline;';
    
    if (style) {
      htmlOutput += `<span style="${style}">${escapeHtml(currentBuffer)}</span>`;
    } else {
      htmlOutput += escapeHtml(currentBuffer);
    }
    
    currentBuffer = '';
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '^' && i + 1 < text.length) {
      const code = text[i + 1];
      let handled = false;
      let skipChars = 1; // Default skip just the code char

      // Standard Colors (0-9, h)
      if (colorMap[code]) {
        flush();
        currentColor = colorMap[code];
        handled = true;
      }
      // Hex Colors (^xRGB)
      else if (code === 'x' && i + 4 < text.length) {
        const hex = text.substr(i + 2, 3);
        if (/^[0-9a-fA-F]{3}$/.test(hex)) {
          flush();
          currentColor = '#' + hex;
          handled = true;
          skipChars = 4; // x + R + G + B
        }
      }
      // Styles
      else if (code === 'b') {
        flush();
        isBold = true;
        handled = true;
      }
      else if (code === 'i') {
        flush();
        isItalic = true;
        handled = true;
      }
      else if (code === 'u') {
        flush();
        isUnderline = true;
        handled = true;
      }
      else if (code === 'a') {
        flush();
        isItalic = true;
        handled = true;
      }
      // Reset
      else if (code === 'n' || code === 'r') {
        flush();
        currentColor = null;
        isBold = false;
        isItalic = false;
        isUnderline = false;
        handled = true;
      }
      // Literals escaped by ^ (^, [, ])
      else if (code === '^' || code === '[' || code === ']') {
        currentBuffer += code;
        handled = true;
      }
      // Unknown code - check if it looks like a color/style char but mistakenly unhandled?
      // Just print ^ followed by char if not handled
      
      if (handled) {
        i += skipChars;
      } else {
        // Treat as literal ^
        currentBuffer += '^';
      }
    } else {
      currentBuffer += char;
    }
  }

  flush();
  return htmlOutput;
}
</script>

<template>
  <div class="console panel">
    <div class="panel-title">
      <span>Console</span>
      <label class="raw-mode-toggle">
        <input type="checkbox" v-model="rawMode">
        Raw Output
      </label>
    </div>

    <div class="console-output" ref="outputRef">
      <div
        v-for="(line, i) in serverStore.consoleBuffer"
        :key="i"
        class="console-line"
        :class="{ command: line.startsWith('>'), error: line.startsWith('[Error') }"
        v-html="formatLine(line)"
      >
      </div>
      <div v-if="!serverStore.consoleBuffer.length" class="console-empty">
        No output yet. Start the server to see logs.
      </div>
    </div>

    <form class="console-input" @submit.prevent="handleSubmit">
      <span class="prompt">&gt;</span>
      <input
        type="text"
        v-model="command"
        placeholder="Enter command..."
        :disabled="!serverStore.isRunning"
        @keydown="handleKeydown"
      />
      <button type="submit" :disabled="!serverStore.isRunning || !command.trim()">
        Send
      </button>
    </form>
  </div>
</template>

<style scoped>
.console {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.console-output {
  flex: 1;
  overflow-y: auto;
  background: var(--bg-tertiary);
  border-radius: 4px;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 12px;
}

.console-line {
  white-space: pre-wrap;
  word-break: break-all;
}

.console-line.command {
  color: var(--accent);
}

.console-line.error {
  color: var(--error);
}

.console-empty {
  color: var(--text-secondary);
  font-style: italic;
}

.console-input {
  display: flex;
  gap: 8px;
  align-items: center;
}

.prompt {
  color: var(--accent);
  font-family: 'Consolas', 'Monaco', monospace;
  font-weight: bold;
}

.console-input input {
  flex: 1;
  font-family: 'Consolas', 'Monaco', monospace;
}

.console-input button {
  padding: 8px 16px;
}

.panel-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.raw-mode-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: normal;
  cursor: pointer;
  user-select: none;
}

.raw-mode-toggle input {
  cursor: pointer;
}
</style>
