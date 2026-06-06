import { post } from '@/utils/request'

export function login<T>(username: string, password: string) {
  return post<T>({ url: '/login', data: { username, password } })
}

export function register<T>(username: string, password: string, name?: string, mail?: string) {
  return post<T>({ url: '/register', data: { username, password, name, mail } })
}