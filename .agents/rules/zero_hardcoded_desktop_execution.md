---
description: Universal invariant forbidding pre-canned task templates or hardcoded files for desktop execution. All desktop automation must be dynamically generated on the fly by the AI engine based on user prompt.
always_on: true
---

# Rule: Zero-Hardcoded Dynamic Desktop Task Execution

When implementing or handling desktop application automation and user tasks:

1. **Strictly Prohibit Pre-Canned Task Templates**:
   - Never create static, hardcoded task scripts (e.g., hardcoded car generator, static drawing scripts, hardcoded notes).
   - Never restrict supported tasks to a pre-defined enumeration or hardcoded switch-cases.

2. **100% Dynamic On-The-Fly Generation**:
   - **Intent & Target Extraction**: Use the active AI model to parse the user's natural language prompt (English, Sinhala, Singlish, etc.) into:
     - Target Application (e.g., Blender, VS Code, Notepad, Excel, Chrome, Photoshop, Paint)
     - Core User Objective (e.g., "3D car animation", "solar system simulation", "daily agenda", "quarterly budget sheet")
     - Execution Strategy (Scriptable API vs. CLI process vs. GUI automation)
   - **Dynamic Script Synthesis**: The AI model writes the complete script specifically tailored to the user's prompt in real-time (e.g., dynamic Blender `bpy` Python script, dynamic PowerShell automation, dynamic workspace code).

3. **Dynamic Desktop Execution Pipeline**:
   - Save the dynamically generated script to a temporary run directory (`data/desktop_runs/<run_id>/`).
   - Execute the target application with the generated script/payload.
   - Capture live stdout, stderr, process exit code, and generated outputs.
   - Present live feedback and interactive preview cards to the user.

4. **Universal Fallback & Adaptability**:
   - If an application is not installed on the host, the generated assets and execution script must still be provided to the user with clear instructions, rather than failing silently or refusing to execute.
