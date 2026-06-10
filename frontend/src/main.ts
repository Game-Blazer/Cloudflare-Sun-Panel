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
  
  // 不再阻塞 mount：路由异步就绪，先挂载应用减少白屏时间
  setupRouter(app)
  app.mount('#app')
}

bootstrap()
