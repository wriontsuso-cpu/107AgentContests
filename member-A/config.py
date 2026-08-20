"""中科大信息全量收集配置（学生向优先，覆盖公开站点）。"""

from dataclasses import dataclass


@dataclass
class SourceConfig:
    name: str
    base_url: str
    list_pages: list[str]
    category: str
    link_mode: str = "auto"  # auto | info | page | notice | php_id | list_any


# 公开可访问的信息源（登录墙站点见 curated / portals，无法无账号全量爬取）
SOURCES: list[SourceConfig] = [
    # —— 学工 / 奖助 / 活动线索 ——
    SourceConfig("学工在线-最新通知", "https://stuhome.ustc.edu.cn/", ["2316/list.htm"], "学工通知", "page"),
    SourceConfig("学工在线-学工动态", "https://stuhome.ustc.edu.cn/", ["2315/list.htm", "xgxw/list.htm"], "校园活动", "page"),
    SourceConfig("学工在线-资助育人", "https://stuhome.ustc.edu.cn/", ["zzyr/list.htm"], "奖助学金", "page"),
    SourceConfig("学工在线-奖助学金", "https://stuhome.ustc.edu.cn/", ["2306/list.htm"], "奖助学金", "page"),
    SourceConfig("学工在线-助学贷款", "https://stuhome.ustc.edu.cn/", ["2305/list.htm"], "奖助学金", "page"),
    SourceConfig("学工在线-勤工助学", "https://stuhome.ustc.edu.cn/", ["2304/list.htm"], "勤工助学", "page"),
    SourceConfig("学工在线-办事指南", "https://stuhome.ustc.edu.cn/", ["2311/list.htm"], "办事指南", "page"),
    SourceConfig("学工在线-文档中心", "https://stuhome.ustc.edu.cn/", ["2310/list.htm"], "办事指南", "page"),
    SourceConfig("学工在线-公示栏", "https://stuhome.ustc.edu.cn/", ["2298/list.htm"], "公示公告", "page"),
    # —— 教务 / 留学出境 ——
    SourceConfig("教务处-通知首页", "https://www.teach.ustc.edu.cn/", ["", "notice/"], "教务选课", "notice"),
    SourceConfig(
        "教务处-境外交流通知",
        "https://www.teach.ustc.edu.cn/",
        ["notice/notice-exchange/", "category/exchange/xchg-oversea", "category/exchange/"],
        "留学/出境交流",
        "notice",
    ),
    SourceConfig(
        "教务处-教学通知",
        "https://www.teach.ustc.edu.cn/",
        ["notice/notice-teaching/"],
        "教务选课",
        "notice",
    ),
    # —— 国际学院（留学/国际学生/交流活动）——
    SourceConfig(
        "国际学院-新闻速递",
        "https://ic.ustc.edu.cn/",
        ["news_event.php", "v7info.php?Nav_x=3"],
        "留学/国际交流",
        "php_id",
    ),
    SourceConfig(
        "国际学院-通知公告",
        "https://ic.ustc.edu.cn/",
        ["v7info.php?Nav_x=1"],
        "留学/国际交流",
        "php_id",
    ),
    SourceConfig(
        "国际学院-出境/全球化学习入口页",
        "https://ic.ustc.edu.cn/",
        ["v7info.php?Nav_x=18"],
        "留学/出境交流",
        "list_any",
    ),
    # —— 研究生院 ——
    SourceConfig(
        "研究生院",
        "https://gradschool.ustc.edu.cn/",
        ["", "column/64", "column/10", "column/9", "column/44"],
        "研究生培养",
        "list_any",
    ),
    # —— 就业 ——
    SourceConfig(
        "就业指导中心",
        "https://www.job.ustc.edu.cn/",
        [
            "Announcement/list.aspx?lcid=3",
            "InternshipAndPractice/list.aspx",
            "Specialrecruitment/list.aspx",
            "Campusdouble/list.aspx",
            "breakingnews/list.aspx",
            "Recruitment/list.aspx",
        ],
        "就业实习",
        "list_any",
    ),
    # —— 新闻网（活动/竞赛/培养线索）——
    SourceConfig("新闻网-人才培养", "https://news.ustc.edu.cn/", ["rcpy.htm"], "竞赛/科创", "info"),
    SourceConfig("新闻网-新闻博览", "https://news.ustc.edu.cn/", ["xwbl.htm"], "校园活动", "info"),
    SourceConfig("新闻网-党建文化", "https://news.ustc.edu.cn/", ["djwh.htm"], "校园活动", "info"),
    SourceConfig("新闻网-科研进展", "https://news.ustc.edu.cn/", ["kyjz.htm"], "学术科研", "info"),
    SourceConfig("新闻网-媒体关注", "https://news.ustc.edu.cn/", ["mtgz.htm"], "媒体关注", "info"),
    SourceConfig("新闻网-专题新闻", "https://news.ustc.edu.cn/", ["ztxw.htm"], "校园活动", "info"),
    # —— 主站 / 迎新 / 图书馆 ——
    SourceConfig(
        "主站-通知公告",
        "https://www.ustc.edu.cn/",
        ["tzgg.htm", "tzgg1.htm"],
        "校级通知",
        "info",
    ),
    SourceConfig("迎新网", "https://welcome.ustc.edu.cn/", ["", "web/helpstudents.html"], "新生事务", "list_any"),
    SourceConfig("图书馆首页动态", "https://lib.ustc.edu.cn/", [""], "图书馆资源", "list_any"),
]

STUDENT_KEYWORDS: list[str] = [
    "学生", "本科", "研究生", "奖学金", "助学金", "资助", "勤工",
    "贷款", "选课", "学分", "实习", "就业", "招聘", "双选",
    "会议", "研讨", "暑期学校", "交流", "访学", "竞赛", "大创",
    "志愿", "讲座", "培训", "免费", "优惠", "教育", "数据库",
    "图书馆", "开放日", "报名", "申请", "报销", "差旅",
    "英才班", "实训", "研学", "第二课堂", "二课", "青春科大",
    "创新创业", "留学", "出境", "境外", "交换", "联合培养",
    "CSC", "国家公派", "Fellowship", "活动", "社团", "团委",
    "文艺", "体育", "美育", "社会实践", "三下乡", "宣讲",
]

RESOURCE_TAG_RULES: dict[str, list[str]] = {
    "免费软件/会员": ["免费", "优惠", "会员", "教育版", "授权", "许可证", "学生包"],
    "奖助学金": ["奖学金", "助学金", "资助", "贷款", "勤工", "补助"],
    "会议/学术交流": ["会议", "研讨", "交流", "访学", "暑期学校", "workshop", "symposium"],
    "留学/出境交流": ["留学", "出境", "境外", "交换", "CSC", "Fellowship", "联合培养", "访学"],
    "二课/团学活动": ["第二课堂", "二课", "青春科大", "团委", "社团", "志愿", "美育"],
    "校园活动": ["活动", "讲座", "培训", "文艺", "体育", "沙龙", "开放日"],
    "就业实习": ["就业", "实习", "招聘", "双选", "宣讲", "岗位"],
    "竞赛/科创": ["竞赛", "大创", "挑战杯", "建模", "科创", "创新创业"],
    "教务选课": ["选课", "学分", "成绩", "培养方案", "教学"],
    "图书馆资源": ["图书馆", "数据库", "文献", "电子资源", "APC", "OA"],
    "办事指南": ["办事", "办理", "流程", "学生证", "证明", "表格"],
}

CURATED_RESOURCES_PATH = "data/curated_resources.json"

USER_AGENT = (
    "USTC-Student-Resource-Crawler/2.0 "
    "(+local educational use; public pages only)"
)

REQUEST_TIMEOUT = 20
REQUEST_DELAY_SECONDS = 1.0
MAX_PAGES_PER_SOURCE = 3
MAX_ARTICLES_PER_SOURCE = 20
FETCH_ARTICLE_BODY = True
REQUIRE_STUDENT_RELEVANCE = True
MIN_RELEVANCE_SCORE = 1

# --full 模式默认参数
FULL_MAX_PAGES_PER_SOURCE = 8
FULL_MAX_ARTICLES_PER_SOURCE = 50
FULL_REQUEST_DELAY_SECONDS = 0.8

OUTPUT_DIR = "output"
