<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { profile, content, toast } from "../composables/useProfile";
import { courseKey } from "../domain/learning";
import PageIntro from "../components/PageIntro.vue";
import { api } from "../api/client";
import type { Attempt } from "../types";
const mastered = computed(() =>
    Object.values(profile.sessions).reduce(
      (a, s) => a + s.counts.filter((n) => n === 3).length,
      0,
    ),
  ),
  attempts = ref<Attempt[]>([]);
function selectCourse(key: string) {
  profile.course = key;
  profile.preference = "content";
  if (key !== "general") profile.lang = "en";
  toast("已选择" + content.value!.courses[key].name);
}
onMounted(() =>
  api
    .attempts()
    .then((result) => (attempts.value = result.attempts))
    .catch(() => {}),
);
</script>
<template>
  <PageIntro
    title="每一步，都有回响。"
    subtitle="看见自己的积累，也为下一次进步留个位置。"
    eyebrow="MY LEARNING JOURNEY"
  />
  <div class="settings-grid">
    <section class="card wide learning-preferences">
      <h2>学习偏好</h2>
      <div class="preference-fields">
        <div>
          <label for="vocabularySource">词库偏好</label
          ><select id="vocabularySource" v-model="profile.preference">
            <option value="foundation">基础</option>
            <option value="content">跟随学习内容</option>
          </select>
        </div>
        <div>
          <label for="language">正在学习的语言</label
          ><select id="language" v-model="profile.lang">
            <option
              v-for="(language, key) in content!.languages"
              :key="key"
              :value="key"
            >
              {{ language[0] }} · {{ language[1] }}
            </option>
          </select>
        </div>
        <div>
          <label for="size">每轮单词数量</label
          ><select
            id="size"
            v-model.number="profile.size"
            @change="toast('将在下一轮使用新的词数')"
          >
            <option v-for="size in [10, 15, 20]" :key="size" :value="size">
              {{ size }}
            </option>
          </select>
        </div>
      </div>
      <p class="sub preference-note">
        “基础”使用当前语种的日常词库；“跟随学习内容”使用下方选择的考试或场景词库。词数变更在下一轮生效。
      </p>
    </section>
    <section class="card wide learning-content">
      <div class="card-title">
        <h2>学习内容</h2>
        <span class="tag"
          >已选内容：{{
            content!.courses[profile.lang === "en" ? profile.course : "general"]
              .name
          }}</span
        >
      </div>
      <p class="sub">选择你的学习方向，各方向的进度分别保存。</p>
      <div class="course-options" role="group" aria-label="学习内容">
        <button
          v-for="(course, key) in content!.courses"
          :key="key"
          class="course-option"
          :class="{ chosen: profile.course === key }"
          :aria-pressed="profile.course === key"
          @click="selectCourse(key)"
        >
          <b>{{ course.name }}</b
          ><small>{{ course.description }}</small
          ><span>{{
            profile.course === key ? "✓ 已选择" : "选择此内容 →"
          }}</span>
        </button>
      </div>
      <p class="sub course-note">
        考试与旅行场景使用英语，每个方向保留 20 个起步词汇。当前词库：{{
          content!.courses[courseKey(profile)].name
        }}。
      </p>
      <RouterLink class="primary" to="/">开始学习 →</RouterLink>
    </section>
    <section class="card">
      <div class="card-title">累计答题</div>
      <div class="bigstat">{{ profile.total }}<small> 次</small></div>
      <p class="sub">
        正确 {{ profile.correct }} 次 · 正确率
        {{
          profile.total
            ? Math.round((profile.correct / profile.total) * 100)
            : 0
        }}%
      </p>
    </section>
    <section class="card">
      <div class="card-title">学习积累</div>
      <div class="bigstat">{{ mastered }}<small> 个本轮已掌握词</small></div>
      <p class="sub">已完成 {{ profile.records.length }} 轮</p>
    </section>
    <section class="card wide">
      <h2>完成的学习记录</h2>
      <div class="table-scroll" v-if="profile.records.length">
        <table class="history">
          <thead>
            <tr>
              <th>完成时间</th>
              <th>学习内容</th>
              <th>掌握词数</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(record, i) in profile.records" :key="i">
              <td>{{ record.date }}</td>
              <td>
                {{ content!.languages[record.lang][0] }} ·
                {{ content!.courses[record.course]?.name || "日常生活" }}
              </td>
              <td>{{ record.count }}</td>
              <td>✓ 完成</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="sub">
        完成至少 10 个词，每个词连续答对三次，就会留下记录。
      </p>
    </section>
    <section class="card wide" v-if="attempts.length">
      <h2>最近的跟读练习</h2>
      <article
        v-for="attempt in attempts.slice(0, 10)"
        :key="attempt.id"
        class="attempt-row"
      >
        <span>{{ attempt.reference }}</span
        ><b>{{ attempt.assessment.score }} <small>/ 100 识别一致度</small></b>
      </article>
    </section>
  </div>
</template>
