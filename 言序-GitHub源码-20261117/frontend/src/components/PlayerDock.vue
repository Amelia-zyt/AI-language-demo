<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { playback, player } from "../composables/usePlayer";
import { dateText } from "../domain/transcript";
import SkipIcon from "./SkipIcon.vue";
const router = useRouter(),
  route = useRoute();
function details() {
  if (playback.episode)
    void router.push({
      name: "episode",
      params: { id: playback.episode.id },
      query: {
        from:
          route.name === "favorites"
            ? "favorites"
            : String(route.query.from || "bbc"),
      },
    });
}
function click(event: MouseEvent) {
  if ((event.target as HTMLElement).closest("button,a,input,select,label"))
    return;
  details();
}
</script>
<template>
  <section
    v-if="playback.episode"
    id="bbcDock"
    class="bbc-dock"
    tabindex="0"
    aria-label="BBC 音频播放器，点击空白处进入当前音频详情"
    @click="click"
    @keydown.enter.self.prevent="details"
    @keydown.space.self.prevent="details"
  >
    <div class="bbc-dock-row">
      <div class="bbc-now">
        <div class="bbc-current-track">
          <span class="bbc-mark">BBC</span>
          <div class="bbc-track-meta">
            <button class="bbc-now-title" @click="details">
              {{ playback.episode.title }}</button
            ><time
              class="bbc-now-date"
              :datetime="playback.episode.published"
              >{{ dateText(playback.episode.published, false) }}</time
            >
          </div>
        </div>
      </div>
      <div class="bbc-transport">
        <div class="bbc-play-controls">
          <button
            id="bbcBack15"
            aria-label="后退15秒"
            @click="player.skip(-15)"
          >
            <SkipIcon back /></button
          ><button
            id="bbcToggle"
            class="bbc-toggle"
            :aria-label="!playback.paused ? '暂停' : '播放'"
            @click="player.toggle"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              aria-hidden="true"
            >
              <g v-if="!playback.paused">
                <rect x="6" y="5" width="4" height="14" rx="1.2" />
                <rect x="14" y="5" width="4" height="14" rx="1.2" />
              </g>
              <path
                v-else
                d="M8 5.5a1 1 0 0 1 1.5-.86l10 6.5a1 1 0 0 1 0 1.72l-10 6.5A1 1 0 0 1 8 18.5z"
              />
            </svg></button
          ><button
            id="bbcForward15"
            aria-label="快进15秒"
            @click="player.skip(15)"
          >
            <SkipIcon />
          </button>
        </div>
        <div class="bbc-play-options">
          <label class="sr-only" for="bbcRate">BBC 播放速度</label
          ><select
            id="bbcRate"
            :value="playback.rate"
            @change="
              player.setRate(Number(($event.target as HTMLSelectElement).value))
            "
          >
            <option
              v-for="rate in [0.8, 0.9, 1, 1.3, 1.5]"
              :key="rate"
              :value="rate"
            >
              {{ rate }}x
            </option>
          </select>
        </div>
      </div>
    </div>
    <div v-if="playback.status" class="bbc-player-status" role="status">
      {{ playback.status }}
    </div>
  </section>
</template>
