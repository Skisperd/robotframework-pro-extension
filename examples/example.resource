*** Settings ***
Documentation     Example resource file with reusable keywords
Library           BuiltIn

*** Variables ***
${RESOURCE_VAR}    Resource Variable

*** Keywords ***
Shared Keyword
    [Documentation]    A keyword that can be used across multiple test files
    Log    This keyword is from a resource file
    RETURN    ${RESOURCE_VAR}

Setup Keyword
    [Documentation]    Example setup keyword
    Log    Performing setup
    Set Suite Variable    ${SUITE_VAR}    Suite Level Variable

Teardown Keyword
    [Documentation]    Example teardown keyword
    Log    Performing teardown
    Log    Cleanup completed
