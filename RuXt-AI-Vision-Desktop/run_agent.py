import argparse
import json
import logging
import os
import sys

# Ensure RuXt-AI-Vision-Desktop root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ruxt_agent_s.config import load_config
from ruxt_agent_s.agent import RuXtVisionAgent

def main():
    parser = argparse.ArgumentParser(description="RuXt AI Vision Desktop Agent (Agent-S Engine)")
    parser.add_argument("--task", type=str, required=True, help="Natural language desktop task")
    parser.add_argument("--provider", type=str, default=None, help="LLM provider: openai, anthropic, gemini, ollama, openrouter")
    parser.add_argument("--model", type=str, default=None, help="Vision model name (e.g. gpt-4o, claude-3-7-sonnet, gemini-2.0-flash)")
    parser.add_argument("--api-key", type=str, default=None, help="Provider API key")
    parser.add_argument("--base-url", type=str, default=None, help="Custom base URL (e.g. for Ollama / vLLM)")
    parser.add_argument("--max-steps", type=int, default=None, help="Maximum execution steps")
    parser.add_argument("--json", action="store_true", help="Output stream events as newline-delimited JSON for RuXt UI")
    parser.add_argument("--config", type=str, default=None, help="Path to config.yaml")

    args = parser.parse_args()

    # Load configuration
    config = load_config(args.config)
    if args.provider:
        config.provider = args.provider
    if args.model:
        config.model = args.model
    if args.api_key:
        config.api_key = args.api_key
    if args.base_url:
        config.base_url = args.base_url
    if args.max_steps:
        config.agent.max_steps = args.max_steps

    # Setup logging
    log_level = logging.INFO
    if args.json:
        # In JSON mode, log only to stderr so stdout is reserved for JSON events
        logging.basicConfig(level=log_level, stream=sys.stderr, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    else:
        logging.basicConfig(level=log_level, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    def on_step(step_data):
        if args.json:
            event = {"event": "step", **step_data}
            print(json.dumps(event), flush=True)
        else:
            print(f"\n[STEP {step_data['step']}]")
            if step_data.get("reflection"):
                print(f"  Reflection: {step_data['reflection']}")
            if step_data.get("plan"):
                print(f"  Plan: {step_data['plan']}")
            print(f"  Action: {step_data['action']}")
            print(f"  Result: {step_data['result']}")

    if args.json:
        print(json.dumps({"event": "start", "task": args.task, "model": config.model, "provider": config.provider}), flush=True)

    agent = RuXtVisionAgent(config=config, on_step_callback=on_step)
    
    try:
        result = agent.run_task(args.task)
        if args.json:
            print(json.dumps({"event": "finish", **result}), flush=True)
        else:
            print("\n===============================")
            print(f"Task Complete: success={result['success']}")
            print(f"Message: {result.get('message') or result.get('error')}")
            print("===============================")
        sys.exit(0 if result["success"] else 1)
    except KeyboardInterrupt:
        if args.json:
            print(json.dumps({"event": "aborted", "reason": "User interrupted with Ctrl+C"}), flush=True)
        else:
            print("\n[!] Task cancelled by user.")
        sys.exit(130)

if __name__ == "__main__":
    main()
