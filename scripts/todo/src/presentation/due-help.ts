import { formatHelpSections, supportsColor, type HelpSection } from "./help-format";

export type DueHelpTopic = "due" | "list" | "inspect" | "clear" | "reset" | "daemon";

/** Renders the contextual help page for one `due` subcommand. Rendering never touches storage. */
export function formatDueHelp(topic: DueHelpTopic, useColor = supportsColor()): string {
  const page = PAGES[topic];
  return formatHelpSections(page.title, page.subtitle, page.sections, useColor);
}

interface HelpPage {
  title: string;
  subtitle: string;
  sections: HelpSection[];
}

const OVERVIEW: HelpPage = {
  title: "todo due",
  subtitle: "due dates, reminders, and what happens when one fires",
  sections: [
    {
      heading: "Usage",
      rows: [
        { left: "todo due <todo> <when>" },
        { left: "todo due <todo> <when> at <time>" },
        { left: "todo due <todo>" },
        { left: "todo due <todo> clear" },
        { left: "todo due <todo> reset" },
        { left: "todo due list" },
      ],
    },
    {
      heading: "Relative",
      rows: [
        { left: "30s", right: "30 seconds" },
        { left: "10m", right: "10 minutes" },
        { left: "1h", right: "1 hour" },
        { left: "3,5h", right: "3.5 hours (3.5h works too)" },
        { left: "2d", right: "2 calendar days" },
      ],
    },
    {
      heading: "Calendar",
      rows: [
        { left: "today", right: "today at the current clock time" },
        { left: "tomorrow", right: "tomorrow at the current clock time" },
        { left: "yesterday", right: "already overdue, on purpose" },
        { left: "next week", right: "same weekday, seven days on" },
        { left: "next monday", right: "the next Monday strictly after today" },
        { left: "next tue", right: "abbreviations work for every weekday" },
      ],
    },
    {
      heading: "Dates",
      rows: [
        { left: "1206", right: "12 June, current year" },
        { left: "12-06", right: "day first, the Dutch way" },
        { left: "12 jul", right: "English or Dutch month names" },
        { left: "12 juli", right: "same date as 12 jul" },
        { left: "12-06-2027", right: "two-digit years read as 20YY" },
      ],
    },
    {
      heading: "Times",
      rows: [
        { left: "tomorrow at 09:00", right: "HH:mm or HH:mm:ss, 24 hour" },
        { left: "next monday at 14:30" },
        { left: "12-06 at 18:00" },
      ],
    },
    {
      heading: "Notification",
      rows: [
        { left: "--sound default", right: "the desktop notification sound" },
        { left: "--sound none", right: "notify silently" },
        { left: "--sound ~/Music/reminder.mp3", right: "validated and stored as an absolute path" },
      ],
    },
    {
      heading: "Trigger",
      rows: [
        { left: '--run "bun run build"', right: "runs once when this reminder fires" },
        { left: "--cwd ~/projects/dora", right: "directory to run it in" },
        { left: "--cwd pwd", right: "capture the current directory now" },
      ],
    },
    {
      heading: "Examples",
      rows: [
        { left: "todo due 27 tomorrow" },
        { left: "todo due 27 10m" },
        { left: "todo due 27 3,5h" },
        { left: 'todo due 27 "next monday" at 09:00' },
        { left: "todo due 27 12-06 at 14:00" },
        { left: "todo due 27 1h --sound ~/Music/todo.mp3" },
        { left: 'todo due 27 10m --run "bun run build" --cwd pwd' },
      ],
    },
    {
      heading: "Notes",
      rows: [
        { left: "Omitting a time keeps the current local clock time." },
        { left: "Past dates are valid; they store, render overdue, and notify once." },
        { left: "`m` always means minutes. There is no month unit." },
        { left: "Run `todo due daemon --help` for background delivery." },
      ],
    },
  ],
};

const PAGES: Record<DueHelpTopic, HelpPage> = {
  due: OVERVIEW,
  list: {
    title: "todo due list",
    subtitle: "every todo that currently has a due date",
    sections: [
      { heading: "Usage", rows: [{ left: "todo due list [overdue|today|week]" }] },
      {
        heading: "Filters",
        rows: [
          { left: "overdue", right: "only todos already past their due date" },
          { left: "today", right: "overdue plus anything due before midnight" },
          { left: "week", right: "overdue plus the next seven days" },
        ],
      },
      {
        heading: "Details",
        rows: [
          { left: "Overdue first, most overdue at the top, then upcoming soonest first." },
          { left: "Completed todos keep their due date but are left out of this list." },
        ],
      },
      { heading: "Examples", rows: [{ left: "todo due list" }, { left: "todo due list overdue" }] },
    ],
  },
  inspect: {
    title: "todo due <todo>",
    subtitle: "show the due date, reminder state, and trigger for one todo",
    sections: [
      { heading: "Usage", rows: [{ left: "todo due <todo>" }] },
      {
        heading: "Details",
        rows: [
          { left: "Shows the exact timestamp, how far away it is, and whether it has notified." },
          { left: "The todo can be an ID, #ID, or the exact name of a pending todo." },
        ],
      },
      { heading: "Examples", rows: [{ left: "todo due 27" }, { left: "todo due #27" }] },
    ],
  },
  clear: {
    title: "todo due <todo> clear",
    subtitle: "remove a due date and its reminder",
    sections: [
      { heading: "Usage", rows: [{ left: "todo due <todo> clear" }, { left: "todo due <todo> remove" }] },
      {
        heading: "Details",
        rows: [
          { left: "Removes the due date and cancels its scheduled reminder." },
          { left: "The todo itself is kept. `clear` is the canonical spelling." },
        ],
      },
      { heading: "Examples", rows: [{ left: "todo due 27 clear" }] },
    ],
  },
  reset: {
    title: "todo due <todo> reset",
    subtitle: "rearm the notification without changing the due date",
    sections: [
      { heading: "Usage", rows: [{ left: "todo due <todo> reset" }] },
      {
        heading: "Details",
        rows: [
          { left: "Clears the fired state of the current schedule so it can notify again." },
          { left: "The due date, sound, and trigger command are all left alone." },
          { left: "An already-overdue reminder fires again on the scheduler's next cycle." },
        ],
      },
      { heading: "Examples", rows: [{ left: "todo due 27 reset" }] },
    ],
  },
  daemon: {
    title: "todo due daemon",
    subtitle: "the background scheduler that delivers reminders",
    sections: [
      {
        heading: "Usage",
        rows: [{ left: "todo due daemon run" }, { left: "todo due daemon install" }, { left: "todo due daemon status" }],
      },
      {
        heading: "Details",
        rows: [
          { left: "One scheduler handles every reminder; there is no process per todo." },
          { left: "`install` writes a systemd user service and enables it, so reminders survive a reboot." },
          { left: "`run` stays in the foreground and is what the service starts." },
          { left: "Any `todo` command also delivers overdue reminders, so this is a delivery" },
          { left: "guarantee rather than a requirement." },
        ],
      },
      { heading: "Examples", rows: [{ left: "todo due daemon install" }, { left: "todo due daemon status" }] },
    ],
  },
};
