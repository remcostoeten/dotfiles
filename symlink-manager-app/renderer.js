document.addEventListener('DOMContentLoaded', async () => {
    // Ensure Mermaid is loaded if you are calling mermaid.run() or similar directly after this
    // For now, we initialize it in index.html and call render explicitly.

    const sourcePathInput = document.getElementById('sourcePath');
    const browseSourceBtn = document.getElementById('browseSourceBtn');
    const targetDirInput = document.getElementById('targetDir');
    const browseTargetBtn = document.getElementById('browseTargetBtn');
    const symlinkNameInput = document.getElementById('symlinkName');
    const generateCmdBtn = document.getElementById('generateCmdBtn');
    const resultArea = document.getElementById('resultArea');
    const commandOutput = document.getElementById('commandOutput');
    const copyCmdBtn = document.getElementById('copyCmdBtn');
    const toastNotification = document.getElementById('toastNotification');
    const mermaidGraphEl = document.getElementById('mermaidGraph');
    const clearGraphBtn = document.getElementById('clearGraphBtn');

    let symlinksStore = []; // To store { id: string, source: string, target: string, name: string }
    let nodeIdCounter = 0;

    // --- Initialize Mermaid ---
    // Done via import and window.mermaid in index.html

    // --- Event Listeners for Browse Buttons ---
    browseSourceBtn.addEventListener('click', async () => {
        try {
            const filePath = await window.electronAPI.openFileDialog();
            if (filePath) {
                sourcePathInput.value = filePath;
                clearError('sourcePath');
            }
        } catch (error) {
            console.error("Error opening source file dialog:", error);
            displayError('sourcePath', 'Failed to open file dialog.');
        }
    });

    browseTargetBtn.addEventListener('click', async () => {
        try {
            const dirPath = await window.electronAPI.openDirectoryDialog();
            if (dirPath) {
                targetDirInput.value = dirPath;
                clearError('targetDir');
            }
        } catch (error) {
            console.error("Error opening target directory dialog:", error);
            displayError('targetDir', 'Failed to open directory dialog.');
        }
    });

    // --- Event Listeners for Manual Input ---
    sourcePathInput.addEventListener('input', () => clearError('sourcePath'));
    targetDirInput.addEventListener('input', () => clearError('targetDir'));
    symlinkNameInput.addEventListener('input', () => clearError('symlinkName'));

    // --- Generate Command Button ---
    generateCmdBtn.addEventListener('click', () => {
        clearAllErrors();
        let hasError = false;

        const sourcePath = sourcePathInput.value.trim();
        const targetDir = targetDirInput.value.trim();
        let symlinkName = symlinkNameInput.value.trim();

        if (!sourcePath) {
            displayError('sourcePath', 'Source Path cannot be empty.');
            hasError = true;
        }
        if (!targetDir) {
            displayError('targetDir', 'Target Directory cannot be empty.');
            hasError = true;
        }

        if (hasError) {
            resultArea.classList.add('hidden');
            return;
        }

        if (!symlinkName) {
            const pathParts = sourcePath.split(/[/\\]/);
            symlinkName = pathParts.pop() || pathParts.pop();
            if (!symlinkName) {
                displayError('symlinkName', 'Could not auto-determine symlink name. Please specify one.');
                resultArea.classList.add('hidden');
                return;
            }
        }

        const normalizedTargetDir = targetDir.endsWith('/') || targetDir.endsWith('\\') ? targetDir : targetDir + '/';
        const fullTargetPath = normalizedTargetDir + symlinkName;
        const command = `ln -s "${sourcePath}" "${fullTargetPath}"`;

        commandOutput.textContent = command;
        resultArea.classList.remove('hidden');

        // Add to graph store and re-render
        const newLinkId = `link${nodeIdCounter++}`;
        symlinksStore.push({ id: newLinkId, source: sourcePath, target: fullTargetPath, name: symlinkName });
        renderGraph();
    });

    // --- Copy Command Button ---
    copyCmdBtn.addEventListener('click', () => {
        const commandToCopy = commandOutput.textContent;
        if (!commandToCopy) return;
        navigator.clipboard.writeText(commandToCopy)
            .then(() => showToast('Copied to clipboard!'))
            .catch(err => {
                console.error('Failed to copy command: ', err);
                showToast('Error copying. Please copy manually.');
            });
    });

    // --- Clear Graph Button ---
    clearGraphBtn.addEventListener('click', () => {
        symlinksStore = [];
        nodeIdCounter = 0; // Reset counter if you want fresh IDs on next generation
        renderGraph(); // Re-render with empty state
    });


    // --- Mermaid Graph Rendering ---
    async function renderGraph() {
        if (!mermaidGraphEl) return;

        if (symlinksStore.length === 0) {
            mermaidGraphEl.innerHTML = 'graph TD;\n  Empty["No symlinks generated yet."];';
            await window.mermaid.run({ nodes: [mermaidGraphEl] });
            return;
        }

        // Use ER diagram for database-like relationship visualization
        let graphDefinition = 'erDiagram\n';

        // Group nodes by directory to create "tables"
        const nodeGroups = {};

        // Process all symlinks to identify source and target directories
        symlinksStore.forEach(link => {
            const sourceDir = getDirectoryPath(link.source);
            const targetDir = getDirectoryPath(link.target);

            if (!nodeGroups[sourceDir]) nodeGroups[sourceDir] = new Set();
            if (!nodeGroups[targetDir]) nodeGroups[targetDir] = new Set();

            nodeGroups[sourceDir].add(getFileName(link.source));
            nodeGroups[targetDir].add(getFileName(link.target));
        });

        // Create "tables" for each directory
        Object.entries(nodeGroups).forEach(([dir, files]) => {
            const tableName = sanitizeId(dir);
            graphDefinition += `  ${tableName} {\n`;

            // Add files as fields in the table
            files.forEach(file => {
                graphDefinition += `    string ${sanitizeId(file)}\n`;
            });

            graphDefinition += `  }\n`;
        });

        // Add relationships between tables
        symlinksStore.forEach(link => {
            const sourceDir = sanitizeId(getDirectoryPath(link.source));
            const targetDir = sanitizeId(getDirectoryPath(link.target));
            const sourceName = sanitizeId(getFileName(link.source));
            const targetName = sanitizeId(getFileName(link.target));

            graphDefinition += `  ${sourceDir} ||--o{ ${targetDir} : "symlinks to"\n`;
        });

        try {
            // Set Mermaid theme to match Supabase colors
            window.mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                er: {
                    entityPadding: 15,
                    fontSize: 12,
                    useMaxWidth: false
                },
                themeVariables: {
                    darkMode: true,
                    background: '#1f1f1f',
                    primaryColor: '#3ecf8e',
                    primaryTextColor: '#f8f9fa',
                    primaryBorderColor: '#3ecf8e',
                    lineColor: '#3ecf8e',
                    secondaryColor: '#2e2e2e',
                    tertiaryColor: '#121212'
                }
            });

            // Clear previous graph before rendering new one
            mermaidGraphEl.innerHTML = graphDefinition;
            await window.mermaid.run({ nodes: [mermaidGraphEl] });
        } catch (error) {
            console.error("Mermaid rendering error:", error);
            mermaidGraphEl.textContent = "Error rendering graph. Check console.";
        }
    }

    // Helper functions for graph rendering
    function getDirectoryPath(fullPath) {
        const parts = fullPath.split(/[/\\]/);
        parts.pop(); // Remove filename
        return parts.join('/') || '/';
    }

    function getFileName(fullPath) {
        const parts = fullPath.split(/[/\\]/);
        return parts.pop() || parts.pop() || 'unknown';
    }

    function sanitizeId(text) {
        return text.replace(/[^a-zA-Z0-9]/g, '_').replace(/^[0-9]/, '_$&');
    }

    // Initial graph render (empty state)
    renderGraph();


    // --- Toast Notification ---
    let toastTimeout;
    function showToast(message) {
        toastNotification.textContent = message;
        toastNotification.classList.remove('opacity-0', 'invisible');
        toastNotification.classList.add('opacity-100', 'visible');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastNotification.classList.remove('opacity-100', 'visible');
            toastNotification.classList.add('opacity-0', 'invisible');
        }, 3000);
    }

    // --- Error Display Functions ---
    function displayError(inputId, message) {
        const errorElement = document.getElementById(inputId + 'Error');
        if (errorElement) errorElement.textContent = message;
    }
    function clearError(inputId) {
        const errorElement = document.getElementById(inputId + 'Error');
        if (errorElement) errorElement.textContent = '';
    }
    function clearAllErrors() {
        document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    }
});
