# Cybersecurity Weekly Lesson Planner

An editable lesson planner for three daily 90-minute cybersecurity class slots. It includes the complete Monday–Friday routine, shortened-week controls, full-week and projection-friendly daily views, editable daily learning objectives, movable lesson cards, completion tracking, weekly planning notes, portable JSON backups, Markdown export, and printable daily or weekly records.

## Daily view

Use **Day view** in the planner controls, then select an active school day. Each class slot keeps its own learning objective for every day. The larger daily layout can be edited normally or expanded with **Enter full screen** for classroom projection.

## Local and portable data

The planner saves automatically in the browser. Each browser and computer has its own local copy.

- **Export JSON** creates a portable backup.
- **Import JSON** opens that plan on another computer.
- **Export readable Markdown** creates a human-readable archive.
- The PDF commands open the browser print window; choose **Save as PDF**.

Clearing browser data can erase the local copy, so keep periodic JSON exports.

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
