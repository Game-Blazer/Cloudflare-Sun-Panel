<script setup lang="ts">
import { h, onMounted, reactive, ref } from 'vue'
import { NTag, NDropdown, NButton, useDialog, useMessage } from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'
import EditUser from './EditUser/index.vue'
import { useAuthStore } from '@/store'
import { getPublicVisitUser, setPublicVisitUser, deleteUsers, getUserList } from '@/api/index'

const message = useMessage()
const dialog = useDialog()
const authStore = useAuthStore()

const tableIsLoading = ref(false)
const editUserDialogShow = ref(false)
const editUserUserInfo = ref<User.Info>()
const publicVisitUserId = ref<number | null>(null)

const columns: DataTableColumns<User.Info> = [
  {
    title: '用户名',
    key: 'username',
    render(row: User.Info) {
      let prefix = ''
      if (publicVisitUserId.value && publicVisitUserId.value === row.id) prefix = '[公开]-'
      if (row.username === authStore.userInfo?.username) return `${prefix}${row.username} (当前用户)`
      return prefix + row.username
    },
  },
  {
    title: '昵称',
    key: 'name',
  },
  {
    title: '角色',
    key: 'role',
    render(row) {
      return h(NTag, { type: row.role === 1 ? 'info' : 'default' }, row.role === 1 ? '管理员' : '普通用户')
    },
  },
  {
    title: '操作',
    key: 'action',
    render(row) {
      const btn = h(NButton, { strong: true, tertiary: true, size: 'small' }, { default: () => '...' })
      return h(
        NDropdown,
        {
          trigger: 'click',
          onSelect(key: string | number) {
            switch (key) {
              case 'update':
                editUserUserInfo.value = row
                editUserDialogShow.value = true
                break
              case 'publicMode':
                if (publicVisitUserId.value && publicVisitUserId.value === row.id) {
                  setPublicVisitUser(null).then(({ code }) => {
                    if (code === 0) publicVisitUserId.value = null
                  })
                } else {
                  setPublicVisitUser(row.id as number).then(({ code }) => {
                    if (code === 0) publicVisitUserId.value = row.id as number
                  })
                }
                break
              case 'delete':
                dialog.warning({
                  title: '警告',
                  content: `确定删除用户 "${row.name}" (${row.username}) 吗？`,
                  positiveText: '确定',
                  negativeText: '取消',
                  onPositiveClick: () => handleDelete([row.id as number]),
                })
                break
            }
          },
          options: [
            { label: '编辑', key: 'update' },
            { label: '设置/取消公开访问', key: 'publicMode' },
            { label: '删除', key: 'delete' },
          ],
        },
        { default: () => btn },
      )
    },
  },
]

const userList = ref<User.Info[]>([])
const pagination = reactive({
  page: 1,
  showSizePicker: true,
  pageSizes: [10, 30, 50],
  pageSize: 10,
  itemCount: 0,
  onChange: (page: number) => {
    pagination.page = page
    loadList()
  },
  onUpdatePageSize: (pageSize: number) => {
    pagination.pageSize = pageSize
    pagination.page = 1
    loadList()
  },
})

async function handleDelete(ids: number[]) {
  const { code } = await deleteUsers(ids)
  if (code === 0) {
    message.success('删除成功')
    loadList()
  }
}

function handleAdd() {
  editUserUserInfo.value = undefined
  editUserDialogShow.value = true
}

function handleDone() {
  editUserDialogShow.value = false
  message.success('保存成功')
  loadList()
}

async function loadList() {
  tableIsLoading.value = true
  try {
    const { data } = await getUserList<Common.ListResponse<User.Info>>(pagination.page, pagination.pageSize)
    pagination.itemCount = data?.total || 0
    if (data?.list) userList.value = data.list
  } catch (e) {
    console.error(e)
  } finally {
    tableIsLoading.value = false
  }
}

onMounted(async () => {
  // 获取当前公开访问用户
  try {
    const { data } = await getPublicVisitUser<User.Info | null>()
    if (data?.id) publicVisitUserId.value = data.id
    else publicVisitUserId.value = null
  } catch {
    /* ignore */
  }
  loadList()
})
</script>

<template>
  <div class="overflow-auto pt-2">
    <NAlert type="info" :bordered="false">
      在此管理用户账号，可以添加、编辑、删除账号，以及设置某个用户为公开访问用户（访客模式）。
    </NAlert>

    <div class="my-3">
      <NButton type="primary" size="small" ghost @click="handleAdd"> 添加用户 </NButton>
    </div>

    <NDataTable
      :columns="columns"
      :data="userList"
      :pagination="pagination"
      :bordered="false"
      :loading="tableIsLoading"
      :remote="true"
    />

    <EditUser
      :visible="editUserDialogShow"
      :user-info="editUserUserInfo"
      @update:visible="editUserDialogShow = $event"
      @done="handleDone"
    />
  </div>
</template>
