<script setup lang="ts">
import { computed } from 'vue'
import { NModal, NSkeleton, NSpin } from 'naive-ui'

const props = defineProps<{
  visible: boolean
  src: string
  title: string
  isLoading: boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'loaded'): void
}>()

const show = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
})
</script>

<template>
  <NModal
    v-model:show="show"
    :mask-closable="false"
    preset="card"
    class="max-w-[1000px] w-[95vw] h-[85vh] sm:h-[600px] rounded-2xl"
    :bordered="true"
    size="small"
    role="dialog"
    aria-modal="true"
  >
    <template #header>
      <div class="flex items-center">
        <span class="mr-[20px]">{{ title }}</span>
        <NSpin v-if="isLoading" size="small" />
      </div>
    </template>
    <div class="w-full h-full rounded-2xl overflow-hidden border dark:border-zinc-700">
      <div v-if="isLoading" class="flex flex-col p-5">
        <NSkeleton height="50px" width="100%" class="rounded-lg" />
        <NSkeleton height="180px" width="100%" class="mt-[20px] rounded-lg" />
        <NSkeleton height="180px" width="100%" class="mt-[20px] rounded-lg" />
      </div>
      <iframe v-show="!isLoading" :src="src" class="w-full h-full" frameborder="0" @load="emit('loaded')" />
    </div>
  </NModal>
</template>
