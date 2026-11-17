<script setup lang="ts">
import { profile, content } from "../composables/useProfile";
defineProps<{ title: string; subtitle: string; eyebrow: string }>();
</script>
<template>
  <div class="intro">
    <div>
      <div class="eyebrow">{{ eyebrow }}</div>
      <h1>{{ title }}</h1>
      <p class="sub">{{ subtitle }}</p>
    </div>
    <RouterLink to="/my" class="lang-badge"
      >{{ content?.languages[profile.lang][1] }} <span>⌄</span></RouterLink
    >
  </div>
</template>
