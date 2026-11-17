<script setup lang="ts">
defineProps<{ count: number }>();
</script>
<template>
  <div class="dots" :aria-label="`已连续答对 ${count} 次`">
    <i v-for="i in 3" :key="i" :class="{ filled: i <= count }"></i>
  </div>
</template>
