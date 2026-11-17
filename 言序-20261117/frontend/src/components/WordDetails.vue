<script setup lang="ts">
import type { WordEntry } from "../types";
import { speak } from "../composables/useSpeech";

defineProps<{ entry: WordEntry }>();
</script>

<template>
  <section class="word-details" aria-label="单词详解">
    <div class="detail-heading">
      <div>
        <div class="detail-word-row">
          <h2>{{ entry.word }}</h2>
          <button
            class="audio"
            aria-label="播放答案单词发音"
            @click="speak(entry.word)"
          >
            ♪
          </button>
          <span v-if="entry.ipa" class="detail-ipa">{{ entry.ipa }}</span>
        </div>
      </div>
      <strong>{{ entry.meaning }}</strong>
    </div>

    <div class="example">
      <div class="example-heading">
        <span class="micro">例句</span>
        <button
          class="example-audio"
          aria-label="播放例句语音"
          @click="speak(entry.example.text)"
        >
          ♪ 朗读例句
        </button>
      </div>
      <blockquote>{{ entry.example.text }}</blockquote>
      <p>{{ entry.example.translation }}</p>
      <div class="example-source">
        <a
          v-if="entry.example.url"
          :href="entry.example.url"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ entry.example.source }} ↗
        </a>
        <span v-else>{{ entry.example.source }}</span>
      </div>
    </div>
  </section>
</template>
