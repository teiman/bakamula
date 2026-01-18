<script setup>
import { useServerStore } from '../stores/serverStore'

const serverStore = useServerStore()
</script>

<template>
  <div class="panel">
    <div class="panel-title">
      Status
      <span v-if="serverStore.isPolling" class="polling-indicator"></span>
    </div>

    <div class="status-grid">
      <div class="status-item">
        <span class="status-label">Server</span>
        <span class="status-value" :class="{ active: serverStore.isRunning }">
          {{ serverStore.isRunning ? 'Running' : 'Stopped' }}
        </span>
      </div>

      <div class="status-item">
        <span class="status-label">Map</span>
        <span class="status-value">
          {{ serverStore.currentMap || '-' }}
        </span>
      </div>

      <div class="status-item">
        <span class="status-label">Players</span>
        <span class="status-value">
          {{ serverStore.isRunning ? serverStore.playerCount : '-' }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.polling-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.status-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-label {
  color: var(--text-secondary);
  font-size: 13px;
}

.status-value {
  font-weight: 500;
}

.status-value.active {
  color: var(--success);
}
</style>
