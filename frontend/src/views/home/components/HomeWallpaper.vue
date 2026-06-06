<script setup lang="ts">
defineProps<{
  backgroundImageSrc: string
  backgroundBlur: number
  backgroundMaskNumber: number
}>()
</script>

<template>
  <template v-if="backgroundImageSrc">
    <!-- 壁纸层 -->
    <div
      class="fixed inset-0 z-[1]"
      :style="{
        filter: `blur(${backgroundBlur}px)`,
        transform: 'translateZ(0)',
        willChange: 'transform',
      }"
    >
      <img
        :src="backgroundImageSrc"
        class="w-full h-full object-cover"
        fetchpriority="high"
        loading="eager"
        decoding="sync"
        alt=""
      />
    </div>
    <!-- 遮罩层 -->
    <div
      class="fixed inset-0 z-[1]"
      :style="{
        backgroundColor: `rgba(0,0,0,${backgroundMaskNumber})`,
      }"
    />
  </template>
</template>
