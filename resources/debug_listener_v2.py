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
        # Draw test start box
        self._log("")
        self._log(f"{self.CYAN}{'╔' + '═' * 78 + '╗'}{self.RESET}")
        self._log(f"{self.CYAN}║{self.RESET} {self.MAGENTA}{self.BOLD}🧪 TEST START{self.RESET}")
        self._log(f"{self.CYAN}║{self.RESET} {self.WHITE}{self.BOLD}{name}{self.RESET}")

        # Show tags if present
        tags = attributes.get('tags', [])
        if tags:
            tags_str = ', '.join(tags[:5])
            if len(tags) > 5:
                tags_str += f" +{len(tags) - 5} more"
            self._log(f"{self.CYAN}║{self.RESET} {self.DIM}Tags: {tags_str}{self.RESET}")

        self._log(f"{self.CYAN}{'╚' + '═' * 78 + '╝'}{self.RESET}")
        self._log("")

        self.keyword_stack = []
        self.current_depth = 0

    def end_test(self, name: str, attributes: Dict[str, Any]):
        """Called when a test ends"""
        status = attributes.get('status', 'PASS')
        message = attributes.get('message', '')

        # Draw test result box
        self._log("")
        if status == 'PASS':
            self._log(f"{self.GREEN}{'╔' + '═' * 78 + '╗'}{self.RESET}")
            self._log(f"{self.GREEN}║{self.RESET} {self.GREEN}{self.BOLD}✓ TEST PASSED{self.RESET}")
            self._log(f"{self.GREEN}║{self.RESET} {self.WHITE}{name}{self.RESET}")
            self._log(f"{self.GREEN}{'╚' + '═' * 78 + '╝'}{self.RESET}")
        else:
            self._log(f"{self.RED}{'╔' + '═' * 78 + '╗'}{self.RESET}")
            self._log(f"{self.RED}║{self.RESET} {self.RED}{self.BOLD}✗ TEST FAILED{self.RESET}")
            self._log(f"{self.RED}║{self.RESET} {self.WHITE}{name}{self.RESET}")
            if message:
                # Show first line of error
                first_line = message.split('\n')[0][:70]
                self._log(f"{self.RED}║{self.RESET} {self.RED}{first_line}{self.RESET}")
            self._log(f"{self.RED}{'╚' + '═' * 78 + '╝'}{self.RESET}")
        self._log("")

    def start_keyword(self, name: str, attributes: Dict[str, Any]):
        """Called when a keyword starts - check for breakpoints and pause if needed"""
        self.current_depth += 1

        source = attributes.get('source', '')
        lineno = attributes.get('lineno', 0)
        args = attributes.get('args', [])
        kw_type = attributes.get('type', 'KEYWORD')

        # Push to stack
        keyword_frame = {
            'name': name,
            'kwname': attributes.get('kwname', name),
            'source': source,
            'lineno': lineno,
            'args': args,
            'depth': self.current_depth,
            'type': kw_type
        }
        self.keyword_stack.append(keyword_frame)

        # Log keyword execution with type-specific formatting
        display_name = attributes.get('kwname', name)
        indent = "  " * (self.current_depth - 1)

        # Choose icon and color based on keyword type
        if kw_type == 'SETUP':
            icon = "🔧"
            color = self.YELLOW
            type_label = f"{self.YELLOW}[SETUP]{self.RESET}"
        elif kw_type == 'TEARDOWN':
            icon = "🧹"
            color = self.YELLOW
            type_label = f"{self.YELLOW}[TEARDOWN]{self.RESET}"
        elif kw_type == 'FOR':
            icon = "🔄"
            color = self.CYAN
            type_label = f"{self.CYAN}[FOR]{self.RESET}"
        elif kw_type == 'FOR ITERATION':
            icon = "  ↻"
            color = self.CYAN
            type_label = f"{self.DIM}{self.CYAN}[ITER]{self.RESET}"
        elif kw_type == 'IF':
            icon = "❓"
            color = self.MAGENTA
            type_label = f"{self.MAGENTA}[IF]{self.RESET}"
        elif kw_type == 'ELSE IF':
            icon = "❔"
            color = self.MAGENTA
            type_label = f"{self.MAGENTA}[ELIF]{self.RESET}"
        elif kw_type == 'ELSE':
            icon = "❕"
            color = self.MAGENTA
            type_label = f"{self.MAGENTA}[ELSE]{self.RESET}"
        elif kw_type == 'TRY':
            icon = "🎯"
            color = self.BLUE
            type_label = f"{self.BLUE}[TRY]{self.RESET}"
        elif kw_type == 'EXCEPT':
            icon = "⚠️"
            color = self.YELLOW
            type_label = f"{self.YELLOW}[EXCEPT]{self.RESET}"
        elif kw_type == 'FINALLY':
            icon = "✓"
            color = self.BLUE
            type_label = f"{self.BLUE}[FINALLY]{self.RESET}"
        else:
            icon = "→"
            color = self.BLUE
            type_label = ""

        # Format arguments with type detection
        args_str = ""
        if args:
            formatted_args = []
            for arg in args[:4]:  # Show up to 4 args
                arg_str = str(arg)
                if len(arg_str) > 40:
                    arg_str = arg_str[:37] + "..."

                # Detect and color-code argument types
                if arg_str.startswith('${') or arg_str.startswith('@{') or arg_str.startswith('&{'):
                    # Variable
                    formatted_args.append(f"{self.GREEN}{arg_str}{self.RESET}")
                elif arg_str.isdigit() or (arg_str.replace('.', '').replace('-', '').isdigit()):
                    # Number
                    formatted_args.append(f"{self.CYAN}{arg_str}{self.RESET}")
                elif arg_str.lower() in ('true', 'false', 'none', 'null'):
                    # Boolean/None
                    formatted_args.append(f"{self.MAGENTA}{arg_str}{self.RESET}")
                else:
                    # String
                    formatted_args.append(f"{self.WHITE}{arg_str}{self.RESET}")

            if len(args) > 4:
                formatted_args.append(f"{self.DIM}+{len(args) - 4} more{self.RESET}")

            args_str = f" {self.GRAY}({self.RESET}{', '.join(formatted_args)}{self.GRAY}){self.RESET}"

        # Build the log line
        line_info = f"{self.DIM}:{lineno}{self.RESET}" if lineno > 0 else ""
        if type_label:
            self._log(f"{indent}{icon} {type_label} {color}{self.BOLD}{display_name}{self.RESET}{args_str}{line_info}")
        else:
            self._log(f"{indent}{icon} {color}{display_name}{self.RESET}{args_str}{line_info}")

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
        kw_type = attributes.get('type', 'KEYWORD')

        # Check step out
        if self.stepping_mode == 'out' and self.current_depth == self.step_depth:
            display_name = attributes.get('kwname', name)
            reason = f"Step out: {display_name}"
            self._pause_execution(reason)
            self.stepping_mode = None

        # Log keyword completion
        display_name = attributes.get('kwname', name)
        indent = "  " * (self.current_depth - 1)

        if status == 'FAIL':
            message = attributes.get('message', '')

            # Enhanced failure display with box
            self._log(f"{indent}{self.BG_RED}{self.WHITE}{self.BOLD} ✗ FAILED {self.RESET} {self.RED}{self.BOLD}{display_name}{self.RESET}")

            if message:
                # Clean and format error message
                lines = message.split('\n')
                clean_lines = []
                for line in lines[:5]:  # Show max 5 lines
                    line = line.strip()
                    if line and not line.startswith('0x') and not line.startswith('Stacktrace:'):
                        clean_lines.append(line)

                for line in clean_lines:
                    if len(line) > 100:
                        line = line[:97] + '...'
                    self._log(f"{indent}  {self.RED}│{self.RESET} {line}")

        elif status == 'PASS' and kw_type in ('SETUP', 'TEARDOWN', 'FOR', 'IF', 'TRY'):
            # Show completion for control structures
            self._log(f"{indent}{self.GREEN}✓{self.RESET} {self.DIM}{display_name} completed{self.RESET}")

        # Pop from stack
        if self.keyword_stack:
            self.keyword_stack.pop()
        self.current_depth -= 1

    def _pause_execution(self, reason: str):
        """Pause execution and wait for user command"""
        # Draw pause box
        self._log("")
        self._log(f"{self.YELLOW}{'═' * 60}{self.RESET}")
        self._log(f"{self.YELLOW}║{self.RESET} {self.YELLOW}{self.BOLD}⏸  EXECUTION PAUSED{self.RESET}")
        self._log(f"{self.YELLOW}║{self.RESET} {self.WHITE}{reason}{self.RESET}")
        self._log(f"{self.YELLOW}{'═' * 60}{self.RESET}")

        # Show current call stack
        if self.keyword_stack:
            self._log(f"{self.CYAN}📍 Call Stack:{self.RESET}")
            for i, frame in enumerate(self.keyword_stack[-3:]):  # Show last 3
                depth_marker = "  " * i
                self._log(f"  {depth_marker}→ {self.DIM}{frame['name']} ({frame.get('lineno', 0)}){self.RESET}")

        # Export current variables
        var_count = self._export_variables()
        if var_count > 0:
            self._log(f"{self.GREEN}✓{self.RESET} {self.DIM}Exported {var_count} variables{self.RESET}")

        self._log(f"{self.YELLOW}{'─' * 60}{self.RESET}")
        self._log(f"{self.DIM}Waiting for command (Continue/Step Over/Into/Out)...{self.RESET}")
        self._log("")

        # Create pause marker file
        try:
            self.pause_file.write_text(reason, encoding='utf-8')
        except Exception as e:
            self._log(f"{self.RED}[ERROR] Failed to create pause file: {e}{self.RESET}")
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
                        self._log(f"{self.CYAN}{self.BOLD}▶ Step Over{self.RESET} (depth={self.current_depth})")
                    elif command == 'into':
                        self.stepping_mode = 'into'
                        self._log(f"{self.CYAN}{self.BOLD}▶ Step Into{self.RESET}")
                    elif command == 'out':
                        self.stepping_mode = 'out'
                        self.step_depth = self.current_depth - 1
                        self._log(f"{self.CYAN}{self.BOLD}▶ Step Out{self.RESET} (to depth={self.current_depth - 1})")

                    self.step_file.unlink()
                    break
                except Exception as e:
                    self._log(f"{self.RED}[ERROR] Failed to read step command: {e}{self.RESET}")

        # Resumed
        self._log(f"{self.GREEN}{self.BOLD}▶ Execution Resumed{self.RESET}")
        self._log("")

    def _export_variables(self) -> int:
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

            return sum(len(v) for v in variables.values())

        except Exception as e:
            self._log(f"{self.RED}[ERROR] Failed to export variables: {e}{self.RESET}")
            return 0

    def log_message(self, message: Dict[str, Any]):
        """Called for log messages - show warnings and errors"""
        level = message.get('level', 'INFO') if isinstance(message, dict) else getattr(message, 'level', 'INFO')
        msg = message.get('message', '') if isinstance(message, dict) else getattr(message, 'message', '')

        if level == 'WARN':
            self._log(f"{self.YELLOW}[WARN]{self.RESET} {msg[:150]}")
        elif level == 'ERROR':
            self._log(f"{self.RED}[ERROR]{self.RESET} {msg[:150]}")
