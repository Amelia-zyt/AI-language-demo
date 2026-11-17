<script setup lang="ts">
import { favorites } from "../composables/useProfile";
</script>

<template>
  <div class="corner-wrap">
    <div class="section-intro">
      <h1>语言角</h1>
      <p class="sub">收听 BBC 原声节目、阅读文稿并跟读练习。</p>
    </div>

    <RouterLink to="/bbc" class="bbc-entry">
      <span class="bbc-mark">BBC</span>
      <span>
        <b>BBC LEARNING ENGLISH</b>
        <small>8 个官方栏目 · 同步文稿 · 跟读评分</small>
      </span>
      <span class="bbc-entry-arrow">进入栏目 ↗</span>
    </RouterLink>

    <RouterLink to="/favorites" class="corner-favorites-entry">
      <span class="corner-favorites-icon">★</span>
      <span>
        <b>我的收藏</b>
        <small>{{ favorites.length }} 集已收藏节目</small>
      </span>
      <span class="bbc-entry-arrow">查看收藏 ↗</span>
    </RouterLink>
  </div>
</template>
