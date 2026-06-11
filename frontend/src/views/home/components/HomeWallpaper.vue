<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  backgroundImageSrc: string
  backgroundBlur: number
  backgroundMaskNumber: number
  backgroundType?: string
}>()

const isVideo = computed(() => /\.(mp4|webm|ogg)(\?.*)?$/i.test(props.backgroundImageSrc))

const displaySrc = computed(() => {
  if (!props.backgroundImageSrc) return ''
  return props.backgroundImageSrc
})
</script>

<template>
  <template v-if="backgroundImageSrc">
    <!-- 视频背景：检测 .mp4/.webm/.ogg -->
    <video
      v-if="isVideo"
      :src="backgroundImageSrc"
      autoplay
      loop
      muted
      playsinline
      class="fixed inset-0 z-[1] w-full h-full object-cover"
      :style="{
        filter: `blur(${backgroundBlur}px)`,
        transform: 'translateZ(0)',
        willChange: 'transform',
        contain: 'strict',
        contentVisibility: 'auto',
      }"
    />
    <!-- 静态图片（含动态 API 代理） -->
    <img
      v-else
      :src="displaySrc"
      alt=""
      fetchpriority="high"
      decoding="async"
      class="fixed inset-0 z-[1] w-full h-full object-cover"
      :style="{
        filter: `blur(${backgroundBlur}px)`,
        transform: 'translateZ(0)',
        willChange: 'transform',
        contain: 'strict',
        contentVisibility: 'auto',
      }"
    />
    <!-- 遮罩层 -->
    <div
      class="fixed inset-0 z-[1]"
      :style="{
        backgroundColor: `rgba(0,0,0,${backgroundMaskNumber})`,
        contain: 'strict',
      }"
    />
  </template>
  <!-- 无壁纸时的纯色背景 -->
  <div v-else class="fixed inset-0 z-[1] bg-[#1a1a2e]" style="contain: strict" />
</template>