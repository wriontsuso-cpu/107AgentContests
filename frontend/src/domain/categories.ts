export const CATEGORY_IDS = [
  'services',
  'learning',
  'research',
  'competition',
  'community',
  'life',
  'wellbeing',
  'future',
  'other',
] as const

export type ResourceCategoryId = (typeof CATEGORY_IDS)[number]

export interface ResourceCategory {
  id: ResourceCategoryId
  index: string
  label: string
  shortLabel: string
  description: string
  prompt: string
  icon: string
  accent: string
  legacyCategories: readonly string[]
}

export const RESOURCE_CATEGORIES: readonly ResourceCategory[] = [
  {
    id: 'services',
    index: '01',
    label: '办事与公共服务',
    shortLabel: '办事服务',
    description: '从证件补办到财务与安全事务，找到明确的办理入口。',
    prompt: '我需要办理一件校园事务',
    icon: 'landmark',
    accent: '#4d75d7',
    legacyCategories: ['办事指南', '财务服务', '保卫服务', '网站入口', '校级通知', '公示公告', '资源导航', '学工通知', '教务服务'],
  },
  {
    id: 'learning',
    index: '02',
    label: '学习与学术',
    shortLabel: '学习学术',
    description: '课程、教务、图书馆与培养环节，一站梳理学习路径。',
    prompt: '我想找到课程或学习支持',
    icon: 'book-open',
    accent: '#1a8a91',
    legacyCategories: ['教务通知', '教务选课', '图书馆', '图书馆资源', '免费软件-会员'],
  },
  {
    id: 'research',
    index: '03',
    label: '科研与创新',
    shortLabel: '科研创新',
    description: '连接科研平台、学术交流与算力工具，让想法更快落地。',
    prompt: '我想开展科研或寻找创新资源',
    icon: 'atom',
    accent: '#735bc1',
    legacyCategories: ['学术科研', '会议-学术交流', '超算中心', '中心动态'],
  },
  {
    id: 'competition',
    index: '04',
    label: '竞赛与实践',
    shortLabel: '竞赛实践',
    description: '发现竞赛、科创项目与实践机会，把兴趣变成作品。',
    prompt: '我想参加竞赛或实践项目',
    icon: 'trophy',
    accent: '#d1842d',
    legacyCategories: ['竞赛-科创', '勤工助学'],
  },
  {
    id: 'community',
    index: '05',
    label: '社团与校园活动',
    shortLabel: '社团活动',
    description: '从讲座到社团与二课，发现正在发生的校园生活。',
    prompt: '我想认识同好或参加活动',
    icon: 'users-round',
    accent: '#d25763',
    legacyCategories: ['校园活动', '二课-团学活动', '青春科大', '媒体关注', '校园资讯', '社团-文体活动', '院系一线', '学研两会-学生组织', '二课-团学办事指南'],
  },
  {
    id: 'life',
    index: '06',
    label: '生活设施',
    shortLabel: '校园生活',
    description: '迎新、网络、软件与生活入口，解决在科大生活的小事。',
    prompt: '我遇到了校园生活问题',
    icon: 'coffee',
    accent: '#3b9b68',
    legacyCategories: ['新生指南', '迎新资讯', '新生事务', '生活服务'],
  },
  {
    id: 'wellbeing',
    index: '07',
    label: '身心健康与权益',
    shortLabel: '健康权益',
    description: '获得医疗、资助、学生权益与日常支持的可靠指引。',
    prompt: '我需要健康、资助或权益支持',
    icon: 'heart-pulse',
    accent: '#c95386',
    legacyCategories: ['校医院', '奖助学金'],
  },
  {
    id: 'future',
    index: '08',
    label: '升学就业与国际交流',
    shortLabel: '发展交流',
    description: '探索就业、升学与国际交流，让下一站更清晰。',
    prompt: '我正在规划升学、就业或交流',
    icon: 'route',
    accent: '#3576a8',
    legacyCategories: ['就业实习', '研究生培养', '本科招生', '留学-出境交流', '留学-国际交流'],
  },
] as const

const legacyCategoryMap = new Map<string, ResourceCategoryId>(
  RESOURCE_CATEGORIES.flatMap((category) =>
    category.legacyCategories.map((legacy) => [legacy, category.id] as const),
  ),
)

const futureCategoryMap: Record<string, ResourceCategoryId> = {
  academic: 'learning',
  campus_life: 'life',
  opportunity: 'competition',
  service: 'services',
  benefits: 'wellbeing',
  events: 'community',
}

export function resolveCategory(
  legacyCategory?: string,
  categoryId?: string,
  categoryName?: string,
): ResourceCategoryId {
  const direct = CATEGORY_IDS.find((id) => id === categoryId)
  if (direct) return direct
  if (categoryId && futureCategoryMap[categoryId]) return futureCategoryMap[categoryId]

  const byName = RESOURCE_CATEGORIES.find(
    (category) => category.label === categoryName || category.shortLabel === categoryName,
  )
  if (byName) return byName.id

  return legacyCategoryMap.get(legacyCategory ?? '') ?? 'other'
}

export function getCategory(id: ResourceCategoryId): ResourceCategory {
  return RESOURCE_CATEGORIES.find((category) => category.id === id) ?? {
    id: 'other',
    index: '09',
    label: '其他资源',
    shortLabel: '其他资源',
    description: '尚待归类的新资源入口。',
    prompt: '我想查找其他校园资源',
    icon: 'compass',
    accent: '#6f7785',
    legacyCategories: [],
  }
}
