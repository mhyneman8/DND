# DM Table

A campaign notebook for a dungeon master. It is a React + TypeScript app that installs as a PWA, so the same book can sit on a laptop at the table or on a tablet.

Without a Supabase project, everything is saved in this browser. Add the keys below when you want an account that syncs across devices.

## Run it

```bash
npm install
npm run dev
```

`npm run dev:host` serves it on your local network so a tablet on the same Wi-Fi can open it.

## Sync with Supabase

1. Create a Supabase project.
2. In Authentication, turn off email confirmation if you want to sign in immediately. Otherwise confirm the email before the first sign-in.
3. Open the SQL editor and run `supabase/schema.sql`. That creates the tables, row-level security, and the private `campaign-media` bucket.
4. Copy `.env.example` to `.env` and fill in the project URL and anon key.
5. Restart the dev server.

The anon key is meant to ship in the client. Row-level security limits each account to its own campaigns, notes, and images.

## Layout

Campaigns are the colored tabs along the top. Double-click a name to rename it, or use the tab menu to recolor it. Deleting a campaign, entry, image, list item, or link asks you to confirm first.

Home fills the workspace. Story Beats, PCs, NPCs, Monsters, Afflictions, Locations, Maps, and Misc / Magic Items open in a panel about a third of the width. Home, or the panel’s close button, puts that panel away.

Story Beats holds renameable subsections, each with a description. Inside a subsection you can log a session for a day and keep pending arcs. Mark an arc resolved, or flag it with Show on Home so it appears in the session-prep list.

Each player character opens as one sheet. It has a background, class and subclass with a link that opens Roll20 or another site in a new tab, and notes on how the subclass is developing. Alliances are added with Enter, then reordered or removed. Recent events carry a session tag. Checking a personal objective files that objective under recent events.

Each NPC opens in the same wide sheet: a description, motivations, and an affinity score. Raise or lower the score, and set the numbers where it turns red or green; anything between stays neutral. Alliances use the same list as player characters.

Other sections keep entries in alphabetical order inside each subsection. Notes use bold, italic, underline, and five highlight colors. Each entry can hold an image, a named list such as alliances, and links to other entries in the campaign.
