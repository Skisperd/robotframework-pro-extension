"""
Enhanced Debug Listener for Robot Framework
Implements keyword-level debugging with breakpoints, stepping, and variable inspection.
Uses file-based communication for pause/resume mechanism.
"""
import json
import time
import os
import sys
from pathlib import Path
from typing import Dict, Set, Any, List, Optional


class DebugListener:
    """
    Debug listener with execution control capabilities.

    Communication Protocol:
    - Breakpoints: Read from .rf_debug_breakpoints.json
    - Pause: Create .rf_debug_pause file
    - Resume: Delete .rf_debug_pause file
    - Step: Read .rf_debug_step file (contains: 'over', 'into', 'out')
    - Variables: Write to .rf_debug_variables.json
    """

    ROBOT_LISTENER_API_VERSION = 2

    def __init__(self):
        # Communication file paths (from environment variables)
        self.pause_file = Path(os.environ.get('RF_DEBUG_PAUSE_FILE', '.rf_debug_pause'))
        self.breakpoint_file = Path(os.environ.get('RF_DEBUG_BP_FILE', '.rf_debug_breakpoints.json'))
        self.variable_file = Path(os.environ.get('RF_DEBUG_VAR_FILE', '.rf_debug_variables.json'))
        self.step_file = Path('.rf_debug_step')

        # Breakpoints: {file_path: {line_numbers}}
        self.breakpoints: Dict[str, Set[int]] = {}
        self._load_breakpoints()

        # Stepping state
        self.stepping_mode: Optional[str] = None  # 'over', 'into', 'out', None
        self.step_depth = 0
        self.current_depth = 0

        # Call stack for debugging
        self.keyword_stack: List[Dict[str, Any]] = []

        # Colors for console output
        self.colors_enabled = True
        self._setup_colors()

        self._log(f"{self.CYAN}{self.BOLD}=== Enhanced Debug Listener Started ==={self.RESET}")
        self._log(f"{self.GRAY}Breakpoint file: {self.breakpoint_file}{self.RESET}")
        self._log(f"{self.GRAY}Loaded {sum(len(lines) for lines in self.breakpoints.values())} breakpoint(s){self.RESET}")

    def _setup_colors(self):
        """Setup ANSI color codes"""
        if sys.platform == 'win32':
            try:
                import ctypes
                kernel32 = ctypes.windll.kernel32
                kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
            except Exception:
                pass

        self.RESET = '\033[0m' if self.colors_enabled else ''
        self.BOLD = '\033[1m' if self.colors_enabled else ''
        self.DIM = '\033[2m' if self.colors_enabled else ''
        self.RED = '\033[91m' if self.colors_enabled else ''
        self.GREEN = '\033[92m' if self.colors_enabled else ''
        self.YELLOW = '\033[93m' if self.colors_enabled else ''
        self.BLUE = '\033[94m' if self.colors_enabled else ''
        self.MAGENTA = '\033[95m' if self.colors_enabled else ''
        self.CYAN = '\033[96m' if self.colors_enabled else ''
        self.WHITE = '\033[97m' if self.colors_enabled else ''
        self.GRAY = '\033[90m' if self.colors_enabled else ''
        self.BG_RED = '\033[41m' if self.colors_enabled else ''

    def _log(self, message: str):
        """Output with flush for immediate display"""
        try:
            print(message, flush=True, file=sys.stderr)
        except UnicodeEncodeError:
            safe_msg = message.encode('ascii', 'replace').decode('ascii')
            print(safe_msg, flush=True, file=sys.stderr)

    def _load_breakpoints(self):
        """Load breakpoints from JSON file"""
        if not self.breakpoint_file.exists():
            return

        try:
            with open(self.breakpoint_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for source_path, lines in data.items():
                    # Normalize path separators
                    normalized_path = os.path.normpath(source_path)
                    self.breakpoints[normalized_path] = set(lines)
        except Exception as e:
            self._log(f"{self.RED}[DEBUG ERROR] Failed to load breakpoints: {e}{self.RESET}")

    def start_test(self, name: str, attributes: Dict[str, Any]):
        """Called when a test starts"""
        self._log(f"\n{self.MAGENTA}{self.BOLD}[TEST START]{self.RESET} {self.WHITE}{name}{self.RESET}")
        self.keyword_stack = []
        self.current_depth = 0

    def end_test(self, name: str, attributes: Dict[str, Any]):
        """Called when a test ends"""
        status = attributes.get('status', 'PASS')
        if status == 'PASS':
            self._log(f"{self.GREEN}{self.BOLD}[TEST PASS]{self.RESET} {name}")
        else:
            self._log(f"{self.RED}{self.BOLD}[TEST FAIL]{self.RESET} {name}")

    def start_keyword(self, name: str, attributes: Dict[str, Any]):
        """Called when a keyword starts - check for breakpoints and pause if needed"""
        self.current_depth += 1

        source = attributes.get('source', '')
        lineno = attributes.get('lineno', 0)
        args = attributes.get('args', [])

        # Push to stack
        keyword_frame = {
            'name': name,
            'kwname': attributes.get('kwname', name),
            'source': source,
            'lineno': lineno,
            'args': args,
            'depth': self.current_depth
        }
        self.keyword_stack.append(keyword_frame)

        # Log keyword execution
        display_name = attributes.get('kwname', name)
        args_str = ""
        if args:
            args_list = [str(a)[:30] for a in args[:3]]
            args_str = f" {self.GRAY}({', '.join(args_list)}{'...' if len(args) > 3 else ''}){self.RESET}"

        indent = "  " * (self.current_depth - 1)
        self._log(f"{indent}{self.BLUE}→{self.RESET} {display_name}{args_str} {self.GRAY}[{lineno}]{self.RESET}")

        # Check for breakpoint
        if source and lineno > 0:
            normalized_source = os.path.normpath(source)
            if normalized_source in self.breakpoints and lineno in self.breakpoints[normalized_source]:
                reason = f"Breakpoint hit: {os.path.basename(source)}:{lineno} in {display_name}"
                self._pause_execution(reason)
                return

        # Check for stepping
        if self.stepping_mode == 'over' and self.current_depth == self.step_depth:
            reason = f"Step over: {display_name}"
            self._pause_execution(reason)
            self.stepping_mode = None
        elif self.stepping_mode == 'into':
            reason = f"Step into: {display_name}"
            self._pause_execution(reason)
            self.stepping_mode = None

    def end_keyword(self, name: str, attributes: Dict[str, Any]):
        """Called when a keyword ends"""
        status = attributes.get('status', 'PASS')

        # Check step out
        if self.stepping_mode == 'out' and self.current_depth == self.step_depth:
            display_name = attributes.get('kwname', name)
            reason = f"Step out: {display_name}"
            self._pause_execution(reason)
            self.stepping_mode = None

        # Log failure
        if status == 'FAIL':
            message = attributes.get('message', '')
            display_name = attributes.get('kwname', name)
            indent = "  " * (self.current_depth - 1)
            self._log(f"{indent}{self.BG_RED}{self.WHITE}{self.BOLD} FAILED {self.RESET} {self.RED}{display_name}{self.RESET}")
            if message:
                self._log(f"{indent}  {self.RED}{message[:200]}{self.RESET}")

        # Pop from stack
        if self.keyword_stack:
            self.keyword_stack.pop()
        self.current_depth -= 1

    def _pause_execution(self, reason: str):
        """Pause execution and wait for user command"""
        self._log(f"\n{self.YELLOW}{self.BOLD}⏸  DEBUG PAUSE{self.RESET} {self.YELLOW}{reason}{self.RESET}\n")

        # Export current variables
        self._export_variables()

        # Create pause marker file
        try:
            self.pause_file.write_text(reason, encoding='utf-8')
        except Exception as e:
            self._log(f"{self.RED}[DEBUG ERROR] Failed to create pause file: {e}{self.RESET}")
            return

        # Poll for continue signal or step command
        poll_count = 0
        while self.pause_file.exists():
            time.sleep(0.1)
            poll_count += 1

            # Reload breakpoints periodically (user may have added/removed)
            if poll_count % 30 == 0:  # Every 3 seconds
                self._load_breakpoints()

            # Check for step command
            if self.step_file.exists():
                try:
                    command = self.step_file.read_text(encoding='utf-8').strip()
                    if command == 'over':
                        self.stepping_mode = 'over'
                        self.step_depth = self.current_depth
                        self._log(f"{self.CYAN}▶  Step Over{self.RESET}")
                    elif command == 'into':
                        self.stepping_mode = 'into'
                        self._log(f"{self.CYAN}▶  Step Into{self.RESET}")
                    elif command == 'out':
                        self.stepping_mode = 'out'
                        self.step_depth = self.current_depth - 1
                        self._log(f"{self.CYAN}▶  Step Out{self.RESET}")

                    self.step_file.unlink()
                    break
                except Exception as e:
                    self._log(f"{self.RED}[DEBUG ERROR] Failed to read step command: {e}{self.RESET}")

        # Resumed
        self._log(f"{self.GREEN}▶  Resumed{self.RESET}\n")

    def _export_variables(self):
        """Export current Robot Framework variables to JSON"""
        try:
            from robot.libraries.BuiltIn import BuiltIn
            bi = BuiltIn()

            variables = {
                'test': {},
                'suite': {},
                'global': {},
                'local': {}
            }

            # Get all variables from Robot Framework
            var_dict = bi.get_variables()

            for name, value in var_dict.items():
                # Categorize variables
                str_value = str(value)
                # Truncate very long values
                if len(str_value) > 500:
                    str_value = str_value[:497] + '...'

                if name.startswith('${TEST'):
                    variables['test'][name] = str_value
                elif name.startswith('${SUITE'):
                    variables['suite'][name] = str_value
                elif name.startswith('$'):
                    variables['local'][name] = str_value
                elif name.startswith('@'):
                    variables['local'][name] = str_value
                elif name.startswith('&'):
                    variables['local'][name] = str_value
                else:
                    variables['global'][name] = str_value

            # Write to file
            with open(self.variable_file, 'w', encoding='utf-8') as f:
                json.dump(variables, f, indent=2, ensure_ascii=False)

            self._log(f"{self.GRAY}Exported {sum(len(v) for v in variables.values())} variable(s){self.RESET}")

        except Exception as e:
            self._log(f"{self.RED}[DEBUG ERROR] Failed to export variables: {e}{self.RESET}")

    def log_message(self, message: Dict[str, Any]):
        """Called for log messages - show warnings and errors"""
        level = message.get('level', 'INFO') if isinstance(message, dict) else getattr(message, 'level', 'INFO')
        msg = message.get('message', '') if isinstance(message, dict) else getattr(message, 'message', '')

        if level == 'WARN':
            self._log(f"{self.YELLOW}[WARN]{self.RESET} {msg[:150]}")
        elif level == 'ERROR':
            self._log(f"{self.RED}[ERROR]{self.RESET} {msg[:150]}")
