# Get the directory of the currently executing script
set script_dir (status --current-filename | xargs dirname)

# Find all files in the script's directory
for file in $script_dir/*
    # Get the basename of the file
    set file_basename (basename $file)

    # Skip the loader, helper, and sorter files
    if test $file_basename = "loader.fish" -o $file_basename = "helper.fish" -o $file_basename = "sorter"
        continue
    end

    # Source the alias file
    source $file
end