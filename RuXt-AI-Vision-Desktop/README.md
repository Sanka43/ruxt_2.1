# RuXt AI Vision Desktop — Powered by Agent-S Architecture

**RuXt AI Vision Desktop** is the autonomous, vision-based computer-use engine embedded directly within **RuXt 2.1**. It absorbs and productionizes the core concepts of the state-of-the-art **Agent-S** framework (Hierarchical Planning, Visual Grounding, Multimodal Closed-Loop Execution, and Windows UI Automation) so that RuXt users get native, zero-config desktop control without needing any external repositories or manual setups.

---

## Architecture: Closed-Loop Perception & Action

The engine operates on the benchmarked Agent-S loop:
```
       ┌───────────────┐
       │  User Prompt  │
       └───────┬───────┘
               ▼
      [ OBSERVE SCREEN ]  ◄── MSS multi-monitor capture & DPI desktop binding
               │
               ▼
      [ PLAN & REFLECT ]  ◄── Multimodal Vision LLM (GPT-4o, Claude 3.7, Gemini, Ollama)
               │
               ▼
     [ VISUAL GROUNDING ] ◄── Coordinate normalization (0-1000) & Windows UIA verification
               │
               ▼
        [ ACT (OS) ]      ◄── Precision mouse interpolation, Unicode typing, keyboard hotkeys
               │
               ▼
        [ VERIFY LOOP ]   ◄── State change check & iterative task progression
```

---

## Key Features

1. **Integrated Agent-S Core**:
   - **Hierarchical Planning**: Breaks complex user goals into atomic desktop interactions.
   - **Visual Coordinate Grounding**: Maps target elements into exact screen coordinates ($0-1000$ normalized space to pixel space).
   - **Windows UI Automation (UIA) Hybrid**: Uses Windows accessibility trees to complement vision predictions for 100% click accuracy.
2. **Multi-Provider Multimodal Support**:
   - **OpenAI**: GPT-4o, GPT-4o-mini
   - **Anthropic**: Claude 3.5 Sonnet, Claude 3.7 Sonnet (Computer-Use)
   - **Google Gemini**: Gemini 1.5 Pro/Flash, Gemini 2.0 Flash
   - **Ollama**: Local vision models (llama3.2-vision, minicpm-v, qwen2-vl)
   - **OpenRouter & vLLM**: Any OpenAI-compatible multimodal endpoint
3. **Enterprise Windows 10/11 Stability**:
   - `SetThreadDesktop` WinStation desktop binding (works seamlessly across background processes and services).
   - DPI-aware coordinate mapping (prevents offset issues on 125%/150%/200% Windows scaling).
   - Unicode-safe clipboard typing.
   - Fail-safe abort mechanisms.
4. **RuXt 2.1 Native Integration**:
   - **CLI Mode**: Run directly via `python run_agent.py --task "..."`.
   - **JSON Streaming**: Pass `--json` to stream real-time events (`start`, `step`, `finish`) directly into the RuXt Electron UI.
   - **IPC Bridge**: `bridge.py` for direct child process communication with RuXt's Node.js backend.

---

## Directory Structure

```
RuXt-AI-Vision-Desktop/
├── config.yaml               # Engine settings (providers, delays, grounding options)
├── requirements.txt          # Python dependencies
├── run_agent.py              # Main CLI execution entrypoint
├── ruxt_agent_s/
│   ├── __init__.py
│   ├── config.py             # Config & environment variables loader
│   ├── agent.py              # Autonomous Closed-Loop Vision Agent
│   ├── bridge.py             # JSON IPC bridge for RuXt Server
│   ├── core/
│   │   ├── __init__.py
│   │   ├── observation.py    # Desktop screen observer with WinStation binding
│   │   ├── actions.py        # PyAutoGUI & Win32 action primitives
│   │   ├── grounding.py      # Visual grounding & coordinate normalization
│   │   └── uia_grounding.py  # Windows UI Automation (UIA) tree search
│   └── llm/
│       ├── __init__.py
│       ├── client.py         # Multi-provider HTTP multimodal client
│       └── prompts.py        # Agent-S system and worker prompts
└── tests/
    ├── __init__.py
    └── test_agent.py         # Automated test suite
```

---

## Quick Start

### 1. Run via CLI
```bash
python run_agent.py --task "Open Notepad and type Welcome to RuXt"
```

### 2. Run with Specific Provider & Model
```bash
python run_agent.py --task "Open Chrome and search for RuXt AI" --provider openai --model gpt-4o --api-key "YOUR_KEY"
```

### 3. Stream JSON Output to RuXt UI
```bash
python run_agent.py --task "Open Calculator" --json
```

### 4. Run Automated Tests
```bash
python -m pytest tests/ -v
```
