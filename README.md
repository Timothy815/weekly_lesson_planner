# Cybersecurity Weekly Lesson Planner

An editable lesson planner for three daily 90-minute cybersecurity class slots. It includes the complete Monday–Friday routine, shortened-week controls, full-week and projection-friendly daily views, editable daily learning objectives, linked activity resources, movable lesson cards, completion tracking, selective day/week JSON imports, weekly planning notes, portable backups, Markdown export, and printable daily or weekly records.

## Daily view

Use **Day view** in the planner controls, then select an active school day. Each class slot keeps its own learning objective for every day. The larger daily layout can be edited normally or expanded with **Enter full screen** for classroom projection.

## Edit and display modes

- **Edit** shows objective fields, completion controls, activity editors, and drag handles.
- **Display** turns objectives and activities into polished read-only classroom cards while keeping resource links available.
- Fullscreen presentation automatically uses the display treatment.

In Edit mode, drag an activity card onto another day or onto a Day View tab to move it. Drag a day header onto another day to safely swap both complete plans—including their learning objectives—without overwriting either plan. On touch devices, an activity’s editor also includes a **Scheduled day** menu.

## Local and portable data

The planner saves automatically in the browser. Each browser and computer has its own local copy.

- **Export JSON** creates a portable backup.
- **Import JSON** opens that plan on another computer.
- **Export readable Markdown** creates a human-readable archive.
- The PDF commands open the browser print window; choose **Save as PDF**.

Clearing browser data can erase the local copy, so keep periodic JSON exports.

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
