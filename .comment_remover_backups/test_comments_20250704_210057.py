#!/usr/bin/env python3
# This is a comment at the beginning
import os  # This is an inline comment
import sys

# This is a full line comment
def hello_world():
    """This is a docstring, should be preserved"""
    print("Hello, World!")  # Another inline comment
    # Comment inside function
    return True

# Another comment
x = "This string has a # inside it"  # But this is a real comment
y = 'Another string with # symbol'  # Real comment here too

# Multiple comments
# in a row
# should all be removed

if __name__ == "__main__":
    # Final comment
    hello_world()
