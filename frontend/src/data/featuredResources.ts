import { resources } from './resources'

const preferredTitles = ['教务系统', '学习空间预约', '就业指导中心', '校医院']

export const featuredResources = preferredTitles
  .map((title) => resources.find((resource) => resource.title === title))
  .filter((resource) => resource !== undefined)
