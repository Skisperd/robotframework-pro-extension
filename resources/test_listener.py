"""
Robot Framework Listener for capturing test execution details.
This listener captures failed keywords with their line numbers for better error reporting.
"""
import json
import sys
from typing import Any, Dict, List, Optional


class test_listener:
    """Listener that captures test execution details including failed keyword line numbers."""
    
    ROBOT_LISTENER_API_VERSION = 2
    
    def __init__(self, output_path: str = "listener_output.json"):
        self._output_path = output_path
        self.failed_keywords: List[Dict[str, Any]] = []
        self.last_fail_message: Optional[str] = None
        self.test_results: Dict[str, Any] = {}
        self.current_test: Optional[str] = None

        # NEW: Manual call stack tracking for nested keyword failures
        self._keyword_stack: List[Dict[str, Any]] = []
        self._current_depth = 0
        self.call_stacks: Dict[str, List[Dict[str, Any]]] = {}
    
    def start_test(self, name: str, attributes: Dict[str, Any]) -> None:
        """Called when a test case starts."""
        self.current_test = name
        self.failed_keywords = []
        self.last_fail_message = None
        # Reset call stack for new test
        self._keyword_stack = []
        self._current_depth = 0
    
    def end_test(self, name: str, attributes: Dict[str, Any]) -> None:
        """Called when a test case ends."""
        status = attributes.get("status", "FAIL")
        message = attributes.get("message", "")

        # Store test result with failed keywords info
        test_result = {
            "name": name,
            "status": status,
            "message": message,
            "longname": attributes.get("longname", ""),
            "starttime": attributes.get("starttime", ""),
            "endtime": attributes.get("endtime", ""),
            "source": attributes.get("source", ""),
            "lineno": attributes.get("lineno", 0),
            "failed_keywords": self.failed_keywords.copy()
        }

        # NEW: Link to call stack if failure occurred
        if status == "FAIL" and self.failed_keywords:
            # Link to the first (and likely only) call stack for this test
            stack_key = f"{name}_0"
            if stack_key in self.call_stacks:
                test_result["stack_trace_key"] = stack_key

        self.test_results[name] = test_result

        self.current_test = None
        self.failed_keywords = []
    
    def log_message(self, message: Dict[str, Any]) -> None:
        """Called when a log message is generated."""
        level = message.get("level", "")
        if level == "FAIL":
            self.last_fail_message = message.get("message", "")

    def start_keyword(self, name: str, attributes: Dict[str, Any]) -> None:
        """Called when a keyword starts. Tracks call stack for nested failures."""
        self._current_depth += 1

        # Push keyword onto call stack
        keyword_frame = {
            "name": name,
            "kwname": attributes.get("kwname", name),
            "libname": attributes.get("libname", ""),
            "source": attributes.get("source", ""),
            "lineno": attributes.get("lineno", 0),
            "args": list(attributes.get("args", [])),
            "depth": self._current_depth,
            "type": attributes.get("type", "KEYWORD")
        }
        self._keyword_stack.append(keyword_frame)
    
    def end_keyword(self, name: str, attributes: Dict[str, Any]) -> None:
        """Called when a keyword ends. Captures failed keywords with full call stack."""
        status = attributes.get("status", "")
        source = attributes.get("source", "")

        if status == "FAIL" and source:
            # OLD FORMAT: Maintain backward compatibility
            keyword_info = {
                "name": name,
                "kwname": attributes.get("kwname", name),
                "libname": attributes.get("libname", ""),
                "source": source,
                "lineno": attributes.get("lineno", 0),
                "status": status,
                "message": self.last_fail_message or "",
                "args": list(attributes.get("args", [])),
                "type": attributes.get("type", "KEYWORD")
            }
            # Append (deepest last) instead of insert(0)
            self.failed_keywords.append(keyword_info)

            # NEW FORMAT: Capture full call stack with failure point
            if self.current_test:
                # Copy current stack + add failure point
                call_stack = self._keyword_stack.copy()

                # Mark the failing keyword
                failure_point = {
                    "name": name,
                    "kwname": attributes.get("kwname", name),
                    "libname": attributes.get("libname", ""),
                    "source": source,
                    "lineno": attributes.get("lineno", 0),
                    "args": list(attributes.get("args", [])),
                    "depth": self._current_depth,
                    "type": attributes.get("type", "KEYWORD"),
                    "is_failure_point": True,
                    "message": self.last_fail_message or attributes.get("message", ""),
                    "status": "FAIL"
                }
                call_stack.append(failure_point)

                # Store in call_stacks dict with unique key
                stack_key = f"{self.current_test}_{len(self.call_stacks)}"
                self.call_stacks[stack_key] = call_stack

        # Pop from stack (whether PASS or FAIL)
        if self._keyword_stack:
            self._keyword_stack.pop()
        self._current_depth -= 1
    
    def close(self) -> None:
        """Called when the test execution ends. Writes results to file."""
        if self._output_path:
            try:
                # Enhanced output with version and call stacks
                output = {
                    "version": 2,
                    "test_results": self.test_results,
                    "call_stacks": self.call_stacks
                }

                with open(self._output_path, "w", encoding="utf-8") as f:
                    json.dump(output, f, indent=2, ensure_ascii=False)
            except Exception as e:
                print(f"Error writing listener output: {e}", file=sys.stderr)


# Allow running as script for testing
if __name__ == "__main__":
    print("TestListener for Robot Framework Pro")
    print("Usage: robot --listener test_listener.py:output.json test.robot")
