import { createApp } from 'vue'
import App from './App.vue'
import { setupI18n } from './locales'
import { setupStore } from './store'
import { setupRouter } from './router'
import './styles/global.css'

async function bootstrap() {
  const app = createApp(App)
  setupStore(app)
  setupI18n(app)
  
  // 等待路由就绪后再挂载，确保首次导航完成（避免空白页）
  await setupRouter(app)
  app.mount('#app')
}

bootstrap()
