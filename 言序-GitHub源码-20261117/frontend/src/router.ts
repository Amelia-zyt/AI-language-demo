import { createRouter, createWebHashHistory } from "vue-router";
import SpeakingView from "./views/SpeakingView.vue";
import LearnView from "./views/LearnView.vue";
import CornerView from "./views/CornerView.vue";
import EpisodesView from "./views/EpisodesView.vue";
import EpisodeView from "./views/EpisodeView.vue";
import MyView from "./views/MyView.vue";
import SettingsView from "./views/SettingsView.vue";
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
{path:"/speaking",name:"speaking",component:SpeakingView,meta:{title:"口语练习"}},
    {
      path: "/",
      name: "learn",
      component: LearnView,
      meta: { title: "今日学习" },
    },
    {
      path: "/corner",
      name: "corner",
      component: CornerView,
      meta: { title: "语言角" },
    },
    {
      path: "/bbc",
      name: "bbc",
      component: EpisodesView,
      meta: { title: "BBC Learning English" },
    },
    {
      path: "/favorites",
      name: "favorites",
      component: EpisodesView,
      props: { collection: true },
      meta: { title: "语言角收藏" },
    },
    {
      path: "/episode/:id",
      name: "episode",
      component: EpisodeView,
      meta: { title: "BBC 单集详情" },
    },
    { path: "/my", name: "my", component: MyView, meta: { title: "我的学习" } },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
      meta: { title: "设置" },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
