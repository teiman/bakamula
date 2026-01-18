import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './renderer/App.vue';
import './renderer/styles/dark-theme.css';

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
