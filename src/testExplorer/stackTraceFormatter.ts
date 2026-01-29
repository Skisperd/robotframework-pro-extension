/**
 * Stack Trace Formatter for Robot Framework keyword failures
 * Formats call stacks in Python-style traceback format
 */

import * as path from 'path';

export interface StackFrame {
    name: string;
    kwname?: string;
    libname?: string;
    source: string;
    lineno: number;
    depth: number;
    args?: string[];
    message?: string;
    is_failure_point?: boolean;
    status?: string;
    type?: string;
}

export class StackTraceFormatter {
    /**
     * Format call stack as clean traceback for Test Results panel
     * @param callStack Array of stack frames from listener
     * @returns Formatted stack trace string
     */
    public static formatStackTrace(callStack: StackFrame[]): string {
        if (!callStack || callStack.length === 0) {
            return 'No stack trace available';
        }

        const lines: string[] = [];

        // Sort by depth (shallowest first, deepest last)
        const sortedStack = [...callStack].sort((a, b) => a.depth - b.depth);

        // Clean format - one line per frame, minimal indentation
        for (const frame of sortedStack) {
            // Skip frames without source (library keywords without line info)
            if (!frame.source || frame.lineno === 0) {
                continue;
            }

            const fileName = path.basename(frame.source);
            const displayName = frame.kwname || frame.name;

            if (frame.is_failure_point) {
                // Failure point - highlight with [FAILED]
                lines.push(`→ ${displayName} (${fileName}:${frame.lineno}) [FAILED]`);

                // Show clean error message on next line
                if (frame.message) {
                    const cleanMessage = this._cleanErrorMessage(frame.message);
                    lines.push(`  Error: ${cleanMessage}`);
                }
            } else {
                // Parent call - just name and location
                lines.push(`→ ${displayName} (${fileName}:${frame.lineno})`);
            }
        }

        return lines.join('\n');
    }

    /**
     * Clean error message by removing stacktraces and limiting length
     */
    private static _cleanErrorMessage(message: string): string {
        // Remove Selenium/WebDriver stacktraces (lines starting with 0x or indented hex)
        const lines = message.split('\n');
        const cleanLines: string[] = [];

        for (const line of lines) {
            // Stop at stacktrace markers
            if (line.trim().startsWith('Stacktrace:') ||
                line.trim().startsWith('0x') ||
                line.match(/^\s+0x[0-9a-fA-F]+/)) {
                break;
            }
            // Skip empty lines
            if (line.trim()) {
                cleanLines.push(line.trim());
            }
        }

        // Join and truncate
        let cleaned = cleanLines.join(' ');

        // Limit to 300 characters
        if (cleaned.length > 300) {
            cleaned = cleaned.substring(0, 297) + '...';
        }

        return cleaned;
    }

    /**
     * Format a compact single-line stack trace for quick viewing
     * @param callStack Array of stack frames
     * @returns Compact format like "Test → Keyword A → Keyword B (line 30) [FAILED]"
     */
    public static formatCompactStackTrace(callStack: StackFrame[]): string {
        if (!callStack || callStack.length === 0) {
            return '';
        }

        const sortedStack = [...callStack].sort((a, b) => a.depth - b.depth);
        const parts: string[] = [];

        for (const frame of sortedStack) {
            if (!frame.source) continue;

            const displayName = frame.kwname || frame.name;
            if (frame.is_failure_point) {
                parts.push(`${displayName} (line ${frame.lineno}) [FAILED]`);
            } else {
                parts.push(displayName);
            }
        }

        return parts.join(' → ');
    }

    /**
     * Get the deepest (actual) failure point from a call stack
     * @param callStack Array of stack frames
     * @returns The stack frame marked as failure point, or the deepest frame
     */
    public static getFailurePoint(callStack: StackFrame[]): StackFrame | null {
        if (!callStack || callStack.length === 0) {
            return null;
        }

        // Find frame marked as failure point
        const failurePoint = callStack.find(f => f.is_failure_point);
        if (failurePoint) {
            return failurePoint;
        }

        // Fallback: return deepest frame
        const sorted = [...callStack].sort((a, b) => b.depth - a.depth);
        return sorted[0];
    }

    /**
     * Extract all unique file paths from stack trace
     * @param callStack Array of stack frames
     * @returns Array of unique source file paths
     */
    public static getInvolvedFiles(callStack: StackFrame[]): string[] {
        if (!callStack) {
            return [];
        }

        const files = callStack
            .filter(f => f.source)
            .map(f => f.source);

        return Array.from(new Set(files));
    }
}
