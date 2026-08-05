# Cybersecurity Weekly Lesson Planner

An editable lesson planner for three daily 90-minute cybersecurity class slots. It includes the complete Monday–Friday routine, shortened-week controls, movable lesson cards, completion tracking, weekly planning notes, portable JSON backups, Markdown export, and printable daily or weekly records.

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
