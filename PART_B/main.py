"""
Command-line entry for the resource navigation agent.

Run:
    python main.py
"""

from navigation_service import ResourceNavigationService, build_navigation_service


EXIT_COMMANDS = {"退出", "exit", "quit", "q"}


def read_user_question() -> str | None:
    while True:
        try:
            question = input("\n>>> ").strip()
        except EOFError:
            return None

        if question.lower() in EXIT_COMMANDS:
            return None
        if question:
            return question

        print("请输入问题，或输入“退出”结束程序。")


def answer_question(
    question: str,
    service: ResourceNavigationService | None = None,
) -> str:
    active_service = service or build_navigation_service()
    return active_service.answer(question).answer


def main() -> None:
    print("欢迎使用资源导航系统")
    print("请输入问题；输入“退出”、exit、quit 或 q 可以结束程序。")

    service = build_navigation_service()

    try:
        while True:
            question = read_user_question()
            if question is None:
                break

            try:
                answer = answer_question(question, service)
            except Exception as exc:
                print(f"\n请求失败：{exc}")
                continue

            print(f"\n回答：\n{answer}")
    except KeyboardInterrupt:
        pass

    print("\n已退出资源导航系统。")


if __name__ == "__main__":
    main()
