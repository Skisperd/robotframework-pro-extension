"""
Robot Framework Debug Listener
Shows keyword execution in real-time for debugging with colored output
Compatible with Robot Framework 7.x
"""
import sys
import os

# ANSI Color codes for terminal output
class Colors:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    
    # Foreground colors
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    GRAY = '\033[90m'
    
    # Background colors
    BG_RED = '\033[41m'
    BG_GREEN = '\033[42m'


class DebugListener:
    ROBOT_LISTENER_API_VERSION = 2
    
    # Keywords to hide (internal Robot Framework keywords)
    HIDDEN_KEYWORDS = {
        'BuiltIn.Log', 'BuiltIn.Log Many', 'BuiltIn.Set Variable',
        'BuiltIn.Set Test Variable', 'BuiltIn.Set Suite Variable',
        'BuiltIn.Set Global Variable', 'BuiltIn.Convert To Integer',
        'BuiltIn.Convert To String', 'BuiltIn.Convert To Number',
        'BuiltIn.Catenate', 'BuiltIn.Get Variable Value',
        'BuiltIn.Variable Should Exist', 'BuiltIn.Get Time',
        'BuiltIn.Evaluate', 'BuiltIn.Return From Keyword',
        'BuiltIn.Run Keyword If', 'BuiltIn.Run Keyword',
        'BuiltIn.No Operation', 'BuiltIn.Comment', 'BuiltIn.Sleep',
        'String.Convert To Upper Case', 'String.Convert To Lower Case',
        'Collections.Get From List', 'Collections.Get From Dictionary',
    }
    
    # Only show keywords up to this depth (0 = test level, 1 = first keyword, etc.)
    MAX_DEPTH = 2
    
    def __init__(self):
        self.indent = 0
        self.keyword_depth = 0
        self.failed_keywords = []
        self.skipped_count = 0
        # Test results tracking
        self.test_results = []  # List of (name, status, message, duration)
        self.suite_name = ""
        self.current_test_start = None
        # Enable ANSI colors on Windows
        if sys.platform == 'win32':
            try:
                import ctypes
                kernel32 = ctypes.windll.kernel32
                kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
            except Exception:
                pass
            try:
                import codecs
                sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'replace')
            except Exception:
                pass
        self._log(f"{Colors.CYAN}{Colors.BOLD}=== Debug Listener Started ==={Colors.RESET}")
    
    def _log(self, message):
        """Output with flush for immediate display"""
        indent_str = "  " * self.indent
        try:
            print(f"{indent_str}{message}", flush=True)
        except UnicodeEncodeError:
            safe_msg = message.encode('ascii', 'replace').decode('ascii')
            print(f"{indent_str}{safe_msg}", flush=True)
    
    def start_suite(self, name, attrs):
        self.suite_name = name
        self.test_results = []  # Reset for each top-level suite
        self._log(f"{Colors.BLUE}{Colors.BOLD}[SUITE]{Colors.RESET} {Colors.WHITE}{name}{Colors.RESET}")
        self.indent += 1
    
    def end_suite(self, name, attrs):
        self.indent -= 1
        status = attrs.get('status', 'PASS')
        if status == 'PASS':
            self._log(f"{Colors.GREEN}{Colors.BOLD}[SUITE PASS]{Colors.RESET} {name}")
        else:
            self._log(f"{Colors.RED}{Colors.BOLD}[SUITE FAIL]{Colors.RESET} {name}")
        
        # Print summary at the end of the top-level suite
        if self.indent == 0 and self.test_results:
            self._print_summary()
    
    def _print_summary(self):
        """Print a summary of all test results"""
        passed = [t for t in self.test_results if t[1] == 'PASS']
        failed = [t for t in self.test_results if t[1] == 'FAIL']
        
        print("\n", flush=True)
        print(f"{Colors.CYAN}{Colors.BOLD}{'='*80}{Colors.RESET}", flush=True)
        print(f"{Colors.CYAN}{Colors.BOLD}  TEST EXECUTION SUMMARY{Colors.RESET}", flush=True)
        print(f"{Colors.CYAN}{Colors.BOLD}{'='*80}{Colors.RESET}", flush=True)
        
        # List all tests
        print(f"\n{Colors.WHITE}{Colors.BOLD}All Tests ({len(self.test_results)}):{Colors.RESET}", flush=True)
        for test_name, status, message, duration in self.test_results:
            if status == 'PASS':
                icon = f"{Colors.GREEN}[PASS]{Colors.RESET}"
            else:
                icon = f"{Colors.RED}[FAIL]{Colors.RESET}"
            duration_str = f" ({duration})" if duration else ""
            print(f"  {icon} {test_name}{Colors.GRAY}{duration_str}{Colors.RESET}", flush=True)
        
        # Summary counts
        print(f"\n{Colors.WHITE}{Colors.BOLD}Results:{Colors.RESET}", flush=True)
        print(f"  {Colors.GREEN}Passed: {len(passed)}{Colors.RESET}", flush=True)
        print(f"  {Colors.RED}Failed: {len(failed)}{Colors.RESET}", flush=True)
        
        # Failed test details
        if failed:
            print(f"\n{Colors.RED}{Colors.BOLD}{'='*80}{Colors.RESET}", flush=True)
            print(f"{Colors.RED}{Colors.BOLD}  FAILURE DETAILS{Colors.RESET}", flush=True)
            print(f"{Colors.RED}{Colors.BOLD}{'='*80}{Colors.RESET}", flush=True)
            
            for i, (test_name, status, message, duration) in enumerate(failed, 1):
                print(f"\n{Colors.RED}{Colors.BOLD}{i}. {test_name}{Colors.RESET}", flush=True)
                if message:
                    # Format error message with line breaks for readability
                    error_lines = message.split('\n')
                    for line in error_lines[:5]:  # Limit to first 5 lines
                        print(f"   {Colors.YELLOW}{line[:200]}{Colors.RESET}", flush=True)
                    if len(error_lines) > 5:
                        print(f"   {Colors.GRAY}... ({len(error_lines) - 5} more lines){Colors.RESET}", flush=True)
        
        print(f"\n{Colors.CYAN}{'='*80}{Colors.RESET}\n", flush=True)
    
    def start_test(self, name, attrs):
        import time
        self.current_test_start = time.time()
        self._log(f"{Colors.MAGENTA}{Colors.BOLD}[TEST]{Colors.RESET} {Colors.WHITE}{name}{Colors.RESET}")
        self.indent += 1
        self.failed_keywords = []
        self.keyword_depth = 0
        self.skipped_count = 0
    
    def end_test(self, name, attrs):
        import time
        self.indent -= 1
        status = attrs.get('status', 'PASS')
        message = attrs.get('message', '')
        
        # Calculate duration
        duration = ""
        if self.current_test_start:
            elapsed = time.time() - self.current_test_start
            if elapsed >= 60:
                duration = f"{int(elapsed // 60)}m {int(elapsed % 60)}s"
            else:
                duration = f"{elapsed:.1f}s"
        
        # Store test result
        self.test_results.append((name, status, message, duration))
        
        if status == 'PASS':
            self._log(f"{Colors.GREEN}{Colors.BOLD}[PASS]{Colors.RESET} {name} {Colors.GRAY}({duration}){Colors.RESET}")
        else:
            self._log(f"{Colors.RED}{Colors.BOLD}[FAIL]{Colors.RESET} {name} {Colors.GRAY}({duration}){Colors.RESET}")
            if message:
                self._log(f"{Colors.RED}       Error: {message[:300]}{Colors.RESET}")
    
    def start_keyword(self, name, attrs):
        kw_type = attrs.get('type', 'KEYWORD')
        args = attrs.get('args', [])
        
        self.keyword_depth += 1
        
        # Skip internal keywords when too deep
        is_hidden = name in self.HIDDEN_KEYWORDS
        is_too_deep = self.keyword_depth > self.MAX_DEPTH
        
        # Always show control structures and SETUP/TEARDOWN
        is_control = kw_type in ('FOR', 'ITERATION', 'FOR ITERATION', 'IF', 'ELSE IF', 'ELSE', 'TRY', 'EXCEPT', 'FINALLY', 'SETUP', 'TEARDOWN')
        
        if is_hidden or (is_too_deep and not is_control):
            self.skipped_count += 1
            return
        
        args_str = ""
        if args:
            args_list = [str(a)[:50] for a in args[:4]]
            args_str = f" {Colors.GRAY}({', '.join(args_list)}{'...' if len(args) > 4 else ''}){Colors.RESET}"
        
        if kw_type == 'SETUP':
            self._log(f"{Colors.YELLOW}[SETUP]{Colors.RESET} {name}{args_str}")
            self.indent += 1
        elif kw_type == 'TEARDOWN':
            self._log(f"{Colors.YELLOW}[TEARDOWN]{Colors.RESET} {name}{args_str}")
            self.indent += 1
        elif kw_type in ('FOR', 'ITERATION', 'FOR ITERATION'):
            self._log(f"{Colors.CYAN}[{kw_type}]{Colors.RESET} {Colors.DIM}{name}{Colors.RESET}")
            self.indent += 1
        elif kw_type in ('IF', 'ELSE IF', 'ELSE'):
            self._log(f"{Colors.CYAN}[{kw_type}]{Colors.RESET} {Colors.DIM}{name}{Colors.RESET}")
            self.indent += 1
        elif kw_type in ('TRY', 'EXCEPT', 'FINALLY'):
            self._log(f"{Colors.CYAN}[{kw_type}]{Colors.RESET} {Colors.DIM}{name}{Colors.RESET}")
            self.indent += 1
        else:
            # Regular keyword - show with arrow, remove library prefix for cleaner output
            display_name = name.split('.')[-1] if '.' in name and name.startswith(('BuiltIn.', 'String.', 'Collections.', 'OperatingSystem.')) else name
            self._log(f"{Colors.WHITE}>> {display_name}{Colors.RESET}{args_str}")
            self.indent += 1
    
    def end_keyword(self, name, attrs):
        kw_type = attrs.get('type', 'KEYWORD')
        
        # Check if this keyword was skipped
        is_hidden = name in self.HIDDEN_KEYWORDS
        is_too_deep = self.keyword_depth > self.MAX_DEPTH
        is_control = kw_type in ('FOR', 'ITERATION', 'FOR ITERATION', 'IF', 'ELSE IF', 'ELSE', 'TRY', 'EXCEPT', 'FINALLY', 'SETUP', 'TEARDOWN')
        
        was_shown = not is_hidden and (not is_too_deep or is_control)
        
        self.keyword_depth -= 1
        
        if was_shown:
            self.indent -= 1
        
        status = attrs.get('status', 'PASS')
        if status == 'FAIL':
            message = attrs.get('message', '')
            display_name = name.split('.')[-1] if '.' in name and name.startswith(('BuiltIn.', 'String.', 'Collections.')) else name
            self._log(f"{Colors.BG_RED}{Colors.WHITE}{Colors.BOLD} FAILED {Colors.RESET} {Colors.RED}{display_name}{Colors.RESET}")
            if message:
                self._log(f"{Colors.RED}         {message[:250]}{Colors.RESET}")
    
    def log_message(self, message):
        # Only show WARN and ERROR messages, skip INFO/DEBUG for cleaner output
        level = message.get('level', 'INFO') if isinstance(message, dict) else getattr(message, 'level', 'INFO')
        msg = message.get('message', '') if isinstance(message, dict) else getattr(message, 'message', '')
        
        if level == 'WARN':
            self._log(f"{Colors.YELLOW}[WARN]{Colors.RESET} {msg[:150]}")
        elif level == 'ERROR':
            self._log(f"{Colors.RED}[ERROR]{Colors.RESET} {msg[:150]}")
        # Skip INFO, DEBUG, TRACE for cleaner output

