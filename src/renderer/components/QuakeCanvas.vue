<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useServerStore } from '../stores/serverStore';
import { useConfigStore } from '../stores/configStore';

const serverStore = useServerStore();
const configStore = useConfigStore();
const canvasRef = ref(null);
const scriptLoaded = ref(false);
const isInputCaptured = ref(false);

function toggleInputCapture() {
  isInputCaptured.value = !isInputCaptured.value;
  if (isInputCaptured.value && canvasRef.value) {
    canvasRef.value.focus();
  } else if (canvasRef.value) {
    canvasRef.value.blur();
  }
}

async function startEngine() {
  if (scriptLoaded.value) return;

  // Check WebGL availability
  const gl = canvasRef.value.getContext('webgl2') || 
             canvasRef.value.getContext('webgl') || 
             canvasRef.value.getContext('experimental-webgl');
             
  if (!gl) {
    serverStore.addToConsole('[WASM-ERR] WebGL not supported.');
    return;
  }

  // 1. Define the Module object BEFORE loading the script
  window.Module = {
    canvas: canvasRef.value,
    keyboardListeningElement: canvasRef.value,
    canvasAttributes: {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      preferLowPowerToHighPerformance: false,
      failIfMajorPerformanceCaveat: false
    },
    files: {},
    arguments: [
      '-basedir', configStore.selectedMod || 'id1',
      '-manifest', '/fte/ftewebgl.html.fmf',
      '+map', serverStore.currentMap || 'start',
      '+nosound',
      '+developer', '1',
      '+con_noprint', '0',
      '+con_width', '800' // Ensure internal console is initialized
    ],
    execute: (cmd) => {
      try {
        // Prepare the command (ensure newline for Cbuf_AddText)
        const commandWithNewline = cmd.endsWith('\n') ? cmd : cmd + '\n';
        
        // FTEQW WASM specific: FTEC.cbufadd is the standard JS entry point for command buffer
        if (window.FTEC && typeof window.FTEC.cbufadd === 'function') {
          window.FTEC.cbufadd(commandWithNewline);
        } else if (window.Module.ccall) {
          // Try ccall as a fallback (requires exported Cbuf_AddText)
          window.Module.ccall('Cbuf_AddText', 'void', ['string'], [commandWithNewline]);
        } else if (window.Module._Cbuf_AddText) {
          // Alternative fallback for directly exported C function
          const buffer = new TextEncoder().encode(commandWithNewline + '\0');
          const ptr = window.Module._malloc(buffer.length);
          window.Module.HEAPU8.set(buffer, ptr);
          window.Module._Cbuf_AddText(ptr);
          window.Module._free(ptr);
        } else {
          serverStore.addToConsole('[Error] WASM Engine command interface not found');
        }
      } catch (err) {
        serverStore.addToConsole(`[Error] Command execution failed: ${err.message}`);
      }
    },
    setStatus: (text) => {
      if (text) serverStore.addToConsole(`[FTE-STATUS] ${text}`);
    },
    totalDependencies: 0,
    monitorRunDependencies: (left) => {
      console.log('Dependencies left:', left);
    }
  };

  // 2. Load the FTE script AFTER Module is defined
  const script = document.createElement('script');
  script.src = '/fte/ftewebgl.js';
  script.async = true;
  script.onload = () => {
    scriptLoaded.value = true;
    serverStore.addToConsole('[WASM] Script loaded and initialized');
  };
  script.onerror = () => {
    serverStore.addToConsole('[Error] Failed to load /fte/ftewebgl.js. Ensure it is in public/fte/');
  };
  document.body.appendChild(script);
}

// Watch for isRunning to start the engine
watch(() => serverStore.isRunning, (running) => {
  if (running && serverStore.isWasmMode) {
    startEngine();
  }
});

function handleGlobalKeydown(e) {
  // Always allow Escape to release capture if we are captured
  if (e.key === 'Escape' && isInputCaptured.value) {
    isInputCaptured.value = false;
    if (canvasRef.value) canvasRef.value.blur();
    return;
  }

  // AGGRESSIVE EVENT SHIELD:
  // If we are NOT in capture mode, kill the event during the capture phase
  // so that Emscripten's global listeners (on window/document) don't see it.
  if (!isInputCaptured.value) {
    // List of keys we might want to allow even when closed (though for console it's usually safer to block all)
    // For now, block everything to be sure.
    e.stopImmediatePropagation();
    // e.preventDefault(); // Don't prevent default, we want it to reach the console input!
  }
}

// Intercept other keyboard events too
function blockEvent(e) {
  if (!isInputCaptured.value) {
    e.stopImmediatePropagation();
  }
}

let originalLog = console.log;
let originalWarn = console.warn;
let originalError = console.error;

onMounted(() => {
  // Hijack console to capture engine logs directly
  console.log = (...args) => {
    originalLog(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    if (msg.trim()) serverStore.addToConsole(msg);
  };
  
  console.warn = (...args) => {
    originalWarn(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    if (msg.trim()) serverStore.addToConsole(`[WASM-WARN] ${msg}`);
  };

  console.error = (...args) => {
    originalError(...args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ');
    if (msg.trim()) serverStore.addToConsole(`[WASM-ERR] ${msg}`);
  };

  // Use capture: true to intercept the event before it reaches Emscripten's global listeners
  window.addEventListener('keydown', handleGlobalKeydown, { capture: true });
  window.addEventListener('keyup', blockEvent, { capture: true });
  window.addEventListener('keypress', blockEvent, { capture: true });

  if (serverStore.isRunning && serverStore.isWasmMode) {
    startEngine();
  }
});

onUnmounted(() => {
  // Restore original console
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;

  window.removeEventListener('keydown', handleGlobalKeydown, { capture: true });
  window.removeEventListener('keyup', blockEvent, { capture: true });
  window.removeEventListener('keypress', blockEvent, { capture: true });
  
  if (window.Module) {
    // Small cleanup
  }
});
</script>

<template>
  <div class="quake-container">
    <div 
      class="canvas-wrapper" 
      :class="{ 'input-locked': !isInputCaptured }"
      @click="!isInputCaptured && toggleInputCapture()"
    >
      <canvas 
        ref="canvasRef" 
        class="quake-canvas" 
        :tabindex="isInputCaptured ? '0' : '-1'"
        oncontextmenu="event.preventDefault()"
      ></canvas>
      
      <div v-if="!isInputCaptured" class="canvas-overlay">
        <div class="overlay-content">
          <span>Click to Capture Input</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quake-container {
  width: 100%;
  height: 100%;
  background: #000;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.canvas-wrapper {
  flex: 1;
  position: relative;
  cursor: crosshair;
}

.canvas-wrapper.input-locked {
  cursor: pointer;
}

.quake-canvas {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
  outline: none;
}

.canvas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.overlay-content {
  background: rgba(26, 26, 46, 0.9);
  padding: 12px 24px;
  border-radius: 8px;
  border: 1px solid #30363d;
  color: white;
  font-size: 14px;
  backdrop-filter: blur(4px);
}

</style>
