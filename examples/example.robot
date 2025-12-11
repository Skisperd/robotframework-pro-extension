*** Settings ***
Documentation     Example Robot Framework test file for testing the extension
...               This file demonstrates various Robot Framework features
Library           BuiltIn
Library           String
Library           Collections
Resource          example.resource

Suite Setup       Log    Suite Setup
Suite Teardown    Log    Suite Teardown
Test Setup        Log    Test Setup
Test Teardown     Log    Test Teardown

Force Tags        example    demo
Default Tags      robot

*** Variables ***
${STRING_VAR}     Hello, Robot Framework!
${NUMBER_VAR}     42
@{LIST_VAR}       item1    item2    item3
&{DICT_VAR}       key1=value1    key2=value2

*** Test Cases ***
Basic Test Example
    [Documentation]    A simple test case demonstrating basic keywords
    [Tags]    basic    smoke
    Log    ${STRING_VAR}
    Should Be Equal    ${STRING_VAR}    Hello, Robot Framework!
    Log    Test completed successfully

Variable Operations
    [Documentation]    Test demonstrating variable operations
    [Tags]    variables
    Log    String: ${STRING_VAR}
    Log    Number: ${NUMBER_VAR}
    Log Many    @{LIST_VAR}
    Log    Dictionary: &{DICT_VAR}
    ${result}=    Set Variable    ${NUMBER_VAR}
    Should Be Equal As Numbers    ${result}    42

String Operations
    [Documentation]    Test string manipulation
    [Tags]    strings
    ${upper}=    Convert To Upper Case    ${STRING_VAR}
    ${lower}=    Convert To Lower Case    ${STRING_VAR}
    ${length}=    Get Length    ${STRING_VAR}
    Log    Upper: ${upper}
    Log    Lower: ${lower}
    Log    Length: ${length}
    Should Contain    ${STRING_VAR}    Robot

List Operations
    [Documentation]    Test list manipulation
    [Tags]    lists
    ${first}=    Get From List    ${LIST_VAR}    0
    ${length}=    Get Length    ${LIST_VAR}
    Should Be Equal    ${first}    item1
    Should Be Equal As Numbers    ${length}    3
    List Should Contain Value    ${LIST_VAR}    item2

FOR Loop Example
    [Documentation]    Test demonstrating FOR loop
    [Tags]    loops
    FOR    ${item}    IN    @{LIST_VAR}
        Log    Processing: ${item}
        Should Not Be Empty    ${item}
    END

FOR Loop With Range
    [Documentation]    Test demonstrating FOR loop with range
    [Tags]    loops
    FOR    ${index}    IN RANGE    5
        Log    Index: ${index}
        Should Be True    ${index} < 5
    END

IF Statement Example
    [Documentation]    Test demonstrating IF statement
    [Tags]    conditionals
    IF    ${NUMBER_VAR} == 42
        Log    Number is 42
    ELSE
        Log    Number is not 42
    END

IF-ELSE IF-ELSE Example
    [Documentation]    Test demonstrating IF-ELSE IF-ELSE
    [Tags]    conditionals
    ${value}=    Set Variable    2
    IF    ${value} == 1
        Log    Value is 1
    ELSE IF    ${value} == 2
        Log    Value is 2
    ELSE
        Log    Value is something else
    END

TRY-EXCEPT Example
    [Documentation]    Test demonstrating error handling
    [Tags]    error-handling
    TRY
        Log    Trying something
        Should Be Equal    1    1
    EXCEPT
        Log    Error occurred
    FINALLY
        Log    Cleanup
    END

Custom Keyword Usage
    [Documentation]    Test using custom keywords
    [Tags]    custom
    ${result}=    My Custom Keyword    test argument
    Should Be Equal    ${result}    test argument
    Another Custom Keyword

Assertion Examples
    [Documentation]    Various assertion examples
    [Tags]    assertions
    Should Be Equal    1    1
    Should Not Be Equal    1    2
    Should Be True    ${TRUE}
    Should Be True    1 == 1
    Should Contain    ${STRING_VAR}    Robot
    Should Start With    ${STRING_VAR}    Hello
    Should End With    ${STRING_VAR}    !
    Should Match Regexp    ${STRING_VAR}    .*Robot.*

*** Keywords ***
My Custom Keyword
    [Documentation]    A custom keyword that returns its argument
    [Arguments]    ${arg}
    Log    Received argument: ${arg}
    [Return]    ${arg}

Another Custom Keyword
    [Documentation]    Another custom keyword without arguments
    Log    This is a custom keyword
    ${value}=    Set Variable    Custom Value
    Log    Value: ${value}

Keyword With Multiple Arguments
    [Documentation]    Keyword demonstrating multiple arguments
    [Arguments]    ${arg1}    ${arg2}    ${arg3}=default
    Log    Arg1: ${arg1}
    Log    Arg2: ${arg2}
    Log    Arg3: ${arg3}
    ${result}=    Set Variable    ${arg1}-${arg2}-${arg3}
    [Return]    ${result}

Keyword With Variable Arguments
    [Documentation]    Keyword demonstrating variable number of arguments
    [Arguments]    @{args}
    FOR    ${arg}    IN    @{args}
        Log    Argument: ${arg}
    END
    ${count}=    Get Length    ${args}
    [Return]    ${count}
