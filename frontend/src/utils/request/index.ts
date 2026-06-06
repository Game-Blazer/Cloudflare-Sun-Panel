import type { AxiosResponse, GenericAbortSignal } from 'axios'
import request from './axios'
import { useAuthStore } from '@/store/modules/auth'
import { router } from '@/router'

let loginMessageShow = false

export interface HttpOption {
  url: string
  data?: unknown
  method?: string
  headers?: Record<string, string>
  signal?: GenericAbortSignal
  beforeRequest?: () => void
  afterRequest?: () => void
}

export interface Response<T = unknown> {
  data: T
  msg: string
  code: number
}

function http<T = unknown>({ url, data, method, headers, signal, beforeRequest, afterRequest }: HttpOption) {
  const authStore = useAuthStore()

  const successHandler = (res: AxiosResponse<Response<T>>) => {
    if (res.data.code === 0) return res.data

    if (res.data.code === 401 || res.data.code === 1001 || res.data.code === 1000) {
      if (!loginMessageShow) {
        loginMessageShow = true
        setTimeout(() => {
          loginMessageShow = false
        }, 3000)
      }
      router.push({ path: '/login' })
      authStore.removeToken()
      return res.data
    }

    return Promise.reject(res.data)
  }

  const failHandler = (error: Response<Error>) => {
    afterRequest?.()
    throw new Error(error?.msg || 'Error')
  }

  beforeRequest?.()
  method = method || 'GET'

  const params = data ?? {}

  return method === 'GET'
    ? request.get(url, { params, signal }).then(successHandler, failHandler)
    : request.post(url, params, { headers, signal }).then(successHandler, failHandler)
}

export function post<T = unknown>(opt: HttpOption): Promise<Response<T>> {
  return http<T>({ ...opt, method: 'POST' })
}

export default post
