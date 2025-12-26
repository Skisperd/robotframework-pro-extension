import * as vscode from 'vscode';

export interface KeywordDefinition {
    name: string;
    documentation: string;
    arguments: ArgumentInfo[];
    location: vscode.Location;
    type: 'user' | 'library' | 'builtin';
    library?: string;
    source: string; // File path or library name
}

export interface ArgumentInfo {
    name: string;
    defaultValue?: string;
    isOptional: boolean;
}

export interface VariableDefinition {
    name: string;
    value?: string;
    location: vscode.Location;
    scope: 'suite' | 'test' | 'keyword' | 'global';
}

export interface TestCaseDefinition {
    name: string;
    documentation: string;
    location: vscode.Location;
    tags: string[];
}

export class KeywordIndexer {
    private keywords: Map<string, KeywordDefinition[]> = new Map();
    private variables: Map<string, VariableDefinition[]> = new Map();
    private testCases: Map<string, TestCaseDefinition[]> = new Map();
    private builtinKeywords: Map<string, KeywordDefinition> = new Map();

    constructor() {
        this.initializeBuiltinKeywords();
    }

    private initializeBuiltinKeywords(): void {
        const builtins: Array<{name: string, args: string[], doc: string, library?: string}> = [
            // BuiltIn Library - Core Keywords
            { name: 'Log', args: ['message', 'level=INFO', 'html=False', 'console=False', 'repr=False'], doc: 'Logs the given message with the given level' },
            { name: 'Log Many', args: ['*messages'], doc: 'Logs the given messages as separate entries using the INFO level' },
            { name: 'Log To Console', args: ['message', 'stream=STDOUT', 'no_newline=False'], doc: 'Logs the given message to the console' },
            { name: 'Log Variables', args: ['level=INFO'], doc: 'Logs all variables in the current scope with given log level' },
            { name: 'Should Be Equal', args: ['first', 'second', 'msg=None', 'values=True', 'ignore_case=False', 'formatter=str', 'strip_spaces=False', 'collapse_spaces=False'], doc: 'Fails if the given objects are unequal' },
            { name: 'Should Contain', args: ['container', 'item', 'msg=None', 'values=True', 'ignore_case=False', 'strip_spaces=False', 'collapse_spaces=False'], doc: 'Fails if container does not contain item' },
            { name: 'Should Be True', args: ['condition', 'msg=None'], doc: 'Fails if the given condition is not true' },
            { name: 'Should Not Be Equal', args: ['first', 'second', 'msg=None', 'values=True', 'ignore_case=False'], doc: 'Fails if the given objects are equal' },
            { name: 'Should Not Contain', args: ['container', 'item', 'msg=None', 'values=True', 'ignore_case=False'], doc: 'Fails if container contains item' },
            { name: 'Should Be Empty', args: ['item', 'msg=None'], doc: 'Verifies that the given item is empty' },
            { name: 'Should Not Be Empty', args: ['item', 'msg=None'], doc: 'Verifies that the given item is not empty' },
            { name: 'Should Match', args: ['string', 'pattern', 'msg=None', 'values=True', 'ignore_case=False'], doc: 'Fails if the given string does not match pattern' },
            { name: 'Should Match Regexp', args: ['string', 'pattern', 'msg=None', 'values=True'], doc: 'Fails if string does not match pattern as a regular expression' },
            { name: 'Should Start With', args: ['str1', 'str2', 'msg=None', 'values=True', 'ignore_case=False', 'strip_spaces=False', 'collapse_spaces=False'], doc: 'Fails if the string str1 does not start with string str2' },
            { name: 'Should End With', args: ['str1', 'str2', 'msg=None', 'values=True', 'ignore_case=False', 'strip_spaces=False', 'collapse_spaces=False'], doc: 'Fails if the string str1 does not end with string str2' },
            { name: 'Set Variable', args: ['*values'], doc: 'Returns the given values which can then be assigned to a variables' },
            { name: 'Set Test Variable', args: ['name', '*values'], doc: 'Makes a variable available everywhere within the scope of the current test' },
            { name: 'Set Suite Variable', args: ['name', '*values'], doc: 'Makes a variable available everywhere within the scope of the current suite' },
            { name: 'Set Global Variable', args: ['name', '*values'], doc: 'Makes a variable available globally in all tests and suites' },
            { name: 'Set Local Variable', args: ['name', '*values'], doc: 'Makes a variable available in the current local scope' },
            { name: 'Get Variable Value', args: ['name', 'default=None'], doc: 'Returns variable value or default if variable does not exist' },
            { name: 'Variable Should Exist', args: ['name', 'msg=None'], doc: 'Fails unless the given variable exists within the current scope' },
            { name: 'Variable Should Not Exist', args: ['name', 'msg=None'], doc: 'Fails if the given variable exists within the current scope' },
            { name: 'Get Length', args: ['item'], doc: 'Returns the length of the given item' },
            { name: 'Get Time', args: ['format=timestamp', 'time_=NOW'], doc: 'Returns the given time in the requested format' },
            { name: 'Sleep', args: ['time', 'reason=None'], doc: 'Pauses the test execution for the given time' },
            { name: 'Wait Until Keyword Succeeds', args: ['retry', 'retry_interval', 'name', '*args'], doc: 'Runs the specified keyword and retries if it fails' },
            { name: 'Run Keyword', args: ['name', '*args'], doc: 'Executes the given keyword with the given arguments' },
            { name: 'Run Keyword If', args: ['condition', 'name', '*args'], doc: 'Runs the given keyword with the given arguments, if condition is true' },
            { name: 'Run Keyword Unless', args: ['condition', 'name', '*args'], doc: 'Runs the given keyword with the given arguments if condition is false' },
            { name: 'Run Keywords', args: ['*keywords'], doc: 'Executes all the given keywords in a sequence' },
            { name: 'Run Keyword And Return', args: ['name', '*args'], doc: 'Runs the specified keyword and returns from the enclosing user keyword' },
            { name: 'Run Keyword And Return Status', args: ['name', '*args'], doc: 'Runs the given keyword with given arguments and returns the status as a Boolean' },
            { name: 'Run Keyword And Ignore Error', args: ['name', '*args'], doc: 'Runs the given keyword with the given arguments and ignores possible error' },
            { name: 'Run Keyword And Continue On Failure', args: ['name', '*args'], doc: 'Runs the keyword and continues execution even if it fails' },
            { name: 'Run Keyword And Expect Error', args: ['expected_error', 'name', '*args'], doc: 'Runs the keyword and checks that the expected error occurred' },
            { name: 'Run Keyword And Warn On Failure', args: ['name', '*args'], doc: 'Runs the keyword and warns if it fails' },
            { name: 'Run Keyword If All Tests Passed', args: ['name', '*args'], doc: 'Runs the given keyword with given arguments, if all tests passed' },
            { name: 'Run Keyword If Any Tests Failed', args: ['name', '*args'], doc: 'Runs the given keyword with given arguments, if any test failed' },
            { name: 'Run Keyword If Test Failed', args: ['name', '*args'], doc: 'Runs the given keyword if the test failed' },
            { name: 'Run Keyword If Test Passed', args: ['name', '*args'], doc: 'Runs the given keyword if the test passed' },
            { name: 'Run Keyword If Timeout Occurred', args: ['name', '*args'], doc: 'Runs the keyword if timeout occurred in test teardown' },
            { name: 'Repeat Keyword', args: ['repeat', 'name', '*args'], doc: 'Executes the specified keyword multiple times' },
            { name: 'Fail', args: ['msg=None', '*tags'], doc: 'Fails the test immediately with the given message' },
            { name: 'Fatal Error', args: ['msg=None'], doc: 'Stops the whole test execution' },
            { name: 'Pass Execution', args: ['message', '*tags'], doc: 'Skips rest of the current test and sets its status to PASS' },
            { name: 'Pass Execution If', args: ['condition', 'message', '*tags'], doc: 'Conditionally skips rest of the test and sets status to PASS' },
            { name: 'Skip', args: ['msg=Skipped'], doc: 'Skips the rest of the current test' },
            { name: 'Skip If', args: ['condition', 'msg=None'], doc: 'Conditionally skips rest of the current test' },
            { name: 'Return From Keyword', args: ['*return_values'], doc: 'Returns from the enclosing user keyword' },
            { name: 'Return From Keyword If', args: ['condition', '*return_values'], doc: 'Conditionally returns from the enclosing user keyword' },
            { name: 'Import Library', args: ['name', '*args', 'WITH NAME=None'], doc: 'Imports a library with the given name and optional arguments' },
            { name: 'Import Resource', args: ['path'], doc: 'Imports a resource file with the given path' },
            { name: 'Import Variables', args: ['path', '*args'], doc: 'Imports a Python module with variable definitions' },
            { name: 'Keyword Should Exist', args: ['name', 'msg=None'], doc: 'Fails unless the given keyword exists in the current scope' },
            { name: 'Get Library Instance', args: ['name=None', 'all=False'], doc: 'Returns the currently active instance of the specified library' },
            { name: 'Comment', args: ['*messages'], doc: 'Displays the given messages in the log file as a comment' },
            { name: 'Set Log Level', args: ['level'], doc: 'Sets the log threshold to the specified level and returns the old level' },
            { name: 'Reload Library', args: ['name_or_instance'], doc: 'Rechecks what keywords the specified library provides' },
            { name: 'Set Library Search Order', args: ['*search_order'], doc: 'Sets the resolution order for keywords' },
            { name: 'Convert To Integer', args: ['item', 'base=None'], doc: 'Converts the given item to an integer number' },
            { name: 'Convert To Number', args: ['item', 'precision=None'], doc: 'Converts the given item to a floating point number' },
            { name: 'Convert To String', args: ['item'], doc: 'Converts the given item to a Unicode string' },
            { name: 'Convert To Boolean', args: ['item'], doc: 'Converts the given item to Boolean true or false' },
            { name: 'Convert To Bytes', args: ['input', 'input_type=text'], doc: 'Converts the given input to bytes' },
            { name: 'Convert To Binary', args: ['item', 'base=None', 'prefix=None', 'length=None'], doc: 'Converts the given item to a binary string' },
            { name: 'Convert To Hex', args: ['item', 'base=None', 'prefix=None', 'length=None', 'lowercase=False'], doc: 'Converts the given item to a hexadecimal string' },
            { name: 'Convert To Octal', args: ['item', 'base=None', 'prefix=None', 'length=None'], doc: 'Converts the given item to an octal string' },
            { name: 'Create List', args: ['*items'], doc: 'Returns a list containing given items' },
            { name: 'Create Dictionary', args: ['*items'], doc: 'Creates and returns a dictionary based on the given items' },
            { name: 'Catenate', args: ['*items'], doc: 'Catenates the given items together and returns the result string' },
            { name: 'Evaluate', args: ['expression', 'modules=None', 'namespace=None'], doc: 'Evaluates the given expression in Python and returns the result' },
            { name: 'Call Method', args: ['object', 'method_name', '*args', '**kwargs'], doc: 'Calls the named method of the given object with the provided arguments' },
            { name: 'Regexp Escape', args: ['*patterns'], doc: 'Returns each argument string escaped for use as a regular expression' },
            { name: 'Set Tags', args: ['*tags'], doc: 'Adds given tags for the current test or all tests in a suite' },
            { name: 'Remove Tags', args: ['*tags'], doc: 'Removes given tags from the current test or all tests in a suite' },
            { name: 'Get Count', args: ['container', 'item'], doc: 'Returns and logs how many times item is found from container' },
            { name: 'Length Should Be', args: ['item', 'length', 'msg=None'], doc: 'Verifies that the length of the given item is correct' },
            { name: 'Should Be Equal As Integers', args: ['first', 'second', 'msg=None', 'values=True', 'base=None'], doc: 'Fails if objects are unequal after converting them to integers' },
            { name: 'Should Be Equal As Numbers', args: ['first', 'second', 'msg=None', 'values=True', 'precision=6'], doc: 'Fails if objects are unequal after converting them to real numbers' },
            { name: 'Should Be Equal As Strings', args: ['first', 'second', 'msg=None', 'values=True', 'ignore_case=False', 'strip_spaces=False', 'collapse_spaces=False'], doc: 'Fails if objects are unequal after converting them to strings' },
            { name: 'Should Not Be Equal As Integers', args: ['first', 'second', 'msg=None', 'values=True', 'base=None'], doc: 'Fails if objects are equal after converting them to integers' },
            { name: 'Should Not Be Equal As Numbers', args: ['first', 'second', 'msg=None', 'values=True', 'precision=6'], doc: 'Fails if objects are equal after converting them to real numbers' },
            { name: 'Should Not Be Equal As Strings', args: ['first', 'second', 'msg=None', 'values=True', 'ignore_case=False', 'strip_spaces=False', 'collapse_spaces=False'], doc: 'Fails if objects are equal after converting them to strings' },
            
            // Collections Library
            { name: 'Append To List', args: ['list_', '*values'], doc: 'Adds values to the end of list', library: 'Collections' },
            { name: 'Combine Lists', args: ['*lists'], doc: 'Combines the given lists together and returns the result', library: 'Collections' },
            { name: 'Copy List', args: ['list_', 'deepcopy=False'], doc: 'Returns a copy of the given list', library: 'Collections' },
            { name: 'Count Values In List', args: ['list_', 'value', 'start=0', 'end=None'], doc: 'Returns the number of occurrences of the given value in list', library: 'Collections' },
            { name: 'Dictionaries Should Be Equal', args: ['dict1', 'dict2', 'msg=None', 'values=True'], doc: 'Fails if the given dictionaries are not equal', library: 'Collections' },
            { name: 'Dictionary Should Contain Item', args: ['dictionary', 'key', 'value', 'msg=None'], doc: 'Fails if key:value not found from dictionary', library: 'Collections' },
            { name: 'Dictionary Should Contain Key', args: ['dictionary', 'key', 'msg=None'], doc: 'Fails if key is not found from dictionary', library: 'Collections' },
            { name: 'Dictionary Should Contain Value', args: ['dictionary', 'value', 'msg=None'], doc: 'Fails if value is not found from dictionary', library: 'Collections' },
            { name: 'Dictionary Should Not Contain Key', args: ['dictionary', 'key', 'msg=None'], doc: 'Fails if key is found from dictionary', library: 'Collections' },
            { name: 'Dictionary Should Not Contain Value', args: ['dictionary', 'value', 'msg=None'], doc: 'Fails if value is found from dictionary', library: 'Collections' },
            { name: 'Get Dictionary Items', args: ['dictionary', 'sort_keys=True'], doc: 'Returns items of the given dictionary as a list', library: 'Collections' },
            { name: 'Get Dictionary Keys', args: ['dictionary', 'sort_keys=True'], doc: 'Returns keys of the given dictionary', library: 'Collections' },
            { name: 'Get Dictionary Values', args: ['dictionary', 'sort_keys=True'], doc: 'Returns values of the given dictionary', library: 'Collections' },
            { name: 'Get From Dictionary', args: ['dictionary', 'key', 'default=None'], doc: 'Returns a value from the given dictionary', library: 'Collections' },
            { name: 'Get From List', args: ['list_', 'index'], doc: 'Returns the value specified with an index from list', library: 'Collections' },
            { name: 'Get Index From List', args: ['list_', 'value', 'start=0', 'end=None'], doc: 'Returns the index of the first occurrence of the value in list', library: 'Collections' },
            { name: 'Get Match Count', args: ['list', 'pattern', 'case_insensitive=False', 'whitespace_insensitive=False'], doc: 'Returns the count of matches to pattern in list', library: 'Collections' },
            { name: 'Get Matches', args: ['list', 'pattern', 'case_insensitive=False', 'whitespace_insensitive=False'], doc: 'Returns a list of matches to pattern in list', library: 'Collections' },
            { name: 'Get Slice From List', args: ['list_', 'start=0', 'end=None'], doc: 'Returns a slice of the given list', library: 'Collections' },
            { name: 'Insert Into List', args: ['list_', 'index', 'value'], doc: 'Inserts value into list to the position specified with index', library: 'Collections' },
            { name: 'Keep In Dictionary', args: ['dictionary', '*keys'], doc: 'Keeps the given keys in the dictionary and removes all other', library: 'Collections' },
            { name: 'List Should Contain Sub List', args: ['list1', 'list2', 'msg=None', 'values=True'], doc: 'Fails if list1 does not contain all elements of list2', library: 'Collections' },
            { name: 'List Should Contain Value', args: ['list_', 'value', 'msg=None'], doc: 'Fails if value is not found from list', library: 'Collections' },
            { name: 'List Should Not Contain Duplicates', args: ['list_', 'msg=None'], doc: 'Fails if any element in the list is found from it more than once', library: 'Collections' },
            { name: 'List Should Not Contain Value', args: ['list_', 'value', 'msg=None'], doc: 'Fails if value is found from list', library: 'Collections' },
            { name: 'Lists Should Be Equal', args: ['list1', 'list2', 'msg=None', 'values=True', 'names=None', 'ignore_order=False'], doc: 'Fails if given lists are unequal', library: 'Collections' },
            { name: 'Pop From Dictionary', args: ['dictionary', 'key', 'default=None'], doc: 'Pops the given key from the dictionary and returns its value', library: 'Collections' },
            { name: 'Remove Duplicates', args: ['list_'], doc: 'Returns a list without duplicates based on the given list', library: 'Collections' },
            { name: 'Remove From Dictionary', args: ['dictionary', '*keys'], doc: 'Removes the given keys from the dictionary', library: 'Collections' },
            { name: 'Remove From List', args: ['list_', 'index'], doc: 'Removes and returns the value from list by index', library: 'Collections' },
            { name: 'Remove Values From List', args: ['list_', '*values'], doc: 'Removes all occurrences of given values from list', library: 'Collections' },
            { name: 'Reverse List', args: ['list_'], doc: 'Reverses the given list in place', library: 'Collections' },
            { name: 'Set List Value', args: ['list_', 'index', 'value'], doc: 'Sets the value of list specified by index to the given value', library: 'Collections' },
            { name: 'Set To Dictionary', args: ['dictionary', '*key_value_pairs', '**items'], doc: 'Adds the given key_value_pairs and items to the dictionary', library: 'Collections' },
            { name: 'Should Contain Match', args: ['list', 'pattern', 'msg=None', 'case_insensitive=False', 'whitespace_insensitive=False'], doc: 'Fails if pattern is not found in list', library: 'Collections' },
            { name: 'Should Not Contain Match', args: ['list', 'pattern', 'msg=None', 'case_insensitive=False', 'whitespace_insensitive=False'], doc: 'Fails if pattern is found in list', library: 'Collections' },
            { name: 'Sort List', args: ['list_', 'key=None', 'reverse=False'], doc: 'Sorts the given list in place', library: 'Collections' },

            // String Library
            { name: 'Convert To Lower Case', args: ['string'], doc: 'Converts string to lower case', library: 'String' },
            { name: 'Convert To Upper Case', args: ['string'], doc: 'Converts string to upper case', library: 'String' },
            { name: 'Convert To Title Case', args: ['string', 'exclude=None'], doc: 'Converts string to title case', library: 'String' },
            { name: 'Decode Bytes To String', args: ['bytes', 'encoding', 'errors=strict'], doc: 'Decodes the given bytes to a Unicode string', library: 'String' },
            { name: 'Encode String To Bytes', args: ['string', 'encoding', 'errors=strict'], doc: 'Encodes the given Unicode string to bytes', library: 'String' },
            { name: 'Fetch From Left', args: ['string', 'marker'], doc: 'Returns contents of the string before the first marker', library: 'String' },
            { name: 'Fetch From Right', args: ['string', 'marker'], doc: 'Returns contents of the string after the last marker', library: 'String' },
            { name: 'Format String', args: ['template', '*positional', '**named'], doc: 'Formats a template using the given positional and named arguments', library: 'String' },
            { name: 'Generate Random String', args: ['length=8', 'chars=[LETTERS][NUMBERS]'], doc: 'Generates a string with a desired length', library: 'String' },
            { name: 'Get Line', args: ['string', 'line_number'], doc: 'Returns the specified line from the given string', library: 'String' },
            { name: 'Get Line Count', args: ['string'], doc: 'Returns and logs the number of lines in the given string', library: 'String' },
            { name: 'Get Lines Containing String', args: ['string', 'pattern', 'case_insensitive=False'], doc: 'Returns lines of the given string that contain the pattern', library: 'String' },
            { name: 'Get Lines Matching Pattern', args: ['string', 'pattern', 'case_insensitive=False'], doc: 'Returns lines of string that match the pattern', library: 'String' },
            { name: 'Get Lines Matching Regexp', args: ['string', 'pattern', 'partial_match=False'], doc: 'Returns lines matching the regular expression pattern', library: 'String' },
            { name: 'Get Regexp Matches', args: ['string', 'pattern', '*groups'], doc: 'Returns a list of all non-overlapping matches in the given string', library: 'String' },
            { name: 'Get Substring', args: ['string', 'start', 'end=None'], doc: 'Returns a substring from start to end', library: 'String' },
            { name: 'Remove String', args: ['string', '*removables'], doc: 'Removes all removables from string', library: 'String' },
            { name: 'Remove String Using Regexp', args: ['string', '*patterns'], doc: 'Removes substrings matching any pattern', library: 'String' },
            { name: 'Replace String', args: ['string', 'search_for', 'replace_with', 'count=-1'], doc: 'Replaces search_for in string with replace_with', library: 'String' },
            { name: 'Replace String Using Regexp', args: ['string', 'pattern', 'replace_with', 'count=-1'], doc: 'Replaces pattern in string with replace_with', library: 'String' },
            { name: 'Should Be Byte String', args: ['item', 'msg=None'], doc: 'Fails if given item is not a bytes', library: 'String' },
            { name: 'Should Be Lower Case', args: ['string', 'msg=None'], doc: 'Fails if string is not in lower case', library: 'String' },
            { name: 'Should Be String', args: ['item', 'msg=None'], doc: 'Fails if given item is not a string', library: 'String' },
            { name: 'Should Be Title Case', args: ['string', 'msg=None', 'exclude=None'], doc: 'Fails if string is not in title case', library: 'String' },
            { name: 'Should Be Unicode String', args: ['item', 'msg=None'], doc: 'Fails if given item is not a Unicode string', library: 'String' },
            { name: 'Should Be Upper Case', args: ['string', 'msg=None'], doc: 'Fails if string is not in upper case', library: 'String' },
            { name: 'Should Not Be String', args: ['item', 'msg=None'], doc: 'Fails if given item is a string', library: 'String' },
            { name: 'Split String', args: ['string', 'separator=None', 'max_split=-1'], doc: 'Splits string using separator as a delimiter', library: 'String' },
            { name: 'Split String From Right', args: ['string', 'separator=None', 'max_split=-1'], doc: 'Splits string from right using separator', library: 'String' },
            { name: 'Split String To Characters', args: ['string'], doc: 'Splits string to list of characters', library: 'String' },
            { name: 'Split To Lines', args: ['string', 'start=0', 'end=None'], doc: 'Splits string to lines', library: 'String' },
            { name: 'Strip String', args: ['string', 'mode=both', 'characters=None'], doc: 'Removes leading and/or trailing whitespace', library: 'String' },

            // DateTime Library
            { name: 'Add Time To Date', args: ['date', 'time', 'result_format=timestamp', 'exclude_millis=False', 'date_format=None'], doc: 'Adds time to date and returns the resulting date', library: 'DateTime' },
            { name: 'Add Time To Time', args: ['time1', 'time2', 'result_format=number', 'exclude_millis=False'], doc: 'Adds time to another time and returns the result', library: 'DateTime' },
            { name: 'Convert Date', args: ['date', 'result_format=timestamp', 'exclude_millis=False', 'date_format=None'], doc: 'Converts between supported date formats', library: 'DateTime' },
            { name: 'Convert Time', args: ['time', 'result_format=number', 'exclude_millis=False'], doc: 'Converts between supported time formats', library: 'DateTime' },
            { name: 'Get Current Date', args: ['time_zone=local', 'increment=0', 'result_format=timestamp', 'exclude_millis=False'], doc: 'Returns current local or UTC time', library: 'DateTime' },
            { name: 'Subtract Date From Date', args: ['date1', 'date2', 'result_format=number', 'exclude_millis=False', 'date1_format=None', 'date2_format=None'], doc: 'Subtracts date from another date', library: 'DateTime' },
            { name: 'Subtract Time From Date', args: ['date', 'time', 'result_format=timestamp', 'exclude_millis=False', 'date_format=None'], doc: 'Subtracts time from date and returns resulting date', library: 'DateTime' },
            { name: 'Subtract Time From Time', args: ['time1', 'time2', 'result_format=number', 'exclude_millis=False'], doc: 'Subtracts time from another time', library: 'DateTime' },

            // OperatingSystem Library
            { name: 'Append To Environment Variable', args: ['name', '*values', 'separator=None'], doc: 'Appends values to the end of environment variable', library: 'OperatingSystem' },
            { name: 'Append To File', args: ['path', 'content', 'encoding=UTF-8'], doc: 'Appends the given content to the specified file', library: 'OperatingSystem' },
            { name: 'Copy Directory', args: ['source', 'destination'], doc: 'Copies the source directory into the destination', library: 'OperatingSystem' },
            { name: 'Copy File', args: ['source', 'destination'], doc: 'Copies the source file into the destination', library: 'OperatingSystem' },
            { name: 'Copy Files', args: ['*sources_and_destination'], doc: 'Copies specified files to the target directory', library: 'OperatingSystem' },
            { name: 'Count Directories In Directory', args: ['path', 'pattern=None'], doc: 'Counts directories directly in the given directory', library: 'OperatingSystem' },
            { name: 'Count Files In Directory', args: ['path', 'pattern=None'], doc: 'Counts files directly in the given directory', library: 'OperatingSystem' },
            { name: 'Count Items In Directory', args: ['path', 'pattern=None'], doc: 'Counts all items in the given directory', library: 'OperatingSystem' },
            { name: 'Create Binary File', args: ['path', 'content'], doc: 'Creates a binary file with the given content', library: 'OperatingSystem' },
            { name: 'Create Directory', args: ['path'], doc: 'Creates the specified directory', library: 'OperatingSystem' },
            { name: 'Create File', args: ['path', 'content=', 'encoding=UTF-8'], doc: 'Creates a file with the given content', library: 'OperatingSystem' },
            { name: 'Directory Should Be Empty', args: ['path', 'msg=None'], doc: 'Fails unless the specified directory is empty', library: 'OperatingSystem' },
            { name: 'Directory Should Exist', args: ['path', 'msg=None'], doc: 'Fails unless the specified directory exists', library: 'OperatingSystem' },
            { name: 'Directory Should Not Be Empty', args: ['path', 'msg=None'], doc: 'Fails if the specified directory is empty', library: 'OperatingSystem' },
            { name: 'Directory Should Not Exist', args: ['path', 'msg=None'], doc: 'Fails if the specified directory exists', library: 'OperatingSystem' },
            { name: 'Empty Directory', args: ['path'], doc: 'Deletes all the content from the given directory', library: 'OperatingSystem' },
            { name: 'Environment Variable Should Be Set', args: ['name', 'msg=None'], doc: 'Fails if the specified environment variable is not set', library: 'OperatingSystem' },
            { name: 'Environment Variable Should Not Be Set', args: ['name', 'msg=None'], doc: 'Fails if the specified environment variable is set', library: 'OperatingSystem' },
            { name: 'File Should Be Empty', args: ['path', 'msg=None'], doc: 'Fails unless the specified file is empty', library: 'OperatingSystem' },
            { name: 'File Should Exist', args: ['path', 'msg=None'], doc: 'Fails unless the specified file exists', library: 'OperatingSystem' },
            { name: 'File Should Not Be Empty', args: ['path', 'msg=None'], doc: 'Fails if the specified file is empty', library: 'OperatingSystem' },
            { name: 'File Should Not Exist', args: ['path', 'msg=None'], doc: 'Fails if the specified file exists', library: 'OperatingSystem' },
            { name: 'Get Binary File', args: ['path'], doc: 'Returns the contents of a specified file', library: 'OperatingSystem' },
            { name: 'Get Environment Variable', args: ['name', 'default=None'], doc: 'Returns the value of an environment variable', library: 'OperatingSystem' },
            { name: 'Get Environment Variables', args: [], doc: 'Returns all environment variables as a dictionary', library: 'OperatingSystem' },
            { name: 'Get File', args: ['path', 'encoding=UTF-8', 'encoding_errors=strict'], doc: 'Returns the contents of a specified file', library: 'OperatingSystem' },
            { name: 'Get File Size', args: ['path'], doc: 'Returns and logs file size as an integer in bytes', library: 'OperatingSystem' },
            { name: 'Get Modified Time', args: ['path', 'format=timestamp'], doc: 'Returns the last modification time of a file or directory', library: 'OperatingSystem' },
            { name: 'Grep File', args: ['path', 'pattern', 'encoding=UTF-8', 'encoding_errors=strict'], doc: 'Returns the lines matching the pattern in file', library: 'OperatingSystem' },
            { name: 'Join Path', args: ['base', '*parts'], doc: 'Joins the given path part(s) to the base path', library: 'OperatingSystem' },
            { name: 'Join Paths', args: ['base', '*paths'], doc: 'Joins given paths with base and returns a list', library: 'OperatingSystem' },
            { name: 'List Directories In Directory', args: ['path', 'pattern=None', 'absolute=False'], doc: 'Lists directories in the given directory', library: 'OperatingSystem' },
            { name: 'List Directory', args: ['path', 'pattern=None', 'absolute=False'], doc: 'Lists all items in the given directory', library: 'OperatingSystem' },
            { name: 'List Files In Directory', args: ['path', 'pattern=None', 'absolute=False'], doc: 'Lists files in the given directory', library: 'OperatingSystem' },
            { name: 'Log Environment Variables', args: ['level=INFO'], doc: 'Logs all environment variables', library: 'OperatingSystem' },
            { name: 'Log File', args: ['path', 'encoding=UTF-8', 'encoding_errors=strict'], doc: 'Logs the contents of the file', library: 'OperatingSystem' },
            { name: 'Move Directory', args: ['source', 'destination'], doc: 'Moves the source directory into the destination', library: 'OperatingSystem' },
            { name: 'Move File', args: ['source', 'destination'], doc: 'Moves the source file into the destination', library: 'OperatingSystem' },
            { name: 'Move Files', args: ['*sources_and_destination'], doc: 'Moves specified files to the target directory', library: 'OperatingSystem' },
            { name: 'Normalize Path', args: ['path', 'case_normalize=False'], doc: 'Normalizes the given path', library: 'OperatingSystem' },
            { name: 'Remove Directory', args: ['path', 'recursive=False'], doc: 'Removes the directory', library: 'OperatingSystem' },
            { name: 'Remove Environment Variable', args: ['*names'], doc: 'Deletes the specified environment variables', library: 'OperatingSystem' },
            { name: 'Remove File', args: ['path'], doc: 'Removes a file with the given path', library: 'OperatingSystem' },
            { name: 'Remove Files', args: ['*paths'], doc: 'Removes multiple files', library: 'OperatingSystem' },
            { name: 'Run', args: ['command'], doc: 'Runs the given command in the system and returns output', library: 'OperatingSystem' },
            { name: 'Run And Return Rc', args: ['command'], doc: 'Runs the given command and returns the return code', library: 'OperatingSystem' },
            { name: 'Run And Return Rc And Output', args: ['command'], doc: 'Runs the command and returns rc and output', library: 'OperatingSystem' },
            { name: 'Set Environment Variable', args: ['name', 'value'], doc: 'Sets an environment variable to the specified value', library: 'OperatingSystem' },
            { name: 'Set Modified Time', args: ['path', 'mtime'], doc: 'Sets the file modification and access times', library: 'OperatingSystem' },
            { name: 'Should Exist', args: ['path', 'msg=None'], doc: 'Fails unless the given path exists', library: 'OperatingSystem' },
            { name: 'Should Not Exist', args: ['path', 'msg=None'], doc: 'Fails if the given path exists', library: 'OperatingSystem' },
            { name: 'Split Extension', args: ['path'], doc: 'Splits extension from the path and returns both parts', library: 'OperatingSystem' },
            { name: 'Split Path', args: ['path'], doc: 'Splits the path from the last path separator and returns both parts', library: 'OperatingSystem' },
            { name: 'Touch', args: ['path'], doc: 'Emulates the UNIX touch command', library: 'OperatingSystem' },
            { name: 'Wait Until Created', args: ['path', 'timeout=1 minute'], doc: 'Waits until the given file or directory gets created', library: 'OperatingSystem' },
            { name: 'Wait Until Removed', args: ['path', 'timeout=1 minute'], doc: 'Waits until the given file or directory is removed', library: 'OperatingSystem' },

            // Process Library
            { name: 'Get Process Id', args: ['handle=None'], doc: 'Returns the process ID of the process', library: 'Process' },
            { name: 'Get Process Object', args: ['handle=None'], doc: 'Returns the underlying subprocess.Popen object', library: 'Process' },
            { name: 'Get Process Result', args: ['handle=None', 'rc=False', 'stdout=False', 'stderr=False', 'stdout_path=None', 'stderr_path=None'], doc: 'Returns the specified robot.result.Result object or some of its attributes', library: 'Process' },
            { name: 'Is Process Running', args: ['handle=None'], doc: 'Checks is the process running or not', library: 'Process' },
            { name: 'Join Command Line', args: ['*args'], doc: 'Joins arguments into a command line string', library: 'Process' },
            { name: 'Process Should Be Running', args: ['handle=None', 'error_message=Process is not running.'], doc: 'Verifies that the process is running', library: 'Process' },
            { name: 'Process Should Be Stopped', args: ['handle=None', 'error_message=Process is running.'], doc: 'Verifies that the process is not running', library: 'Process' },
            { name: 'Run Process', args: ['command', '*arguments', '**configuration'], doc: 'Runs a process and waits for it to complete', library: 'Process' },
            { name: 'Send Signal To Process', args: ['signal', 'handle=None', 'group=False'], doc: 'Sends the given signal to the specified process', library: 'Process' },
            { name: 'Split Command Line', args: ['args', 'escaping=False'], doc: 'Splits command line string into a list of arguments', library: 'Process' },
            { name: 'Start Process', args: ['command', '*arguments', '**configuration'], doc: 'Starts a new process on background', library: 'Process' },
            { name: 'Switch Process', args: ['handle'], doc: 'Makes the specified process the current active process', library: 'Process' },
            { name: 'Terminate All Processes', args: ['kill=False'], doc: 'Terminates all still running processes', library: 'Process' },
            { name: 'Terminate Process', args: ['handle=None', 'kill=False'], doc: 'Stops the process gracefully or forcefully', library: 'Process' },
            { name: 'Wait For Process', args: ['handle=None', 'timeout=None', 'on_timeout=continue'], doc: 'Waits for the process to complete or to reach the given timeout', library: 'Process' },

            // XML Library
            { name: 'Add Element', args: ['source', 'element', 'index=None', 'xpath=.'], doc: 'Adds a child element to the specified element', library: 'XML' },
            { name: 'Clear Element', args: ['source', 'xpath=.', 'clear_tail=False'], doc: 'Clears the contents of the specified element', library: 'XML' },
            { name: 'Copy Element', args: ['source', 'xpath=.'], doc: 'Returns a copy of the specified element', library: 'XML' },
            { name: 'Element Attribute Should Be', args: ['source', 'name', 'expected', 'xpath=.', 'message=None'], doc: 'Verifies that the specified attribute is expected', library: 'XML' },
            { name: 'Element Attribute Should Match', args: ['source', 'name', 'pattern', 'xpath=.', 'message=None'], doc: 'Verifies that the specified attribute matches expected', library: 'XML' },
            { name: 'Element Should Exist', args: ['source', 'xpath=.', 'message=None'], doc: 'Verifies that one or more elements match the xpath', library: 'XML' },
            { name: 'Element Should Not Exist', args: ['source', 'xpath=.', 'message=None'], doc: 'Verifies that no element matches the given xpath', library: 'XML' },
            { name: 'Element Should Not Have Attribute', args: ['source', 'name', 'xpath=.', 'message=None'], doc: 'Verifies that the specified element does not have attribute name', library: 'XML' },
            { name: 'Element Text Should Be', args: ['source', 'expected', 'xpath=.', 'normalize_whitespace=False', 'message=None'], doc: 'Verifies that the text of the specified element is expected', library: 'XML' },
            { name: 'Element Text Should Match', args: ['source', 'pattern', 'xpath=.', 'normalize_whitespace=False', 'message=None'], doc: 'Verifies that the text of element matches expected pattern', library: 'XML' },
            { name: 'Element To String', args: ['source', 'xpath=.', 'encoding=None'], doc: 'Returns the string representation of the specified element', library: 'XML' },
            { name: 'Elements Should Be Equal', args: ['source', 'expected', 'exclude_children=False', 'normalize_whitespace=False'], doc: 'Verifies that the given source element is equal to expected', library: 'XML' },
            { name: 'Elements Should Match', args: ['source', 'expected', 'exclude_children=False', 'normalize_whitespace=False'], doc: 'Verifies that the given source element matches expected', library: 'XML' },
            { name: 'Evaluate Xpath', args: ['source', 'expression', 'context=.'], doc: 'Evaluates the given xpath expression and returns results', library: 'XML' },
            { name: 'Get Child Elements', args: ['source', 'xpath=.'], doc: 'Returns the child elements of the specified element', library: 'XML' },
            { name: 'Get Element', args: ['source', 'xpath=.'], doc: 'Returns an element in the source matching the xpath', library: 'XML' },
            { name: 'Get Element Attribute', args: ['source', 'name', 'xpath=.', 'default=None'], doc: 'Returns the named attribute of the specified element', library: 'XML' },
            { name: 'Get Element Attributes', args: ['source', 'xpath=.'], doc: 'Returns all attributes of the specified element', library: 'XML' },
            { name: 'Get Element Count', args: ['source', 'xpath=.'], doc: 'Returns the number of elements matching xpath', library: 'XML' },
            { name: 'Get Element Text', args: ['source', 'xpath=.', 'normalize_whitespace=False'], doc: 'Returns the text of the specified element', library: 'XML' },
            { name: 'Get Elements', args: ['source', 'xpath'], doc: 'Returns a list of elements matching xpath', library: 'XML' },
            { name: 'Get Elements Texts', args: ['source', 'xpath', 'normalize_whitespace=False'], doc: 'Returns a list of texts of all elements matching xpath', library: 'XML' },
            { name: 'Log Element', args: ['source', 'level=INFO', 'xpath=.'], doc: 'Logs the string representation of the specified element', library: 'XML' },
            { name: 'Parse Xml', args: ['source', 'keep_clark_notation=False', 'strip_namespaces=False'], doc: 'Parses the given XML file or string into element structure', library: 'XML' },
            { name: 'Remove Element', args: ['source', 'xpath=', 'remove_tail=False'], doc: 'Removes the element matching xpath from source', library: 'XML' },
            { name: 'Remove Element Attribute', args: ['source', 'name', 'xpath=.'], doc: 'Removes attribute name from the specified element', library: 'XML' },
            { name: 'Remove Element Attributes', args: ['source', 'xpath=.'], doc: 'Removes all attributes from the specified element', library: 'XML' },
            { name: 'Remove Elements', args: ['source', 'xpath=', 'remove_tail=False'], doc: 'Removes all elements matching xpath from source', library: 'XML' },
            { name: 'Remove Elements Attribute', args: ['source', 'name', 'xpath=.'], doc: 'Removes attribute name from the specified elements', library: 'XML' },
            { name: 'Remove Elements Attributes', args: ['source', 'xpath=.'], doc: 'Removes all attributes from the specified elements', library: 'XML' },
            { name: 'Save Xml', args: ['source', 'path', 'encoding=UTF-8'], doc: 'Saves the given element to the specified file', library: 'XML' },
            { name: 'Set Element Attribute', args: ['source', 'name', 'value', 'xpath=.'], doc: 'Sets attribute name of the specified element to value', library: 'XML' },
            { name: 'Set Element Tag', args: ['source', 'tag', 'xpath=.'], doc: 'Sets the tag of the specified element', library: 'XML' },
            { name: 'Set Element Text', args: ['source', 'text=None', 'tail=None', 'xpath=.'], doc: 'Sets text and/or tail text of the specified element', library: 'XML' },
            { name: 'Set Elements Attribute', args: ['source', 'name', 'value', 'xpath=.'], doc: 'Sets attribute name of the specified elements to value', library: 'XML' },
            { name: 'Set Elements Tag', args: ['source', 'tag', 'xpath=.'], doc: 'Sets tag of the specified elements', library: 'XML' },
            { name: 'Set Elements Text', args: ['source', 'text=None', 'tail=None', 'xpath=.'], doc: 'Sets text and/or tail of the specified elements', library: 'XML' },
        ];

        for (const builtin of builtins) {
            const args: ArgumentInfo[] = builtin.args.map(arg => {
                const hasDefault = arg.includes('=');
                const [name, defaultValue] = hasDefault ? arg.split('=') : [arg, undefined];
                return {
                    name: name,
                    defaultValue: defaultValue,
                    isOptional: hasDefault || name.startsWith('*')
                };
            });

            this.builtinKeywords.set(builtin.name.toLowerCase(), {
                name: builtin.name,
                documentation: builtin.doc,
                arguments: args,
                location: new vscode.Location(vscode.Uri.parse(`builtin://${builtin.library || 'BuiltIn'}`), new vscode.Range(0, 0, 0, 0)),
                type: 'builtin',
                library: builtin.library || 'BuiltIn',
                source: builtin.library || 'BuiltIn'
            });
        }
    }

    async indexWorkspace(workspaceFolder: vscode.WorkspaceFolder): Promise<void> {
        const files = await vscode.workspace.findFiles(
            new vscode.RelativePattern(workspaceFolder, '**/*.{robot,resource}'),
            '**/node_modules/**'
        );

        for (const file of files) {
            await this.indexFile(file);
        }
    }

    async indexFile(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            this.parseDocument(document);
        } catch (error) {
            console.error(`Error indexing file ${uri.fsPath}:`, error);
        }
    }

    private parseDocument(document: vscode.TextDocument): void {
        const text = document.getText();
        const lines = text.split('\n');

        let currentSection: 'settings' | 'variables' | 'testcases' | 'keywords' | null = null;
        let currentKeyword: Partial<KeywordDefinition> | null = null;
        let currentTest: Partial<TestCaseDefinition> | null = null;
        let currentKeywordStartLine = 0;
        let currentTestStartLine = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            // Detect section headers
            if (trimmedLine.startsWith('***')) {
                // Save previous keyword or test
                if (currentKeyword && currentKeyword.name) {
                    this.addKeyword(document.uri, this.finalizeKeyword(currentKeyword, currentKeywordStartLine, i - 1, document));
                    currentKeyword = null;
                }
                if (currentTest && currentTest.name) {
                    this.addTestCase(document.uri, this.finalizeTestCase(currentTest, currentTestStartLine, i - 1, document));
                    currentTest = null;
                }

                const sectionName = trimmedLine.replace(/\*/g, '').trim().toLowerCase();
                if (sectionName.includes('setting')) {
                    currentSection = 'settings';
                } else if (sectionName.includes('variable')) {
                    currentSection = 'variables';
                } else if (sectionName.includes('test case')) {
                    currentSection = 'testcases';
                } else if (sectionName.includes('keyword')) {
                    currentSection = 'keywords';
                }
                continue;
            }

            // Skip empty lines and comments
            if (trimmedLine === '' || trimmedLine.startsWith('#')) {
                continue;
            }

            const startsWithoutWhitespace = line.length > 0 && !/^\s/.test(line);

            // Parse based on current section
            if (currentSection === 'variables' && startsWithoutWhitespace) {
                this.parseVariable(trimmedLine, document, i);
            } else if (currentSection === 'keywords' && startsWithoutWhitespace) {
                // Save previous keyword
                if (currentKeyword && currentKeyword.name) {
                    this.addKeyword(document.uri, this.finalizeKeyword(currentKeyword, currentKeywordStartLine, i - 1, document));
                }

                // Start new keyword
                currentKeyword = {
                    name: trimmedLine,
                    documentation: '',
                    arguments: [],
                    type: 'user',
                    source: document.uri.fsPath
                };
                currentKeywordStartLine = i;
            } else if (currentSection === 'testcases' && startsWithoutWhitespace) {
                // Save previous test
                if (currentTest && currentTest.name) {
                    this.addTestCase(document.uri, this.finalizeTestCase(currentTest, currentTestStartLine, i - 1, document));
                }

                // Start new test
                currentTest = {
                    name: trimmedLine,
                    documentation: '',
                    tags: []
                };
                currentTestStartLine = i;
            } else if (line.match(/^\s+\[(\w+)\]/)) {
                // Parse metadata
                const metadataMatch = line.match(/^\s+\[(\w+)\]\s+(.+)/);
                if (metadataMatch) {
                    const [, key, value] = metadataMatch;
                    const keyLower = key.toLowerCase();

                    if (currentKeyword) {
                        if (keyLower === 'documentation') {
                            currentKeyword.documentation = value.trim();
                        } else if (keyLower === 'arguments') {
                            currentKeyword.arguments = this.parseArguments(value);
                        }
                    } else if (currentTest) {
                        if (keyLower === 'documentation') {
                            currentTest.documentation = value.trim();
                        } else if (keyLower === 'tags') {
                            currentTest.tags = value.split(/\s+/).filter(t => t.length > 0);
                        }
                    }
                }
            }
        }

        // Save last keyword or test
        if (currentKeyword && currentKeyword.name) {
            this.addKeyword(document.uri, this.finalizeKeyword(currentKeyword, currentKeywordStartLine, lines.length - 1, document));
        }
        if (currentTest && currentTest.name) {
            this.addTestCase(document.uri, this.finalizeTestCase(currentTest, currentTestStartLine, lines.length - 1, document));
        }
    }

    private parseVariable(line: string, document: vscode.TextDocument, lineNumber: number): void {
        const varMatch = line.match(/^([\$@&]\{[^}]+\})\s*(.*)/);
        if (varMatch) {
            const [, name, value] = varMatch;
            const location = new vscode.Location(
                document.uri,
                new vscode.Range(lineNumber, 0, lineNumber, line.length)
            );

            const varDef: VariableDefinition = {
                name: name,
                value: value.trim(),
                location: location,
                scope: 'suite'
            };

            this.addVariable(document.uri, varDef);
        }
    }

    private parseArguments(argsString: string): ArgumentInfo[] {
        const args: ArgumentInfo[] = [];
        const argTokens = argsString.split(/\s{2,}/).filter(a => a.trim());

        for (const token of argTokens) {
            const hasDefault = token.includes('=');
            const [name, defaultValue] = hasDefault ? token.split('=') : [token, undefined];

            args.push({
                name: name.trim(),
                defaultValue: defaultValue?.trim(),
                isOptional: hasDefault || name.trim().startsWith('*')
            });
        }

        return args;
    }

    private finalizeKeyword(
        keyword: Partial<KeywordDefinition>,
        startLine: number,
        endLine: number,
        document: vscode.TextDocument
    ): KeywordDefinition {
        return {
            name: keyword.name!,
            documentation: keyword.documentation || '',
            arguments: keyword.arguments || [],
            location: new vscode.Location(
                document.uri,
                new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length)
            ),
            type: keyword.type || 'user',
            library: keyword.library,
            source: keyword.source || document.uri.fsPath
        };
    }

    private finalizeTestCase(
        test: Partial<TestCaseDefinition>,
        startLine: number,
        endLine: number,
        document: vscode.TextDocument
    ): TestCaseDefinition {
        return {
            name: test.name!,
            documentation: test.documentation || '',
            location: new vscode.Location(
                document.uri,
                new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length)
            ),
            tags: test.tags || []
        };
    }

    private addKeyword(_uri: vscode.Uri, keyword: KeywordDefinition): void {
        const key = keyword.name.toLowerCase();
        if (!this.keywords.has(key)) {
            this.keywords.set(key, []);
        }
        this.keywords.get(key)!.push(keyword);
    }

    private addVariable(_uri: vscode.Uri, variable: VariableDefinition): void {
        const key = variable.name.toLowerCase();
        if (!this.variables.has(key)) {
            this.variables.set(key, []);
        }
        this.variables.get(key)!.push(variable);
    }

    private addTestCase(_uri: vscode.Uri, testCase: TestCaseDefinition): void {
        const key = testCase.name.toLowerCase();
        if (!this.testCases.has(key)) {
            this.testCases.set(key, []);
        }
        this.testCases.get(key)!.push(testCase);
    }

    // Public query methods
    findKeyword(name: string): KeywordDefinition[] {
        const key = name.toLowerCase();
        const userKeywords = this.keywords.get(key) || [];
        const builtin = this.builtinKeywords.get(key);
        return builtin ? [...userKeywords, builtin] : userKeywords;
    }

    findVariable(name: string): VariableDefinition[] {
        return this.variables.get(name.toLowerCase()) || [];
    }

    findTestCase(name: string): TestCaseDefinition[] {
        return this.testCases.get(name.toLowerCase()) || [];
    }

    getAllKeywords(): KeywordDefinition[] {
        const all: KeywordDefinition[] = [];
        for (const keywords of this.keywords.values()) {
            all.push(...keywords);
        }
        for (const builtin of this.builtinKeywords.values()) {
            all.push(builtin);
        }
        return all;
    }

    getAllVariables(): VariableDefinition[] {
        const all: VariableDefinition[] = [];
        for (const variables of this.variables.values()) {
            all.push(...variables);
        }
        return all;
    }

    clear(): void {
        this.keywords.clear();
        this.variables.clear();
        this.testCases.clear();
        // Keep builtin keywords
    }

    clearFile(uri: vscode.Uri): void {
        // Remove all entries from this file
        for (const [key, keywords] of this.keywords.entries()) {
            const filtered = keywords.filter(k => k.location.uri.toString() !== uri.toString());
            if (filtered.length === 0) {
                this.keywords.delete(key);
            } else {
                this.keywords.set(key, filtered);
            }
        }

        for (const [key, variables] of this.variables.entries()) {
            const filtered = variables.filter(v => v.location.uri.toString() !== uri.toString());
            if (filtered.length === 0) {
                this.variables.delete(key);
            } else {
                this.variables.set(key, filtered);
            }
        }

        for (const [key, tests] of this.testCases.entries()) {
            const filtered = tests.filter(t => t.location.uri.toString() !== uri.toString());
            if (filtered.length === 0) {
                this.testCases.delete(key);
            } else {
                this.testCases.set(key, filtered);
            }
        }
    }
}
