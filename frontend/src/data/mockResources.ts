// Small, representative browser demo set. The complete 1,295-record catalog is owned by the backend.
export const mockResourceRows = [
  { title: '邮箱', url: 'https://mail.ustc.edu.cn/', source: '学校邮箱', category: '资源导航', tags: ['邮箱', '公共服务'] },
  { title: '教务系统', url: 'https://jw.ustc.edu.cn/', source: '教务系统', category: '资源导航', tags: ['教务', '办事'] },
  { title: '学习空间预约', url: 'http://lib.ustc.edu.cn/?p=30439', source: '图书馆', category: '图书馆资源', summary: '预约图书馆学习空间与研修间。', tags: ['图书馆资源', '预约'] },
  { title: '本科生竞赛成果申报及成绩选择', url: 'https://www.teach.ustc.edu.cn/notice/notice-teaching/20079.html', source: '教务处', category: '教务通知', tags: ['教务通知', '竞赛'] },
  { title: '中国科大揭示力加载调控细胞伪足稳定性的生物力学机制', url: 'https://news.ustc.edu.cn/info/1048/95196.htm', source: '新闻网-科研进展', category: '学术科研', tags: ['学术科研'] },
  { title: '中国科大通过晶体对称性破缺实现闪锌矿量子点定向发光', url: 'https://news.ustc.edu.cn/info/1048/95204.htm', source: '新闻网-科研进展', category: '学术科研', tags: ['学术科研'] },
  { title: '国家大学生创新创业训练计划', url: 'https://www.teach.ustc.edu.cn/', source: '教务处', category: '竞赛-科创', summary: '本科生科创项目与高水平竞赛入口。', tags: ['大创', '竞赛', '科创', '本科'] },
  { title: '暑期“三下乡”社会实践', url: 'https://news.ustc.edu.cn/info/1047/95603.htm', source: '新闻网-人才培养', category: '竞赛-科创', tags: ['竞赛-科创', '校园活动'] },
  { title: '图书馆讲座、活动与数据库动态', url: 'https://lib.ustc.edu.cn/', source: '图书馆', category: '校园活动', summary: '学术讲座、信息素养培训、电子资源开通与校外访问指南。', tags: ['讲座', '培训', '数据库'] },
  { title: '校级会议与文化活动通知', url: 'https://www.ustc.edu.cn/tzgg.htm', source: '中国科学技术大学', category: '校园活动', summary: '校级公开通知，常含活动、讲座与办事类信息。', tags: ['活动', '会议', '通知'] },
  { title: '本科招生咨询组联系方式', url: 'https://welcome.ustc.edu.cn/web/news/181', source: '迎新网', category: '迎新资讯', tags: ['迎新资讯'] },
  { title: '本科招生培养亮点', url: 'https://welcome.ustc.edu.cn/web/news/182', source: '迎新网', category: '迎新资讯', tags: ['迎新资讯'] },
  { title: '校医院', url: 'https://hospital.ustc.edu.cn/', source: '校医院', category: '校医院', summary: '校医院门诊、健康服务与就医信息入口。', tags: ['医疗', '健康'] },
  { title: '奖助学金服务', url: 'https://stuhome.ustc.edu.cn/', source: '学生工作部', category: '奖助学金', summary: '查询奖助学金与学生资助相关通知。', tags: ['资助', '奖学金'] },
  { title: '就业指导中心', url: 'https://www.job.ustc.edu.cn/', source: '就业指导中心', category: '就业实习', summary: '校招、实习、基层就业、科研助理等岗位与招聘活动信息。', tags: ['就业', '实习', '招聘'] },
  { title: '国际合作与交流', url: 'https://oic.ustc.edu.cn/', source: '国际合作与交流部', category: '留学-国际交流', summary: '海外学习、国际交流与合作项目入口。', tags: ['留学', '国际交流'] },
] as const
