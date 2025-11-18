function diff --description "Enhanced diff function with nvim integration"
    function diff_help
        echo "Usage:"
        echo "  diff file1 file2    Open files in nvim diff mode"
        echo "  diff --help         Show this help message"
        echo "  diff help           Show this help message"
        echo "  diff --h            Show this help message"
        echo ""
        echo "Examples:"
        echo "  diff file1.txt file2.txt"
        echo "  diff /path/to/file1 /path/to/file2"
    end

    # Check for help flags
    if test (count $argv) -eq 1
        and contains -- $argv[1] "--help" "help" "--h"
        diff_help
        return 0
    end

    # Check if no arguments provided
    if test (count $argv) -eq 0
        echo "Error: No files provided"
        echo ""
        diff_help
        return 1
    end

    # Open files in nvim diff mode
    nvim -d $argv
end

