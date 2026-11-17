<script setup lang="ts">
import type { Cue } from "../types";
import { formatTime } from "../domain/transcript";
defineProps<{ cue: Cue; index: number; active: boolean }>();
defineEmits<{ play: [index: number]; record: [index: number] }>();
</script>
<template>
  <div class="bbc-cue-row">
    <button
      class="bbc-cue"
      :class="{ active }"
      :data-cue-index="index"
      :aria-current="active ? 'true' : 'false'"
      @click="$emit('play', index)"
    >
      <span>{{ cue.start === null ? "文稿" : formatTime(cue.start) }}</span
      ><span>{{ cue.text }}</span></button
    ><button
      class="bbc-shadow-icon"
      :aria-label="`跟读第 ${index + 1} 句`"
      title="跟读这一句"
      @click="$emit('record', index)"
    >
      <svg
        viewBox="0 0 24 24"
        width="19"
        height="19"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        aria-hidden="true"
      >
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
      </svg>
    </button>
  </div>
</template>
