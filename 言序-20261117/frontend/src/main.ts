import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./styles/style.css";
import "./styles/bbc.css";
import "./styles/coach.css";
import "./styles/refactor.css";
import "./composables/useTheme";
createApp(App).use(router).mount("#root");
