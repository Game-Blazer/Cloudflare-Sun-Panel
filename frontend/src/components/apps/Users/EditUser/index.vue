<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMessage } from 'naive-ui'
import type { FormInst, FormRules } from 'naive-ui'
import { createUser, updateUser } from '@/api/index'

interface Props {
  visible: boolean
  userInfo?: User.Info
}

interface Emit {
  (e: 'update:visible', visible: boolean): void
  (e: 'done'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emit>()
const message = useMessage()

const formInitValue = {
  username: '',
  name: '',
  role: 2,
  password: '',
}

const model = ref({ ...formInitValue })
const formRef = ref<FormInst | null>(null)

const roleOptions = [
  { label: '普通用户', value: 2 },
  { label: '管理员', value: 1 },
]

const rules: FormRules = {
  username: [{ required: true, trigger: 'blur', message: '请输入用户名', min: 1 }],
  role: {
    required: true,
    trigger: 'blur',
    type: 'number',
    message: '请选择角色',
  },
}

const show = computed({
  get: () => props.visible,
  set: (visible: boolean) => emit('update:visible', visible),
})

const isEdit = computed(() => !!props.userInfo?.id)

watch(
  () => props.visible,
  (val) => {
    if (val) {
      if (props.userInfo?.id) {
        model.value = { ...props.userInfo, password: '' }
      } else {
        model.value = { ...formInitValue }
      }
    }
  },
)

interface UserSaveRequest {
  username: string
  name: string
  role: number
  status: number
  password?: string
  id?: number
}

async function handleSave() {
  const req: UserSaveRequest = {
    username: model.value.username,
    name: model.value.name || model.value.username,
    role: model.value.role,
    status: 1,
  }

  if (isEdit.value) {
    req.id = props.userInfo?.id
    if (model.value.password) req.password = model.value.password
    else delete req.password
  } else {
    req.password = model.value.password
  }

  const res = isEdit.value ? await updateUser(req) : await createUser(req)

  if (res.code === 0) {
    message.success('保存成功')
    emit('done')
  } else {
    message.warning(res.msg || '保存失败')
  }
}

function handleValidateClick(e: MouseEvent) {
  e.preventDefault()
  formRef.value?.validate((errors) => {
    if (!errors) handleSave()
  })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    style="width: 400px"
    :title="isEdit ? '编辑用户' : '添加用户'"
    @update:show="(val: boolean) => emit('update:visible', val)"
  >
    <NForm ref="formRef" :model="model" :rules="rules">
      <NFormItem path="username" label="用户名">
        <NInput v-model:value="model.username" placeholder="请输入用户名" />
      </NFormItem>

      <NFormItem path="name" label="昵称">
        <NInput v-model:value="model.name" placeholder="请输入昵称" />
      </NFormItem>

      <NFormItem path="role" label="角色">
        <NSelect v-model:value="model.role" :options="roleOptions" />
      </NFormItem>

      <NFormItem path="password" label="密码">
        <NInput
          v-model:value="model.password"
          type="password"
          :placeholder="isEdit ? '留空则不修改密码' : '可留空，后续可设置'"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <div class="flex justify-end">
        <NButton type="primary" size="small" @click="handleValidateClick"> 保存 </NButton>
      </div>
    </template>
  </NModal>
</template>
