import type { ResourceCategoryId } from '@/domain/categories'
import { assetUrl } from '@/lib/assetUrl'

export interface PageVisual {
  src: string
  alt: string
  kind: 'official' | 'stock' | 'generated'
  focalPoint: string
}

export const pageVisuals = {
  home: { src: assetUrl('/brand/campus-hero.webp'), alt: '中国科学技术大学雪后石碑校园实景', kind: 'official', focalPoint: '66% center' },
  resources: { src: assetUrl('/brand/home-campus-life-wide.webp'), alt: '夕阳下的大学校园草坪与远景学生', kind: 'stock', focalPoint: 'center 54%' },
  assistant: { src: assetUrl('/brand/assistant-clouds.webp'), alt: '暖色夕照下的层叠云朵', kind: 'stock', focalPoint: 'center 48%' },
  profile: { src: assetUrl('/brand/profile-snow-barn.webp'), alt: '雪原中的木屋实景', kind: 'stock', focalPoint: 'center 52%' },
} as const satisfies Record<string, PageVisual>

export const detailPhotography: Record<ResourceCategoryId, string> = {
  services: assetUrl('/brand/detail-services.webp'),
  learning: assetUrl('/brand/detail-learning.webp'),
  research: assetUrl('/brand/detail-research.webp'),
  competition: assetUrl('/brand/detail-competition.webp'),
  community: assetUrl('/brand/detail-community.webp'),
  life: assetUrl('/brand/detail-life.webp'),
  wellbeing: assetUrl('/brand/detail-wellbeing.webp'),
  future: assetUrl('/brand/detail-future.webp'),
  other: assetUrl('/brand/east-gate.webp'),
}
