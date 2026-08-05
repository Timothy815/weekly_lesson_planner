# Cybersecurity Weekly Lesson Planner

An editable lesson planner for three daily 90-minute cybersecurity class slots. It includes the complete Monday–Friday routine, shortened-week controls, full-week and projection-friendly daily views, editable daily learning objectives, linked activity resources, movable lesson cards, completion tracking, selective day/week JSON imports, weekly planning notes, portable backups, Markdown export, and printable daily or weekly records.

## Daily view

Use **Day view** in the planner controls, then select an active school day. Each class slot keeps its own learning objective, desired outcome, and daily product for every day. Activities appear as one chronological, full-width vertical sequence. The larger daily layout can be edited normally or expanded with **Enter full screen** for classroom projection.

Use **Slot times** to enter the real start time for each of the three class slots. The app automatically projects and displays the end time 90 minutes later. Slot tabs, status information, activity cards, printable plans, and readable Markdown show the complete clock window. Activity ranges still follow their actual accumulated durations, including plans that run over 90 minutes. The slot times remain in place when starting a new week or restoring the routine template.

In Display mode, the selected day’s activity matching the current clock time is highlighted when its calendar date and slot start time match. Turn on **Cues** in the Day View toolbar for a gentle two-note reminder at activity transitions. Sound cues are optional, off by default, and last only for the current browser session.

PDF printing uses portrait pages throughout. Daily plans use a compact layout designed to keep a standard 90-minute plan, its heading, and its Daily Product together on one page; weekly plans and generated Weekly Summaries continue naturally onto additional portrait pages when needed.

## Edit and display modes

- **Edit** shows editable day-header subtitles, desired outcomes, daily products, objective fields, completion controls, activity editors, and drag handles.
- **Display** turns day headers, outcomes, products, objectives, and activities into polished read-only classroom cards while keeping resource links available.
- Fullscreen presentation automatically uses the display treatment.

Use **Undo** and **Redo** in the planner controls to reverse or reapply planner changes. Keyboard shortcuts are also supported: `Ctrl/Command+Z` to undo and `Ctrl/Command+Shift+Z` (or `Ctrl+Y`) to redo. The history covers typing, imports, restores, activity moves, and complete-day swaps for the current browser session.

In Edit mode, drag an activity card onto another day or onto a Day View tab to move it. Drag a day header onto another day to safely swap both complete plans—including their header subtitle, desired outcome, daily product, and learning objective—without overwriting either plan. On touch devices, an activity’s editor also includes a **Scheduled day** menu.

## Weekly summary

Open **Weekly summary** for a report generated directly from the selected class slot’s current plan. It automatically collects the week and class, day and activity counts, planned minutes, learning objectives, desired outcomes, daily products, chronological activity sequences, and working resource links. Editing any day or activity updates the report automatically, so none of that information needs to be entered again.

Use **Print / save PDF** at the bottom of the Weekly Summary to produce a paper-friendly report. The print version includes resource names and full web addresses so links remain useful in a PDF or on paper.

Topic, central question, certification notes, lab context, and similar week-level details are optional. Add them under **Edit optional week-level context** only when they provide information that cannot be inferred reliably from the lesson plans.

## Finish a day and move into next week

Use **Finish day** to record what happened in a class slot. Choose any unfinished activities that should move to a later school day or be held for next week, then optionally save a private reflection and a precise resume point. The planner preserves a teaching record containing the objective, day details, activity snapshot, completion state, and rollover decision. Recorded days can be reviewed or updated from their day column, and the records are included in JSON archives and readable Markdown exports.

Use **Start next week** to advance the calendar by seven days. The new week can carry unfinished activities into the first school day, copy the current week’s complete structure with fresh completion states, or begin from the routine template. The weekly brief can be carried forward separately. When the Google Drive archive folder is connected, the current week is archived automatically before the transition; if archiving fails, the planner does not replace the current week. The transition can also be undone during the current session.

## Reusable lesson library

Open **Library** to search and reuse saved activities, complete day plans, and complete week structures. Set a target class slot and day before inserting an activity or applying a saved day. Activity editors include **Save to library**, every day column includes **Save day**, and the library manager can capture the current week. Reused activities receive fresh IDs and completion states. Replacing a day or week requires confirmation and remains undoable.

The reusable library is part of the planner’s durable data. It is preserved when starting a new week or restoring the routine template, included in JSON exports and Google Drive week archives, and merged safely when a complete backup or archived week is restored.

## Local and portable data

The planner saves automatically in the browser. Each browser and computer has its own local copy.

- **Export JSON** creates a portable backup.
- **Import JSON** opens that plan on another computer.
- **Export readable Markdown** creates a human-readable archive.
- The PDF commands open the browser print window; choose **Save as PDF**.

Clearing browser data can erase the local copy, so keep periodic JSON exports or use the folder-backed archive.

## Google Drive week archive

In Chrome or Edge, open **Archive**, choose **Connect archive folder**, and select the **Weekly Lesson Planner Archive** folder inside Google Drive for desktop. Enter an archive title, then use **Archive current week** to create a timestamped JSON snapshot whose filename includes that title. The archive lists saved weeks with rename, restore, and delete controls. Older archive files without titles receive a sensible title based on their topic or week date.

The folder connection is remembered for convenience, while the archive files themselves remain in Google Drive. If browser data is cleared or permission expires, open **Archive**, reconnect the same folder, and the saved-week list will be rebuilt from those files. Browsers without folder access retain the normal **Download JSON backup** fallback.

## AI-assisted planning

Open **More** and download either the AI day or AI week JSON template. Give the file to GPT, Claude, Gemini, or another AI and ask it to build the lesson while preserving the JSON structure and allowed category names. Import the completed file, review its contents, choose any combination of included days, select the destination class slot, and decide whether to apply its date and weekly brief.

Full planner backups use the same review screen. You can copy selected days between slots or choose **Restore the complete backup** to replace the entire local planner.

Activity cards can include multiple labeled links. Open a card, use **Add link**, and enter the resource label and web address. Links are included in planner backups and readable Markdown exports.

## Publish with GitHub Pages

1. Create an empty GitHub repository.
2. Upload all files and folders from this project to the repository root.
3. Commit the files to the `main` branch.
4. Open **Settings → Pages** in the repository.
5. Under **Build and deployment**, select **GitHub Actions** if necessary.
6. Open **Actions** and wait for **Deploy Cybersecurity Planner to GitHub Pages** to finish.

The included workflow automatically rebuilds the site whenever `main` changes.

## Run locally

Install Node.js 22 or newer, then run:

```bash
npm install
npm run dev
```

To test the production build:

```bash
npm run build
```

The static site will be created in `github-dist/`.
