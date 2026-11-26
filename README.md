# Aural Skills (SCQF level 5, unit F58L 11)

A static website for practising the listening skills in the SCQF level 5 Music: Aural Skills unit, and for sitting a
timed mock paper marked the way the unit is marked. No build step, no dependencies, no server of its own: just HTML, CSS and
JavaScript (optional accounts use Supabase). All sounds are generated in the browser with the Web Audio API, so there are no audio files. Headphones recommended.

## What it covers

Topics follow the unit's three outcomes and performance criteria:

- **Outcome 1, intervals, scales and tonality (20 marks, pass 14):** ascending intervals (unison, major 2nd, major 3rd,
  perfect 4th and 5th, major 6th and 7th, octave); major, melodic minor and harmonic minor scales going up and down;
  major or minor four-bar phrases.
- **Outcome 2, triads, chords and progressions (20 marks, pass 14):** major and minor triads, melodic and harmonic;
  chords (major, minor, major 7th, minor 7th, dominant 7th); three and four chord progressions named by Roman numeral (I, ii, IV, V, vi).
- **Outcome 3, rhythms and time signatures (10 marks, pass 7):** one-bar rhythms in 4/4, 3/4, 6/8 and 9/8 including dotted rhythms; 4/4, 3/4, 6/8 and 9/8.

**Mock exam:** 50 questions, 45 minutes, closed book, each sound playable 3 times. Each outcome is marked on its own
against its pass mark. Fail one outcome and you resit only that section; fail all three and you get a fresh alternative paper.
There is no skipping, the menu is locked until the paper is finished, and answers appear only at the end.

**Practice:** the same rules as the test (3 plays, a timer, answers at the end), though you can leave a set early. A topic
set is 10 questions. Rhythm answers are written music. The review at the end shows a note display for each missed question.

**Lessons:** a teach-from-zero course (14 lessons: beat, note lengths, rests, dots, time signatures, intervals, scales, chords, progressions, exam technique). Each lesson explains, plays examples, asks check questions with sounds, then sends you to practice, and finished lessons come back for review after 1, 3, 7 and 21 days. **Learning** has memory tricks for each topic, including sound hooks that tie each interval and chord progression to a tune or phrase.

Sounds are a modelled piano and a small drum kit (kick, snare, hi-hat, rim, tom), all generated in the browser.

Also included: a **crib sheet** page (from the one-page revision sheet), the term's key dates,. Progress is saved in your own browser (localStorage). Nothing is sent anywhere unless you sign in.

Keyboard: `R` replay, `1`-`9` choose an answer, `Enter` lock in.

**Teacher mode:** add `?teacher` to the address to get a **Skip question** button (`S`) and an unlocked menu for that
browser tab (`?teacher=off` ends it). It is not password protected: anyone who knows the address can use it.

## Accounts (optional)

Everything works signed out. **Sign In to save your progress** creates an email and password account, and saves stats, mock
results, lessons, groups, streaks and the mistakes bank to it, so they follow you between devices. Theme and volume stay on
each device. Signing out puts back the signed-out progress, so a shared computer does not mix people's results.

One-time setup in the Supabase dashboard:

1. **SQL Editor:** run `supabase/setup.sql` (creates the table; each person can only reach their own row).
2. **Authentication > URL Configuration:** set **Site URL** to `https://aural.centralstores.net/` and add it to **Redirect URLs**.
3. **Email:** Supabase's built-in sender only delivers to your project's team members. For anyone else, add your own SMTP server
   under Authentication, or turn off **Confirm email** (then password reset emails still will not reach them).

The project address and publishable key are in `js/account.js`. They are public by design. Never put a secret or
`service_role` key in this site.

## What's new in v2

- **Today dashboard**: daily goal, practice streak, XP and levels, with one-click Smart practice (weakest topics first), a 10-question Daily challenge and a mistakes review.
- **Mistakes bank**: every wrong answer is saved with its sound; get it right in review and it leaves the bank.
- **Session builder**: pick any topics and a length.
- **Five extension topics** (not in the mock): descending intervals, cadences, melodic shape, simple vs compound beat, missing scale note.
- **Progress insights**: questions per day, 30-day accuracy trend, practice calendar, achievements (18).
- **Tools**: on-screen piano (also playable from the computer keyboard) and a metronome.
- **Settings**: volume, light/dark theme, daily goal, animations, backup and restore as JSON.
- **Installable and offline** (PWA: `manifest.webmanifest`, `sw.js`, `icon.svg`).

Still no build step, no server and no dependencies, so it deploys to GitHub Pages exactly as before. When you change files, bump `CACHE` in `sw.js` and the `?v=` numbers.

## Put it on GitHub Pages

**Option A: in the browser (no git needed)**

1. Create a new repository on github.com (for example `aural-trainer`), set to Public.
2. Click **Add file > Upload files** and drag in the *contents* of this folder
   (`index.html`, `style.css`, `CNAME`, `README.md` and the `js` folder).
   `index.html` must be at the top level of the repository, not inside another folder.
3. Commit the upload.
4. Go to **Settings > Pages**. Under **Build and deployment**, set **Source** to
   **Deploy from a branch**, choose branch **main** and folder **/ (root)**, then **Save**.
5. Wait a minute or two. The site appears at
   `https://YOUR-USERNAME.github.io/aural-trainer/` (the Pages settings page shows the exact link).

**Option B: with git**

```bash
cd aural-trainer-web
git init -b main
git add .
git commit -m "Aural Skills Trainer"
git remote add origin https://github.com/YOUR-USERNAME/aural-trainer.git
git push -u origin main
```

Then do step 4 above.

## Try it locally first

Just open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Troubleshooting

- **No sound:** check the volume and that the tab is not muted. Browsers only allow audio after
  a click, which the app handles by starting sound when you press a button. On iPhones, also
  turn off the silent-mode switch.
- **Page is blank after deploying:** `index.html` is probably inside a subfolder. Move it to the repository root.
- **Old version showing after an update:** hard-refresh (Ctrl+Shift+R).

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `style.css` | Page and styling |
| `js/theory.js` | Intervals, scales, chords and keys |
| `js/synth.js` | Web Audio sound engine: instruments, live level meter |
| `js/ex_pitch.js`, `js/ex_rhythm.js` | Question generators for Outcomes 1 to 3 |
| `js/notation.js` | Draws rhythm answers as notation (SVG) |
| `js/exercises.js` | Outcomes, pass marks, topics and the mock paper builder |
| `js/crib.js` | Crib sheet content |
| `js/progress.js` | Saved results and settings |
| `js/account.js` | Optional sign in and saving progress to an account |
| `supabase/setup.sql` | Database table and security rules for accounts |
| `js/app.js` | Screens and input |
