/**
 * Failure Tree View for Robot Framework
 * Displays keyword call stacks in an interactive tree structure
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { StackFrame } from './stackTraceFormatter';

export class FailureTreeProvider implements vscode.TreeDataProvider<FailureTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<FailureTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private callStacks: Map<string, StackFrame[]> = new Map();

    /**
     * Update with new failure data
     * @param testName Name of the failed test
     * @param callStack Array of stack frames
     */
    public updateFailures(testName: string, callStack: StackFrame[]): void {
        this.callStacks.set(testName, callStack);
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Clear all failures
     */
    public clearFailures(): void {
        this.callStacks.clear();
        this._onDidChangeTreeData.fire(undefined);
    }

    /**
     * Check if there are any failures
     */
    public hasFailures(): boolean {
        return this.callStacks.size > 0;
    }

    getTreeItem(element: FailureTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FailureTreeItem): FailureTreeItem[] {
        if (!element) {
            // Root - show failed tests
            const items: FailureTreeItem[] = [];
            for (const [testName, callStack] of this.callStacks.entries()) {
                const item = new FailureTreeItem(
                    testName,
                    vscode.TreeItemCollapsibleState.Expanded,
                    testName,
                    callStack,
                    undefined,
                    0
                );
                items.push(item);
            }
            return items;
        } else {
            // Show children at next depth level
            const children: FailureTreeItem[] = [];
            const nextDepth = element.depth + 1;

            // Filter stack frames for next depth
            const childFrames = element.callStack.filter(f => f.depth === nextDepth);

            for (const frame of childFrames) {
                const hasChildren = element.callStack.some(f => f.depth === nextDepth + 1);
                const item = new FailureTreeItem(
                    frame.kwname || frame.name,
                    hasChildren ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
                    element.testName,
                    element.callStack,
                    frame,
                    nextDepth
                );
                children.push(item);
            }

            return children;
        }
    }
}

export class FailureTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly testName: string,
        public readonly callStack: StackFrame[],
        public readonly frame?: StackFrame,
        public readonly depth: number = 0
    ) {
        super(label, collapsibleState);

        if (frame) {
            // Keyword item
            this.tooltip = this.buildTooltip(frame);
            this.description = this.buildDescription(frame);
            this.contextValue = frame.is_failure_point ? 'failurePoint' : 'keyword';

            // Icon
            if (frame.is_failure_point) {
                this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
            } else {
                this.iconPath = new vscode.ThemeIcon('arrow-right', new vscode.ThemeColor('testing.iconQueued'));
            }

            // Navigate to source on click
            if (frame.source && frame.lineno > 0) {
                this.command = {
                    command: 'vscode.open',
                    title: 'Go to Line',
                    arguments: [
                        vscode.Uri.file(frame.source),
                        {
                            selection: new vscode.Range(
                                frame.lineno - 1,
                                0,
                                frame.lineno - 1,
                                100
                            ),
                            preview: false
                        }
                    ]
                };
            }
        } else {
            // Test item (root)
            this.tooltip = `Failed test: ${testName}`;
            this.description = `${callStack.length} frame${callStack.length > 1 ? 's' : ''}`;
            this.contextValue = 'failedTest';
            this.iconPath = new vscode.ThemeIcon('beaker', new vscode.ThemeColor('testing.iconFailed'));
        }
    }

    private buildDescription(frame: StackFrame): string {
        const parts: string[] = [];

        // Line number
        parts.push(`Line ${frame.lineno}`);

        // Status
        if (frame.is_failure_point) {
            parts.push('FAILED');
        }

        // Library name if available
        if (frame.libname && frame.libname !== 'BuiltIn') {
            parts.push(`[${frame.libname}]`);
        }

        return parts.join(' - ');
    }

    private buildTooltip(frame: StackFrame): string {
        const lines: string[] = [];

        // Keyword name
        lines.push(`Keyword: ${frame.kwname || frame.name}`);

        // Location
        if (frame.source) {
            const fileName = path.basename(frame.source);
            lines.push(`File: ${fileName}:${frame.lineno}`);
        }

        // Arguments
        if (frame.args && frame.args.length > 0) {
            lines.push(`Arguments:`);
            for (let i = 0; i < Math.min(frame.args.length, 5); i++) {
                const arg = frame.args[i];
                const truncated = String(arg).length > 100 ? String(arg).substring(0, 97) + '...' : arg;
                lines.push(`  ${i + 1}. ${truncated}`);
            }
            if (frame.args.length > 5) {
                lines.push(`  ... and ${frame.args.length - 5} more`);
            }
        }

        // Error message
        if (frame.is_failure_point && frame.message) {
            lines.push('');
            lines.push('Error Message:');
            lines.push(frame.message);
        }

        return lines.join('\n');
    }
}
