<script setup lang="ts">
defineProps<{ back?: boolean }>();
</script>
<template>
  <svg
    viewBox="0 0 36 36"
    width="34"
    height="34"
    fill="none"
    aria-hidden="true"
  >
    <g
      :transform="back ? 'translate(36 0) scale(-1 1)' : undefined"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M28 11a13 13 0 1 0 3 10M28 4v7h-7" />
    </g>
    <text
      x="18"
      y="22"
      text-anchor="middle"
      fill="currentColor"
      font-family="Arial,sans-serif"
      font-size="11"
      font-weight="600"
    >
      15
    </text>
  </svg>
</template>
