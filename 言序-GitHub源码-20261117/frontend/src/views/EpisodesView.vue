<script setup lang="ts">
import {
  computed,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
  nextTick,
  reactive,
} from "vue";
import { useRouter } from "vue-router";
import {
  episodes,
  feeds,
  loadCatalog,
  catalogStatus,
  catalogBusy,
  catalogFilters,
} from "../composables/useCatalog";
import { favorites } from "../composables/useProfile";
import { player, playback } from "../composables/usePlayer";
import { formatTime, dateText } from "../domain/transcript";
import type { Episode } from "../types";
const props = withDefaults(defineProps<{ collection?: boolean }>(), {
    collection: false,
  }),
  router = useRouter();
const savedFilters = catalogFilters,
  visible = ref(50),
  onlySaved = ref(false),
  more = ref<HTMLElement | null>(null);
const series = computed({
  get: () =>
    props.collection ? savedFilters.collection : savedFilters.catalog,
  set: (value) => {
    if (props.collection) savedFilters.collection = value;
    else savedFilters.catalog = value;
    visible.value = 50;
  },
});
const filtered = computed(() =>
  episodes.value.filter(
    (e) =>
      (series.value === "all" || e.series === series.value) &&
      (!(props.collection || onlySaved.value) ||
        favorites.value.includes(e.id)),
  ),
);
const seriesName = (id: string) =>
  feeds.value.find((f) => f.id === id)?.name || "BBC Learning English";
function open(episode: Episode) {
  player.load(episode);
  void player.play();
  void router.push({
    name: "episode",
    params: { id: episode.id },
    query: { from: props.collection ? "favorites" : "bbc" },
  });
}
function rowClick(event: MouseEvent, episode: Episode) {
  if ((event.target as HTMLElement).closest("a,button")) return;
  open(episode);
}
let observer: IntersectionObserver | undefined;
watch(
  [filtered, visible, () => props.collection],
  async () => {
    await nextTick();
    observer?.disconnect();
    if (more.value && visible.value < filtered.value.length) {
      observer = new IntersectionObserver(
        (items) => {
          if (items.some((e) => e.isIntersecting)) visible.value += 50;
        },
        { rootMargin: "200px" },
      );
      observer.observe(more.value);
    }
  },
  { flush: "post" },
);
onMounted(async () => {
  await loadCatalog();
  void loadCatalog(true);
});
onBeforeUnmount(() => observer?.disconnect());
</script>
<template>
  <div class="bbc-header">
    <RouterLink to="/corner" class="link">← 返回语言角</RouterLink
    ><span class="tag">{{
      collection ? "MY COLLECTION" : "LISTEN · READ · REPEAT"
    }}</span>
  </div>
  <section :class="collection ? 'favorites-hero' : 'bbc-intro'">
    <div class="eyebrow">
      {{ collection ? "SAVED FOR ANOTHER LISTEN" : "BBC LEARNING ENGLISH" }}
    </div>
    <h1>{{ collection ? "语言角收藏" : "听见真实的英语。" }}</h1>
    <p class="sub">
      {{
        collection
          ? "把喜欢的声音留下，按自己的节奏重听。"
          : "官方订阅中的可用单集，按发布时间倒序排列。点击单集进入详情，播放、收藏或下载文本。"
      }}
    </p>
    <div :class="collection ? 'favorites-toolbar' : 'bbc-actions'">
      <template v-if="!collection"
        ><button class="primary" @click="filtered[0] && open(filtered[0])">
          ▶ 最新单集</button
        ><button
          class="bbc-secondary"
          :disabled="catalogBusy"
          @click="loadCatalog(true)"
        >
          ↻ 检查更新
        </button></template
      ><label for="bbcSeries" :class="collection ? '' : 'sr-only'">{{
        collection ? "栏目分类" : "筛选 BBC 栏目"
      }}</label
      ><select id="bbcSeries" v-model="series">
        <option value="all">{{ collection ? "全部收藏" : "全部栏目" }}</option>
        <option v-for="feed in feeds" :key="feed.id" :value="feed.id">
          {{ feed.name }}
        </option></select
      ><RouterLink v-if="collection" class="link" to="/bbc"
        >探索更多节目 ↗</RouterLink
      >
    </div>
    <template v-if="!collection"
      ><label class="bbc-favorites-filter"
        ><input type="checkbox" v-model="onlySaved" @change="visible = 50" />
        只看收藏</label
      >
      <div class="bbc-feed-status" role="status">
        {{ catalogStatus }}
      </div></template
    >
  </section>
  <section class="bbc-list-section">
    <div class="bbc-list-heading">
      <h2>
        {{ collection ? "已收藏" : "节目列表" }}
        <small>/ {{ filtered.length }} 集</small>
      </h2>
      <span class="micro">{{
        collection ? "按发布时间 ↓" : "从新到旧 ↓"
      }}</span>
    </div>
    <div class="bbc-episodes">
      <article
        v-for="episode in filtered.slice(0, visible)"
        :key="episode.id"
        class="bbc-episode"
        :class="{
          'is-playing': playback.episode?.id === episode.id && playback.playing,
        }"
        tabindex="0"
        :aria-label="'播放并查看 ' + episode.title"
        @click="rowClick($event, episode)"
        @keydown.enter.self.prevent="open(episode)"
        @keydown.space.self.prevent="open(episode)"
      >
        <div class="bbc-episode-main">
          <span class="bbc-series-name">{{ seriesName(episode.series) }}</span>
          <div class="bbc-episode-title-row">
            <button class="bbc-episode-open" @click.stop="open(episode)">
              <h3>
                {{ episode.title }}
                <span
                  v-if="favorites.includes(episode.id)"
                  class="favorite-star"
                  >★</span
                >
              </h3></button
            ><a
              class="bbc-episode-source"
              :href="episode.page"
              target="_blank"
              rel="noopener noreferrer"
              >BBC 官网 ↗</a
            >
          </div>
          <time :datetime="episode.published">{{
            dateText(episode.published)
          }}</time>
        </div>
        <button
          class="bbc-duration"
          :aria-label="`查看并播放 ${episode.title}`"
          @click.stop="open(episode)"
        >
          <i
            v-if="playback.episode?.id === episode.id && playback.playing"
            class="bbc-equalizer"
            aria-label="正在播放"
            ><i></i><i></i><i></i></i
          ><span v-else>▶</span>
          {{
            formatTime(
              playback.episode?.id === episode.id
                ? playback.duration
                : episode.duration,
            )
          }}
        </button>
      </article>
      <div v-if="!filtered.length" class="card">
        <p class="sub">
          {{
            collection || onlySaved
              ? "这个栏目暂无收藏，可在单集详情点击收藏。"
              : catalogBusy
                ? "正在读取节目…"
                : "暂无可用单集，请检查更新。"
          }}
        </p>
      </div>
    </div>
    <button
      v-if="visible < filtered.length"
      ref="more"
      class="bbc-load-more"
      @click="visible += 50"
    >
      加载更多单集 ↓
    </button>
    <p v-if="!collection" class="bbc-attribution">
      节目音频与官方文稿版权归 BBC 所有。<a
        href="https://www.bbc.co.uk/learningenglish/english/podcasts"
        target="_blank"
        rel="noopener noreferrer"
        >BBC 官方节目目录 ↗</a
      >
    </p>
  </section>
</template>
