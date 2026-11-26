/* Memory methods for each topic. `hear` buttons play a short example; `recall` is cover-and-check practice. */
(function (g) {
  const AT = g.AT;
  const M = (...n) => ({ melodic: n });      // notes one after another
  const H = (...n) => ({ harmonic: n });     // notes together

  AT.learning = [
    { title: "How to study (works for everything below)", outcome: 0,
      cards: [
        { name: "Test yourself before you read the answer",
          body: "Hearing a sound and guessing first is what builds memory. Reading the answer straight away feels easier but sticks far less. In Practice, commit to a choice before you press continue, and say why.",
          tip: "Practice works like the test: answers appear only at the end, so commit to each choice." },
        { name: "Little and often beats one long session",
          body: "Ten minutes a day for a week beats an hour the night before. Sleep is when your ear stores what you practised. Do your weakest topic first, while you are fresh.",
          tip: "Check the Progress page and pick the topic with the lowest bar." },
        { name: "Sing or hum it back",
          body: "If you can sing an interval or a chord's notes, you really know it. Hum the first note, then the second. Your voice remembers the gap in a way your eyes cannot.",
          tip: "After a wrong answer, replay the sound twice and sing it before moving on." },
        { name: "Keep a mistakes list",
          body: "After a mock, look at what you missed. Most people repeat the same two or three mix-ups (for example 4th and 5th). Name your mix-up and compare those two sounds back to back.",
          tip: "Write the pair on a sticky note: \"4th = Here Comes the Bride, 5th = Twinkle\"." },
        { name: "Teach it to someone",
          body: "Explaining how you tell a major triad from a minor one to a friend shows you straight away what you do not yet know.", tip: "" },
      ] },

    { title: "Intervals", outcome: 1,
      cards: [
        { name: "The semitone ladder: 0 2 4 5 7 9 11 12",
          body: "Every interval in this unit is a step of the major scale from the bottom note. Learn the numbers 0, 2, 4, 5, 7, 9, 11, 12 as one chant, like a phone number. Each one is the gap in semitones.",
          tip: "The gaps between the numbers are 2 2 1 2 2 2 1, the same as T T S T T T S." },
        { name: "Work out the hard ones from the easy ones",
          body: "6th = a 5th plus a tone (7 + 2). 7th = an octave minus a semitone (12 - 1). If you are unsure between 6th and 7th, ask: does it feel almost at the top (7th) or a comfortable way up (6th)?",
          hear: [["Major 6th", M(60, 69)], ["Major 7th", M(60, 71)]], tip: "" },
        { name: "Judge how wide it feels",
          body: "Sort sounds into close (2nd, 3rd), middle (4th, 5th) and wide (6th, 7th, octave) first. Then choose inside that group. This halves the number of options before you start.",
          tip: "" },
      ],
      recall: [["How many semitones in a perfect 5th?", "7"], ["Which interval is 9 semitones?", "Major 6th"], ["Which interval is one semitone short of the octave?", "Major 7th"], ["Song for a perfect 4th?", "Here Comes the Bride (or your own anchor)"]] },

    { title: "Scales and tonality", outcome: 1,
      cards: [
        { name: "Say the pattern as a rhythm",
          body: "Chant the patterns out loud so they become a tune: Major \"T T S T T T S\", melodic minor \"T S T T T T S\", harmonic minor \"T S T T S three S\". The rhythm of the words is what you remember.",
          list: ["Major: T T S T T T S", "Melodic minor: T S T T T T S", "Harmonic minor: T S T T S 3 S"],
          hear: [["Major up", M(60, 62, 64, 65, 67, 69, 71, 72)], ["Melodic minor up", M(60, 62, 63, 65, 67, 69, 71, 72)], ["Harmonic minor up", M(60, 62, 63, 65, 67, 68, 71, 72)]],
          tip: "Notice only the 3rd changes between major and melodic minor going up." },
        { name: "Listen for the odd gap",
          body: "Harmonic minor has one unmistakable sound: a big \"snake charmer\" jump between the 6th and 7th notes. If you hear that, you are done. Melodic minor sounds like a major scale with a darker start. Going down, melodic minor drops back to natural minor.",
          hear: [["Harmonic minor up", M(60, 62, 63, 65, 67, 68, 71, 72)], ["Melodic minor down", M(72, 70, 68, 67, 65, 63, 62, 60)]],
          tip: "Up and down are different for melodic minor only. Ask yourself whether it came up or down." },
        { name: "Major or minor: find home, then check the 3rd",
          body: "Do not decide by happy or sad alone. Hum the note that feels like home (it is where the phrase wants to end). Then sing the note a third above it: a bright 3rd is major, a darker 3rd is minor.",
          tip: "Minor tunes can still end on a raised 7th leading up to home, so a bright ending does not prove major." },
      ],
      recall: [["Major scale pattern?", "T T S T T T S"], ["Which minor scale has a three-semitone gap?", "Harmonic minor"], ["Melodic minor coming down is the same as...?", "Natural minor"]] },

    { title: "Triads and seventh chords", outcome: 2,
      cards: [
        { name: "Big step first or small step first",
          body: "Both triads are the same pair of gaps in a different order. Major: 4 then 3. Minor: 3 then 4. Listen only to the lower gap, the one between the root and the 3rd. If it is wide, the chord is major.",
          hear: [["Major triad", H(60, 64, 67)], ["Minor triad", H(60, 63, 67)], ["Major (broken)", M(60, 64, 67)], ["Minor (broken)", M(60, 63, 67)]],
          tip: "\"Major is Massive at the bottom\"." },
        { name: "A decision tree for chord type",
          body: "Work down the list the same way every time:",
          list: [
            "1. Count the notes. Three notes: it is a triad, so decide major or minor from the 3rd.",
            "2. Four notes: listen to the 3rd again. Dark 3rd means minor 7th.",
            "3. Bright 3rd plus a smooth, dreamy top note: major 7th.",
            "4. Bright 3rd plus a tense, bluesy top note that leans forward: dominant 7th.",
          ],
          hear: [["Major", H(60, 64, 67)], ["Minor", H(60, 63, 67)], ["Major 7th", H(60, 64, 67, 71)], ["Minor 7th", H(60, 63, 67, 70)], ["Dominant 7th", H(60, 64, 67, 70)]],
          tip: "Hearing the 3rd first removes two of the five options immediately." },
        { name: "Name each 7th by its feeling and its sum",
          body: "Major 7th: major triad + major 7th, floaty. Minor 7th: minor triad + minor 7th, mellow. Dominant 7th: major triad + minor 7th, wants to go somewhere. Minor 7th and dominant 7th share the same top gap, so they can sound alike: the 3rd tells them apart.",
          hear: [["Minor 7th", H(60, 63, 67, 70)], ["Dominant 7th", H(60, 64, 67, 70)]],
          tip: "Play minor 7th then dominant 7th back to back until you can hear only the 3rd change." },
      ],
      recall: [["Major triad gaps?", "4 + 3 semitones"], ["Minor triad gaps?", "3 + 4 semitones"], ["Dominant 7th is...?", "Major triad with a minor 7th"], ["Which 7th chords have a minor 3rd?", "Minor 7th only"]] },

    { title: "Chord numbers and progressions", outcome: 2,
      cards: [
        { name: "Capitals are major, lower case are minor",
          body: "Remember the majors as 1, 4, 5 and the minors as 2, 3, 6. Say it as \"145 are loud, 236 are quiet\". The test uses only these numerals.",
          list: ["I, IV, V: major", "ii, iii, vi: minor"], tip: "" },
        { name: "Follow the bass, not the whole chord",
          body: "The lowest note usually names the chord root. Sing the bass line of the progression, then match each note to a number in the key. Three or four notes are far easier to hold in your head than three or four chords.",
          tip: "Find the key first: the first chord is usually I." },
        { name: "Learn progressions as tunes, not lists",
          body: "Chant them with the feeling they give: I - IV - V is home, away, tension. I - V - vi - IV is the four-chord pop loop. ii - V - I is the jazz \"pull home\". Once you know these three shapes, most questions are one of them.",
          list: ["I - IV - V", "I - V - vi - IV", "ii - V - I"],
          tip: "Notice that V almost always wants to go to I. If the last chord sounds like a landing, it is I." },
      ],
      recall: [["Which numbers are major?", "I, IV, V"], ["Which numbers are minor?", "ii, iii, vi"], ["Which progression is the four-chord pop loop?", "I - V - vi - IV"]] },

    { title: "Rhythm and time signatures", outcome: 3,
      cards: [
        { name: "Find the beat, then ask 2 or 3",
          body: "Tap the main pulse with your foot first. Then count how many taps make a bar. Then ask whether each tap feels like it splits into 2 (simple) or 3 (compound).",
          list: ["4/4: 1 & 2 & 3 & 4 &", "3/4: 1 & 2 & 3 & (a waltz: ONE two three)", "6/8: ONE la li TWO la li (2 big beats)", "9/8: ONE la li TWO la li THREE la li (3 big beats)"],
          tip: "6/8 feels like a rocking boat in two; 9/8 like a rocking boat in three." },
        { name: "Use words for the subdivisions",
          body: "Say \"straw-ber-ry\" for a group of three quavers and \"ap-ple\" for a group of two. A 6/8 bar is \"straw-ber-ry straw-ber-ry\". A 4/4 bar of quavers is \"ap-ple ap-ple ap-ple ap-ple\". Hearing which fruit fits tells you the signature.",
          tip: "Fruit words give your mouth the rhythm, which beats counting in your head." },
        { name: "Dotted rhythms: long-short, long-short",
          body: "A dot adds half. A dotted quaver followed by a semiquaver sounds like a limping \"DUM-da DUM-da\". Say \"Hap-py Birth-day\" with the first syllable long: that lilt is a dotted rhythm.",
          tip: "If it sounds even like a march, it is not dotted. If it swings, it is." },
      ],
      recall: [["How many main beats in 6/8?", "2"], ["How many main beats in 9/8?", "3"], ["A dot adds how much?", "Half the note's value"]] },
  ];

  /* Sound hooks: something familiar to tie each interval and progression to.
     `tune` is [midi notes, seconds between them] and is only given for old, public domain melodies. */
  AT.hooks = {
    intervals: [
      { name: "Unison", semis: 0, hook: "Happy Birthday", cue: "\"Hap-py\": the same note twice.", tune: [[67, 67, 69, 67, 72, 71], 0.4] },
      { name: "Major 2nd", semis: 2, hook: "Fr\u00e8re Jacques", cue: "\"Fr\u00e8-re\": one small step up.", tune: [[60, 62, 64, 60], 0.45] },
      { name: "Major 3rd", semis: 4, hook: "When the Saints Go Marching In", cue: "\"Oh when\": a bright skip.", tune: [[60, 64, 65, 67], 0.45] },
      { name: "Perfect 4th", semis: 5, hook: "Here Comes the Bride", cue: "\"Here comes\": strong, like an announcement.", tune: [[55, 60, 60, 60], 0.5] },
      { name: "Perfect 5th", semis: 7, hook: "Twinkle Twinkle Little Star", cue: "The jump from the first \"twinkle\" to the second: wide and open.", tune: [[60, 60, 67, 67, 69, 69, 67], 0.4] },
      { name: "Major 6th", semis: 9, hook: "My Bonnie Lies Over the Ocean", cue: "\"My Bon-\": a warm, wide leap.", tune: [[55, 64, 62, 60, 62, 60, 57, 55], 0.4] },
      { name: "Major 7th", semis: 11, hook: "Just short of Somewhere Over the Rainbow", cue: "Tense and itching to rise one more semitone to the octave." },
      { name: "Octave", semis: 12, hook: "Somewhere Over the Rainbow", cue: "\"Some-where\": a big leap to the same note, higher." },
    ],
    progressions: [
      { chords: ["I", "IV", "V"], hook: "Twist and Shout", cue: "Home, away, tension. It stops before getting home." },
      { chords: ["I", "V", "IV"], hook: "Baba O'Riley (The Who)", cue: "Home, tension, then it relaxes back a step." },
      { chords: ["ii", "V", "I"], hook: "Autumn Leaves (opening)", cue: "Starts minor, pulls, lands home." },
      { chords: ["I", "IV", "V", "I"], hook: "The end of a hymn or anthem", cue: "A complete journey: home, away, tension, home." },
      { chords: ["I", "V", "vi", "IV"], hook: "Let It Be (The Beatles)", cue: "The pop loop: the sad chord comes third." },
      { chords: ["I", "vi", "IV", "V"], hook: "Stand By Me (Ben E. King)", cue: "The 1950s loop: the sad chord comes second." },
      { chords: ["vi", "IV", "I", "V"], hook: "Zombie (The Cranberries)", cue: "Starts sad, on a minor chord." },
      { chords: ["I", "vi", "ii", "V"], hook: "Blue Moon", cue: "Two minor chords in the middle, ends wanting home." },
      { chords: ["I", "iii", "IV", "V"], hook: "Say: home, soft, lift, wait", cue: "The second chord is a gentle minor, then it climbs." },
      { chords: ["I", "IV", "vi", "V"], hook: "Say: home, away, sad, wait", cue: "The minor chord comes third, then V leaves it hanging." },
    ],
  };

  AT.learningIntro = {
    title: "Learning methods",
    text: "Techniques for remembering what the exam asks, in the order of the three outcomes. Press a button to hear an example, then use \"Cover and recall\" at the bottom of a topic to check what you remember.",
  };
})(typeof window !== "undefined" ? window : globalThis);
