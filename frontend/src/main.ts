import { createApp } from 'vue'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupStore } from './store'
import { setupRouter } from './router'
import './styles/global.less'

async function bootstrap() {
  const app = createApp(App)
  setupStore(app)
  setupI18n(app)
  await setupRouter(app)
  app.mount('#app')
}

bootstrap()