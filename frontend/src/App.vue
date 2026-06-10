<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NDialogProvider } from 'naive-ui'
import { useTheme } from './hooks/useTheme'
import { useLanguage } from './hooks/useLanguage'

const { theme, themeOverrides } = useTheme()
const { language, dateLocale } = useLanguage()
</script>

<template>
  <NConfigProvider
    class="h-full"
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="language"
    :date-locale="dateLocale"
  >
    <NMessageProvider>
      <NDialogProvider>
        <RouterView v-slot="{ Component, route }">
          <Transition :name="route.meta.transition || 'page-fade'" mode="out-in">
            <component :is="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}
</style>
