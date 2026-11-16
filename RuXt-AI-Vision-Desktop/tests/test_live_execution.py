import os
import sys
import time
import subprocess

# Ensure RuXt-AI-Vision-Desktop root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ruxt_agent_s.config import load_config
from ruxt_agent_s.agent import RuXtVisionAgent

class MockLLMClient:
    """Mock MultiModal LLM Client that simulates Agent-S responses for live integration testing."""
    def __init__(self):
        self.step = 0

    def generate(self, system_prompt: str, user_prompt: str, image_base64: str) -> str:
        self.step += 1
        if self.step == 1:
            return """
Reflection: Notepad window is open. I should click on the text area to focus.
Plan: Click in the center of the screen to focus Notepad.
Action: agent.click(x=500, y=500, description="Notepad canvas")
            """
        elif self.step == 2:
            return """
Reflection: Notepad is focused. Now I will type the confirmation message.
Plan: Type text into Notepad.
Action: agent.type(text="RuXt Vision Desktop Agent is working perfectly!", clear_existing=False)
            """
        else:
            return """
Reflection: Text has been successfully entered into the editor.
Plan: Task is complete.
Action: agent.finish(message="Text entered successfully into Notepad")
            """

def test_live_notepad_execution():
    print("\n--- Starting Live Desktop Automation Test ---")
    # 1. Launch notepad for testing
    proc = subprocess.Popen(["notepad.exe"])
    time.sleep(1.5)

    try:
        config = load_config()
        agent = RuXtVisionAgent(config=config)
        # Inject mock LLM to test the full live OS loop without spending API tokens
        agent.llm = MockLLMClient()

        steps_recorded = []
        def on_step(s):
            print(f"  -> Live Step {s['step']}: {s['action']} | Result: {s['result']}")
            steps_recorded.append(s)

        agent.on_step_callback = on_step
        result = agent.run_task("Open Notepad and type a confirmation message")

        print(f"Test Result: {result['success']} - {result.get('message')}")
        assert result["success"] is True
        assert len(steps_recorded) == 3
        print("--- Live Desktop Automation Test Passed! ---")
    finally:
        # Close notepad without saving
        try:
            subprocess.run(["taskkill", "/f", "/im", "notepad.exe"], capture_output=True)
        except Exception:
            pass

if __name__ == "__main__":
    test_live_notepad_execution()
