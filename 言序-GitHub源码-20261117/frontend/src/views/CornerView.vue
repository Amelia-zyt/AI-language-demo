<script setup lang="ts">
import PageIntro from "../components/PageIntro.vue";
import { favorites } from "../composables/useProfile";
</script>
<template>
  <PageIntro
    title="把语言，放进生活里。"
    subtitle="在真实节目里听懂表达，在一次次跟读里找到自己的节奏。"
    eyebrow="LANGUAGE CORNER"
  /><RouterLink to="/bbc" class="bbc-entry"
    ><span class="bbc-mark">BBC</span
    ><span
      ><b>BBC LEARNING ENGLISH</b
      ><small>真实节目 · 听力跟读 · 每日查看更新</small></span
    ><span class="bbc-entry-arrow">探索节目 ↗</span></RouterLink
  ><RouterLink to="/favorites" class="corner-favorites-entry"
    ><span class="corner-favorites-icon">★</span
    ><span
      ><b>语言角收藏</b
      ><small>{{ favorites.length }} 个已收藏节目 · 随时继续收听</small></span
    ><span class="bbc-entry-arrow">查看收藏 ↗</span></RouterLink
  >
  <section class="card corner-note">
    <h2>听 · 读 · 说</h2>
    <p class="sub">探索节目、收藏想反复收听的单集，使用跟读练习巩固表达。</p>
  </section>
</template>
