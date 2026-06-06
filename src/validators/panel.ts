import { z } from 'zod'

export const iconGroupSchema = z.object({
  id: z.number().int().positive().optional(),
  icon: z.string().optional(),
  title: z.string().min(1, '标题不能为空'),
  description: z.string().optional(),
  sort: z.number().int().optional(),
  publicVisible: z.number().int().min(0).max(1).optional(),
})

export const iconEditSchema = z.object({
  id: z.number().int().positive().optional(),
  icon: z
    .object({
      itemType: z.number().int(),
      src: z.string().optional(),
      text: z.string().optional(),
      backgroundColor: z.string().optional(),
    })
    .optional(),
  title: z.string().min(1, '标题不能为空'),
  url: z.string(),
  description: z.string().optional(),
  openMethod: z.number().int().optional(),
  sort: z.number().int().optional(),
  itemIconGroupId: z.number().int(),
})

export const iconAddMultipleSchema = z.array(
  z.object({
    icon: z
      .object({
        itemType: z.number().int(),
        src: z.string().optional(),
        text: z.string().optional(),
        backgroundColor: z.string().optional(),
      })
      .optional(),
    title: z.string(),
    url: z.string(),
    description: z.string().optional(),
    openMethod: z.number().int().optional(),
    sort: z.number().int().optional(),
    itemIconGroupId: z.number().int(),
  }),
)

export const idsSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'ids 不能为空'),
})

export const sortSchema = z.object({
  sortItems: z
    .array(
      z.object({
        id: z.number().int().positive(),
        sort: z.number().int(),
      }),
    )
    .min(1),
})

export const getListByGroupIdSchema = z.object({
  itemIconGroupId: z.number().int().optional(),
})

export const faviconSchema = z.object({
  url: z.string().min(1, 'url 不能为空'),
})

export const proxyIconSchema = z.object({
  url: z.string().min(1, 'url 不能为空'),
})