import { addPlugin } from "./add";
import { configPlugin } from "./config";
import { duePlugin } from "./due";
import { epicPlugin } from "./epic";
import { helpPlugin } from "./help";
import { interactivePlugin } from "./interactive";
import { lifecyclePlugin } from "./lifecycle";
import { removePlugin } from "./remove";
import { tasksPlugin } from "./tasks";
import { typosPlugin } from "./typos";
import { undoPlugin } from "./undo";
import { visibilityPlugin } from "./visibility";
import type { TodoPlugin } from "./types";

export const builtInPlugins: TodoPlugin[] = [addPlugin, configPlugin, duePlugin, epicPlugin, helpPlugin, interactivePlugin, lifecyclePlugin, removePlugin, tasksPlugin, typosPlugin, undoPlugin, visibilityPlugin];
