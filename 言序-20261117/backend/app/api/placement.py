from fastapi import APIRouter, Header, Request
from .. import auth, storage
from ..schemas import PlacementSubmitInput

router = APIRouter(prefix="/placement")

PLACEMENT_BANK = [
    {
        "id": "q1",
        "skill": "vocab",
        "skillLabel": "词汇",
        "level": "A1",
        "weight": 6,
        "prompt": "选择加粗单词最恰当的中文意思：",
        "passage": "We need to **prepare** everything before the guests arrive.",
        "options": ["准备", "忘记", "拒绝", "延迟"],
        "correctIndex": 0,
        "explanation": "prepare 意为“准备”；before the guests arrive 意为“在客人到来之前”。",
    },
    {
        "id": "q2",
        "skill": "vocab",
        "skillLabel": "词汇",
        "level": "A2",
        "weight": 7,
        "prompt": "选择最合适的词填入空白处：",
        "passage": "Please keep your ____ ready before going through airport security.",
        "options": ["receipt", "boarding pass", "souvenir", "weather"],
        "correctIndex": 1,
        "explanation": "boarding pass 意为“登机牌”，机场安检前需要出示或准备好登机牌。",
    },
    {
        "id": "q3",
        "skill": "vocab",
        "skillLabel": "词汇",
        "level": "B2",
        "weight": 10,
        "prompt": "选择最接近加粗单词含义的解释：",
        "passage": "Limited funding can **constrain** long-term scientific research.",
        "options": ["加速推进", "限制、约束", "公开宣传", "彻底取消"],
        "correctIndex": 1,
        "explanation": "constrain 意为“限制、约束”，句意为“有限的资金可能会制约长期科学研究”。",
    },
    {
        "id": "q4",
        "skill": "grammar",
        "skillLabel": "语法",
        "level": "A1",
        "weight": 6,
        "prompt": "选择正确的动词形式完成句子：",
        "passage": "She ____ English every evening after dinner.",
        "options": ["study", "studying", "studies", "studied to"],
        "correctIndex": 2,
        "explanation": "主语为第三人称单数 she，且表示经常性动作（every evening），一般现在时动词需变化为 studies。",
    },
    {
        "id": "q5",
        "skill": "grammar",
        "skillLabel": "语法",
        "level": "B1",
        "weight": 8,
        "prompt": "选择语法最准确的选项完成句子：",
        "passage": "By the time the train arrived, we ____ at the platform for nearly an hour.",
        "options": ["wait", "are waiting", "had been waiting", "have waited"],
        "correctIndex": 2,
        "explanation": "by the time + 一般过去时（arrived）表示“到过去某一时刻为止一直在进行的动作”，应用过去完成进行时 had been waiting。",
    },
    {
        "id": "q6",
        "skill": "grammar",
        "skillLabel": "语法",
        "level": "C1",
        "weight": 11,
        "prompt": "选择语法与语域最自然准确的选项：",
        "passage": "Hardly ____ the announcement when commuters began heading toward the exit.",
        "options": [
            "had the staff made",
            "the staff had made",
            "did the staff made",
            "was the staff making",
        ],
        "correctIndex": 0,
        "explanation": "否定副词 hardly 置于句首时句子需部分倒装，常与 when 搭配构成“Hardly had + 主语 + 过去分词 + when...”。",
    },
    {
        "id": "q7",
        "skill": "reading",
        "skillLabel": "阅读理解",
        "level": "A2",
        "weight": 7,
        "prompt": "阅读对话片段，判断说话人最可能身处哪里：",
        "passage": "\"I'd prefer a quiet room away from the street, and could you let me know what time breakfast starts?\"",
        "options": [
            "At a hotel reception desk",
            "At an airport baggage claim",
            "Inside a city museum",
            "In a university library",
        ],
        "correctIndex": 0,
        "explanation": "quiet room（安静房间）和 breakfast（早餐时间）均为酒店办理入住时的典型交流内容。",
    },
    {
        "id": "q8",
        "skill": "reading",
        "skillLabel": "阅读理解",
        "level": "B1",
        "weight": 8,
        "prompt": "根据上下文逻辑选出最恰当的连接词：",
        "passage": "Public transport reduces traffic congestion; ____, expanding bus routes takes steady investment.",
        "options": ["however", "otherwise", "unless", "meanwhile to"],
        "correctIndex": 0,
        "explanation": "前句说明公共交通优势，后句指出扩展路线需要持续投入，两句构成转折关系，故选 however。",
    },
    {
        "id": "q9",
        "skill": "reading",
        "skillLabel": "阅读理解",
        "level": "B2",
        "weight": 10,
        "prompt": "阅读以下观点摘要，选出作者最核心的态度：",
        "passage": '"While automated tools can highlight surface errors in seconds, lasting fluency still depends on daily exposure to natural conversations and deliberate self-correction."',
        "options": [
            "自动化工具可以完全替代日常对话练习",
            "AI 工具能辅助纠错，但持久流利度仍依赖真实输入与主动练习",
            "学习语言时不应使用任何技术工具",
            "只有记住全部语法规则才能开始交流",
        ],
        "correctIndex": 1,
        "explanation": "While 引导让步，主句强调持久流利度仍取决于真实对话输入和有意识的自我纠正。",
    },
    {
        "id": "q10",
        "skill": "listening",
        "skillLabel": "听力理解",
        "level": "A2",
        "weight": 7,
        "prompt": "点击播放按钮听语音，选择说话人想了解的信息：",
        "audioText": "Excuse me, could you tell me which platform the next train to Oxford leaves from?",
        "options": [
            "询问开往牛津的下一班火车在哪个站台",
            "询问火车票退款流程",
            "抱怨火车晚点太久",
            "预订牛津市中心的酒店",
        ],
        "correctIndex": 0,
        "explanation": "关键信息为 which platform（哪个站台）与 the next train to Oxford（开往牛津的下一班火车）。",
    },
    {
        "id": "q11",
        "skill": "listening",
        "skillLabel": "听力理解",
        "level": "B1",
        "weight": 9,
        "prompt": "听语音，判断说话人推荐的记词方法：",
        "audioText": "If you want to remember new vocabulary, try using each word in a short sentence of your own rather than reading the list ten times.",
        "options": [
            "每天背诵完整的词典列表",
            "用新词自己造一个短句，而非单纯反复朗读列表",
            "只通过看电影学习生词",
            "把每个单词抄写十遍",
        ],
        "correctIndex": 1,
        "explanation": "说话人建议 try using each word in a short sentence of your own，而不是 reading the list ten times。",
    },
    {
        "id": "q12",
        "skill": "listening",
        "skillLabel": "听力理解",
        "level": "C1",
        "weight": 11,
        "prompt": "听语音，选出最准确概括说话人立场的一项：",
        "audioText": "Although preliminary findings look promising, the researchers cautioned against drawing broad conclusions until larger empirical trials are completed.",
        "options": [
            "初步结果已经足够证明结论完全正确",
            "尽管初步结果乐观，研究者仍提醒在更大规模实证试验前不宜过早下结论",
            "研究者决定放弃后续所有试验",
            "初步试验没有发现任何有价值的数据",
        ],
        "correctIndex": 1,
        "explanation": "关键词：preliminary findings（初步发现）、cautioned against（提醒谨慎）、empirical trials（实证试验）。",
    },
]


def evaluate_placement(answers: list[dict]) -> dict:
    by_id = {a["questionId"]: a["selectedIndex"] for a in answers}
    skill_order = ["vocab", "grammar", "reading", "listening"]
    skill_labels = {"vocab": "词汇", "grammar": "语法", "reading": "阅读理解", "listening": "听力理解"}
    skill_score: dict[str, int] = {}
    skill_max: dict[str, int] = {}

    total_score = 0
    correct_count = 0
    review = []

    for q in PLACEMENT_BANK:
        skill = q["skill"]
        weight = q["weight"]
        skill_max[skill] = skill_max.get(skill, 0) + weight
        selected = by_id.get(q["id"], -1)
        is_correct = selected == q["correctIndex"]
        if is_correct:
            total_score += weight
            correct_count += 1
            skill_score[skill] = skill_score.get(skill, 0) + weight
        item = {
            "questionId": q["id"],
            "skillLabel": q["skillLabel"],
            "level": q["level"],
            "prompt": q["prompt"],
            "options": q["options"],
            "selectedIndex": selected,
            "correctIndex": q["correctIndex"],
            "isCorrect": is_correct,
            "explanation": q["explanation"],
        }
        if "passage" in q:
            item["passage"] = q["passage"]
        if "audioText" in q:
            item["audioText"] = q["audioText"]
        review.append(item)

    skills = []
    for s in skill_order:
        mx = skill_max.get(s, 0)
        sc = skill_score.get(s, 0)
        pct = (sc * 100 + mx // 2) // mx if mx > 0 else 0
        skills.append({"skill": s, "label": skill_labels[s], "score": sc, "maxScore": mx, "percent": pct})

    level, level_label, summary, course, course_name = (
        "A1",
        "入门级 · A1",
        "刚刚起步是最好的状态！建议从日常生活核心基础词开始，配合发音与例句建立语感。",
        "general",
        "日常生活",
    )
    if total_score >= 83:
        level, level_label = "C1", "高阶熟练 · C1"
        summary = "你的词汇量、语法敏锐度与语境理解已达到高阶水平，适合挑战雅思学术词汇与 BBC 原声精听。"
        course, course_name = "ielts", "雅思 IELTS"
    elif total_score >= 65:
        level, level_label = "B2", "中高级 · B2"
        summary = "你已具备良好的英语阅读与句法基础，重点拓展六级高阶词汇与长难句能快速提升表达深度。"
        course, course_name = "cet6", "大学英语六级"
    elif total_score >= 45:
        level, level_label = "B1", "进阶级 · B1"
        summary = "你掌握了核心基础语法和常见表达，适合系统巩固四级高频词并搭配语言角听力训练。"
        course, course_name = "cet4", "大学英语四级"
    elif total_score >= 25:
        level, level_label = "A2", "基础级 · A2"
        summary = "你已具备日常沟通起步能力，推荐从出国旅游等高频实用场景词汇稳步积累。"
        course, course_name = "travel", "出国旅游"

    return {
        "score": total_score,
        "correctCount": correct_count,
        "totalQuestions": len(PLACEMENT_BANK),
        "level": level,
        "levelLabel": level_label,
        "summary": summary,
        "recommendedCourse": course,
        "courseName": course_name,
        "skills": skills,
        "review": review,
    }


@router.get("/test")
def placement_test():
    public_qs = [
        {k: v for k, v in q.items() if k not in ("correctIndex", "explanation")}
        for q in PLACEMENT_BANK
    ]
    return {
        "questions": public_qs,
        "totalQuestions": len(public_qs),
        "estimatedMinutes": 2,
    }


@router.post("/submit")
def placement_submit(
    payload: PlacementSubmitInput,
    request: Request,
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    learner = auth.resolve_learner(request, x_learner_id)
    evaluated = evaluate_placement([a.model_dump() for a in payload.answers])
    result = storage.add_placement_assessment(learner.key, evaluated)
    updated_user = None
    if learner.user:
        updated_user = storage.update_user_assessment(
            learner.user["id"], evaluated["level"], evaluated["recommendedCourse"]
        )
    return {"result": result, "user": updated_user}


@router.get("/latest")
def placement_latest(
    request: Request,
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    learner = auth.resolve_learner(request, x_learner_id)
    return {"latest": storage.get_latest_placement(learner.key)}
