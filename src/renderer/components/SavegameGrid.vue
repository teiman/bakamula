<script setup>
import { computed, ref, watch } from 'vue'
import { getClassnameColor } from '../utils/savegameParser'

const props = defineProps({
  entities: {
    type: Array,
    default: () => []
  }
})

const selectedEntityIndex = ref(null)
const entityCount = computed(() => props.entities.length)

const selectedEntity = computed(() => {
  if (selectedEntityIndex.value === null) return null
  return props.entities.find(e => e.entityIndex === selectedEntityIndex.value)
})

// Reset selection if entities change
watch(() => props.entities, () => {
  selectedEntityIndex.value = null
})

function selectEntity(index) {
  selectedEntityIndex.value = index
}

const formatValue = (value) => {
  if (typeof value === 'object') return JSON.stringify(value)
  return value
}
</script>

<template>
  <div class="snapshot-container" v-if="entities.length > 0">
    <div class="snapshot-panel">
      <div class="panel-header">
        <span class="panel-title">Snapshot ({{ entityCount }} entities)</span>
      </div>
      <div class="grid-container">
        <div
          v-for="entity in entities"
          :key="entity.entityIndex"
          class="entity-cell"
          :class="{ selected: selectedEntityIndex === entity.entityIndex }"
          :style="{ backgroundColor: getClassnameColor(entity.classname) }"
          :title="`#${entity.entityIndex}: ${entity.classname}`"
          @click="selectEntity(entity.entityIndex)"
        >
          <span class="entity-initial">{{ entity.classname ? entity.classname.charAt(0).toUpperCase() : '?' }}</span>
        </div>
      </div>
    </div>

    <!-- Details View -->
    <div class="details-panel" v-if="selectedEntity">
      <div class="details-header">
        <span class="details-title">#{{ selectedEntity.entityIndex }}: {{ selectedEntity.classname }}</span>
        <button class="close-btn" @click="selectedEntityIndex = null">×</button>
      </div>
      <div class="details-content">
        <div v-for="(value, key) in selectedEntity.properties" :key="key" class="property-row">
          <span class="prop-key">{{ key }}:</span>
          <span class="prop-val">{{ formatValue(value) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.snapshot-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.snapshot-panel {
  background: var(--bg-secondary, #1e1e2e);
  border-radius: 8px;
  border: 1px solid var(--border, #313244);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 250px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #bac2de);
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(24px, 1fr));
  gap: 4px;
  overflow-y: auto;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.entity-cell {
  aspect-ratio: 1;
  min-height: 24px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.1s;
  background-color: #444;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
}

.entity-initial {
  font-size: 10px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  pointer-events: none;
}

.entity-cell:hover {
  transform: scale(1.1);
  z-index: 10;
  border-color: #fff;
}

.entity-cell.selected {
  outline: 2px solid var(--accent, #f5c2e7);
  outline-offset: 1px;
  transform: scale(1.05);
  z-index: 5;
}

/* Details Panel */
.details-panel {
  background: var(--bg-secondary, #1e1e2e);
  border-radius: 8px;
  border: 1px solid var(--border, #313244);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: monospace;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border, #313244);
  padding-bottom: 6px;
  margin-bottom: 4px;
}

.details-title {
  font-size: 13px;
  font-weight: bold;
  color: var(--accent, #f5c2e7);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
}

.details-content {
  overflow-y: auto;
  max-height: 300px;
  font-size: 12px;
}

.property-row {
  display: flex;
  gap: 8px;
  padding: 2px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.prop-key {
  color: var(--text-secondary);
  min-width: 100px;
  flex-shrink: 0;
}

.prop-val {
  color: #fff;
  word-break: break-all;
}
</style>
