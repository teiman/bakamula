<script setup>
import { ref } from 'vue'
import { useConfigStore } from '../stores/configStore'
import { useServerStore } from '../stores/serverStore'

const configStore = useConfigStore()
const serverStore = useServerStore()

function handleToggle() {
  if (serverStore.isRunning) {
    serverStore.stopServer()
  } else {
    serverStore.startServer()
  }
}

const canStart = () => {
  return configStore.quakePath && configStore.selectedMod && !serverStore.isBusy
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">Server Control</div>



    <button
      class="control-button"
      :class="{ stop: serverStore.isRunning }"
      @click="handleToggle"
      :disabled="!canStart()"
    >
      <span class="indicator" :class="{ active: serverStore.isRunning }"></span>
      {{ serverStore.isRunning ? (serverStore.isWasmMode ? 'RESTART' : 'STOP') : 'START' }}
    </button>

    <button
      v-if="serverStore.isRunning && serverStore.isWasmMode"
      class="control-button snapshot"
      @click="serverStore.takeSnapshot()"
      :disabled="serverStore.isBusy"
    >
      SNAPSHOT
    </button>
  </div>
</template>

<style scoped>
.control-button {
  width: 100%;
  padding: 16px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 8px;
}

.control-button.stop {
  background: var(--error);
}

.control-button.snapshot {
  background: var(--accent);
  margin-top: 12px;
}

.indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-secondary);
}

.indicator.active {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}
</style>
