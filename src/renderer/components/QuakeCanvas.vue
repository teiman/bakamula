<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useServerStore } from '../stores/serverStore';
import { useConfigStore } from '../stores/configStore';

const serverStore = useServerStore();
const configStore = useConfigStore();
const canvasRef = ref(null);
const scriptLoaded = ref(false);

function toggleInputCapture() {
  serverStore.isInputCaptured = !serverStore.isInputCaptured;
  if (serverStore.isInputCaptured && canvasRef.value) {
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
      '-manifest', './fte/ftewebgl.html.fmf',
      '+map', serverStore.currentMap || 'start',
      '+nosound',
      '+developer', '1',
      '+con_noprint', '0',
      '+con_width', '800' // Ensure internal console is initialized
    ],
    execute: (cmd) => {
      try {
        const commandWithNewline = cmd.endsWith('\n') ? cmd : cmd + '\n';
        if (window.FTEC && typeof window.FTEC.cbufadd === 'function') {
          window.FTEC.cbufadd(commandWithNewline);
        } else if (window.Module.ccall) {
          window.Module.ccall('Cbuf_AddText', 'void', ['string'], [commandWithNewline]);
        } else if (window.Module._Cbuf_AddText) {
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
      if (text) {
        serverStore.addToConsole(`[FTE-STATUS] ${text}`);
        // FTE typically reports "Running..." when the main loop starts
        if (text === 'Running...' || text.includes('Starting...')) {
           handleEngineReady();
        }
      }
    },
    totalDependencies: 0,
    monitorRunDependencies: (left) => {
      console.log('Dependencies left:', left);
      if (left === 0 && scriptLoaded.value) {
        // Fallback or secondary trigger
        setTimeout(handleEngineReady, 500);
      }
    }
  };

  // 2. Load the FTE script AFTER Module is defined
  const script = document.createElement('script');
  script.src = './fte/ftewebgl.js';
  script.async = true;
  script.onload = () => {
    scriptLoaded.value = true;
    serverStore.addToConsole('[WASM] Script loaded and initialized');
  };
  script.onerror = () => {
    serverStore.addToConsole('[Error] Failed to load ./fte/ftewebgl.js. Ensure it is in public/fte/');
  };
  document.body.appendChild(script);
}

const configApplied = ref(false);

async function handleEngineReady() {
  if (configApplied.value) return;
  
  // Give it a small moment to ensure the command buffer is definitely ready
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    // Attempt to read config/low.cfg using the new Electron API
    // We try a few possible relative paths just in case
    let content = null;
    const possiblePaths = ['config/low.cfg', './config/low.cfg', '../config/low.cfg'];
    
    for (const path of possiblePaths) {
      try {
        content = await window.electronAPI.readFile(path);
        if (content) {
          serverStore.addToConsole(`[WASM] Found config at: ${path}`);
          break;
        }
      } catch (e) {
        // Continue to next path
      }
    }

    if (content) {
      serverStore.addToConsole('[WASM] Applying low.cfg commands...');
      const lines = content.split('\n');
      let count = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        // Ignore empty lines and comments
        if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('#') && !trimmed.startsWith(';')) {
          window.Module.execute(trimmed);
          count++;
        }
      }
      configApplied.value = true;
      serverStore.addToConsole(`[WASM] ${count} commands from low.cfg applied`);
    } else {
      serverStore.addToConsole('[WASM-WARN] config/low.cfg not found or empty');
      // Set anyway so we don't keep trying and failing
      configApplied.value = true; 
    }
  } catch (err) {
    serverStore.addToConsole(`[Error] Failed to apply low.cfg: ${err.message}`);
  }
}

// Watch for isRunning to start the engine
watch(() => serverStore.isRunning, (running) => {
  if (running && serverStore.isWasmMode) {
    startEngine();
  }
});

function handleGlobalKeydown(e) {
  // Capture F1 for snapshot
  if (e.key === 'F1') {
    e.preventDefault();
    e.stopImmediatePropagation();
    serverStore.takeSnapshot();
    return;
  }

  // Always allow Escape to release capture if we are captured
  if (e.key === 'Escape' && serverStore.isInputCaptured) {
    serverStore.isInputCaptured = false;
    if (canvasRef.value) canvasRef.value.blur();
    return;
  }

  // AGGRESSIVE EVENT SHIELD:
  // If we are NOT in capture mode, kill the event during the capture phase
  // so that Emscripten's global listeners (on window/document) don't see it.
  if (!serverStore.isInputCaptured) {
    // List of keys we might want to allow even when closed (though for console it's usually safer to block all)
    // For now, block everything to be sure.
    e.stopImmediatePropagation();
    // e.preventDefault(); // Don't prevent default, we want it to reach the console input!
  }
}

// Intercept other keyboard events too
function blockEvent(e) {
  if (!serverStore.isInputCaptured) {
    e.stopImmediatePropagation();
  }
}

let originalLog = console.log;
let originalWarn = console.warn;
let originalError = console.error;

const wrapperRef = ref(null);

// Resize handler to update canvas internal resolution
const resizeObserver = new ResizeObserver((entries) => {
  if (!wrapperRef.value || !canvasRef.value) return;
  
  // Measure the wrapper (the true layout space) instead of the canvas
  const rect = wrapperRef.value.getBoundingClientRect();
  const width = Math.floor(rect.width);
  const height = Math.floor(rect.height);
  
  if (width === 0 || height === 0) return;

  // Update canvas internal dimensions only if they actually changed
  if (canvasRef.value.width !== width || canvasRef.value.height !== height) {
    canvasRef.value.width = width;
    canvasRef.value.height = height;
    
    serverStore.addToConsole(`[WASM] Resolution synced: ${width}x${height}`);
    
    // Notify FTEQW
    window.dispatchEvent(new Event('resize'));
  }
});

onMounted(() => {
  // ... hijacks ...
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

  window.addEventListener('keydown', handleGlobalKeydown, { capture: true });
  window.addEventListener('keyup', blockEvent, { capture: true });
  window.addEventListener('keypress', blockEvent, { capture: true });
  
  if (serverStore.isRunning && serverStore.isWasmMode) {
    startEngine();
  }

  // Start observing WRAPPER resize
  if (wrapperRef.value) {
    resizeObserver.observe(wrapperRef.value);
  }
});

onUnmounted(() => {
  // ... cleanup ...
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;

  window.removeEventListener('keydown', handleGlobalKeydown, { capture: true });
  window.removeEventListener('keyup', blockEvent, { capture: true });
  window.removeEventListener('keypress', blockEvent, { capture: true });
  
  resizeObserver.disconnect();
});

</script>

<template>
  <div class="quake-container">
    <div 
      ref="wrapperRef"
      class="canvas-wrapper" 
      :class="{ 'input-locked': !serverStore.isInputCaptured }"
      @click="!serverStore.isInputCaptured && toggleInputCapture()"
    >
      <canvas 
        ref="canvasRef" 
        class="quake-canvas" 
        :tabindex="serverStore.isInputCaptured ? '0' : '-1'"
        oncontextmenu="event.preventDefault()"
      ></canvas>
      
      <div v-if="!serverStore.isInputCaptured" class="canvas-overlay">
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
  min-height: 0;
  min-width: 0;
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
