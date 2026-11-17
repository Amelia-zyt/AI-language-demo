import { createRouter, createWebHistory } from "vue-router";
import LearnView from "./views/LearnView.vue";
import CornerView from "./views/CornerView.vue";
import EpisodesView from "./views/EpisodesView.vue";
import EpisodeView from "./views/EpisodeView.vue";
import MyView from "./views/MyView.vue";
import SettingsView from "./views/SettingsView.vue";
import AuthView from "./views/AuthView.vue";
import PlacementView from "./views/PlacementView.vue";
import ArticlesView from "./views/ArticlesView.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "learn",
      component: LearnView,
      meta: { title: "今日学习" },
    },
    {
      path: "/articles",
      name: "articles",
      component: ArticlesView,
      meta: { title: "分级课文" },
    },
    {
      path: "/articles/:id",
      name: "article-detail",
      component: ArticlesView,
      meta: { title: "课文精讲" },
    },
    {
      path: "/auth",
      name: "auth",
      component: AuthView,
      meta: { title: "登录 / 注册" },
    },
    {
      path: "/placement",
      name: "placement",
      component: PlacementView,
      meta: { title: "英语水平评测" },
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
    {
      path: "/my",
      name: "my",
      component: MyView,
      meta: { title: "我的" },
    },
    {
      path: "/settings",
      name: "settings",
      component: SettingsView,
      meta: { title: "设置" },
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/",
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
