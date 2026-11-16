"""
RuXt Integration Bridge for RuXt AI Vision Desktop (Agent-S)
Allows Node.js / Electron server to control and stream autonomous desktop actions via JSON IPC.
"""

import json
import os
import sys

# Ensure RuXt-AI-Vision-Desktop root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ruxt_agent_s.agent import RuXtVisionAgent
from ruxt_agent_s.config import load_config

def run_ipc():
    """
    Reads JSON commands from stdin and outputs JSON responses to stdout.
    Command format:
    {"command": "run", "task": "...", "provider": "openai", "model": "gpt-4o", "api_key": "..."}
    """
    config = load_config()

    def on_step(step_data):
        print(json.dumps({"type": "step", "data": step_data}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
            action = cmd.get("command")

            if action == "run":
                task = cmd.get("task")
                if not task:
                    print(json.dumps({"type": "error", "error": "Missing task"}), flush=True)
                    continue

                if cmd.get("provider"):
                    config.provider = cmd["provider"]
                if cmd.get("model"):
                    config.model = cmd["model"]
                if cmd.get("api_key"):
                    config.api_key = cmd["api_key"]
                if cmd.get("base_url"):
                    config.base_url = cmd["base_url"]

                agent = RuXtVisionAgent(config=config, on_step_callback=on_step)
                result = agent.run_task(task)
                print(json.dumps({"type": "finish", "result": result}), flush=True)

            elif action == "ping":
                print(json.dumps({"type": "pong", "status": "ready"}), flush=True)

            elif action == "quit":
                break

        except Exception as e:
            print(json.dumps({"type": "error", "error": str(e)}), flush=True)

if __name__ == "__main__":
    run_ipc()
