# Aural Skills Trainer (HNC Music, SCQF Level 5)

A static website for practising and testing the listening skills behind SCQF Level 5
(National 5) Music, as preparation for HNC Music entry. No build step, no dependencies,
no server: just HTML, CSS and JavaScript. All sounds are generated in the browser with the
Web Audio API, so there are no audio files. Headphones recommended.

## What it tests

14 topics in four groups:

- **Pitch & harmony:** tones and semitones, intervals, scales, chords, cadences, chord progressions.
- **Rhythm, tempo & dynamics:** metre (simple and compound), rhythm features (dotted, Scotch snap, syncopation), tempo changes, dynamics.
- **Texture & timbre:** bass patterns, melodic memory, instruments (piano, organ, guitar, strings, flute, clarinet, trumpet, marimba, bass).
- **Exam-style practice:** a mixed excerpt, where one extract is followed by linked questions (a), (b), (c).

Modes:

- **Practise a topic:** instant feedback, explanation, unlimited replays.
- **Entry check:** 29 questions (2 per topic plus a 3-part excerpt), 3 plays each. The 70% target is a
  self-check benchmark, not an official SQA or college mark.

**Real-time feedback:** a live level meter while the sound plays, a note roll with a moving playhead once
you have answered, a running score, accuracy and streak, a block-per-question progress strip, and a status
bar showing playback. In the entry check, **Live feedback** (on by default) shows right or wrong straight
after each answer; switch it off for exam conditions, where answers only appear at the end.

**Instruments:** every question is played on an instrument chosen at random to suit it (chords on
chord-capable instruments, fast rhythms on quick-attack ones). Use the **Instrument** menu to fix one
instrument for everything except the Instruments topic.

Progress and settings are saved in the visitor's own browser (localStorage). Nothing is sent anywhere.

Keyboard: `R` replay, `1`-`9` choose an answer, `Enter` continue (or lock in, in exam conditions).

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
| `index.html`, `style.css` | Page and styling (blocky dark theme) |
| `js/theory.js` | Scales, chords, cadences, intervals |
| `js/synth.js` | Web Audio sound engine: instruments, live level meter |
| `js/ex_pitch.js`, `ex_texture.js`, `ex_rhythm.js`, `ex_excerpt.js` | Question generators |
| `js/exercises.js` | Topic list and mock test builder |
| `js/progress.js` | Saved results and settings |
| `js/app.js` | Screens and input |
