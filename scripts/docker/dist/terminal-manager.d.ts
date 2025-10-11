export declare class TerminalManager {
    private selectedIndex;
    private multiSelect;
    private currentView;
    private previousView;
    private currentContainer;
    private containers;
    private isRunning;
    private rl;
    constructor();
    start(): Promise<void>;
    private checkDependencies;
    private refreshContainers;
    private showMainMenu;
    private showContainerList;
    private showContainerDetails;
    private showContainerLogs;
    private showContainerStats;
    private toggleContainer;
    private toggleContainers;
    private removeContainer;
    private removeContainers;
    private performCleanup;
    private handleKeypress;
    private prompt;
    private waitForKey;
    private cleanup;
}
