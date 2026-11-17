"""未来 LangGraph 的适配边界：不在路由或评分函数里硬编码 Agent。"""

from typing import Protocol, TypedDict


class LearningContext(TypedDict):
    learner_id: str
    goal: str
    recent_attempts: list[dict]


class LearningAgent(Protocol):
    async def recommend(self, context: LearningContext) -> dict:
        """未来可由 LangGraph graph.ainvoke 实现；当前项目不伪造 Agent 输出。"""
        ...
