# Music and sound effects

The sound for joelleortiz.me: an original 48-bar lo-fi loop (written as MIDI by a script, rendered with FluidSynth, given a lo-fi treatment in Python and mastered into a seamless 128-second loop), the scene's sound effects, and the audio module that plays them.

| Path                                     | What it is                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| `music/lofi-loop.mid`                    | The composition: Type 1, 480 PPQ, one track per instrument, ends on the loop point |
| `music/previews/*.mp3`                   | Review renders of the variations (not committed). The site uses C2                 |
| `static/audio/lofi-loop.{ogg,m4a}`       | The loop the site plays: Opus and AAC, each exactly 6,144,000 samples at 48 kHz    |
| `static/audio/sfx/<sound>-<n>.{ogg,m4a}` | Sound effects, one pair per variation                                              |
| `static/audio/CREDITS.md`                | Where every sound came from                                                        |
| `src/lib/audio/`                         | The audio module the site imports (`index.ts`)                                     |
| `src/routes/dev/audio/`                  | The `/dev/audio` sound board, available only under `npm run dev`                   |
| `scripts/music/`                         | The scripts below                                                                  |
| `music/work/`                            | Ignored by git: the SoundFont, WAV stems and masters. Safe to delete               |

## Set up

```sh
brew install fluid-synth ffmpeg
python3 -m venv scripts/music/.venv
scripts/music/.venv/bin/pip install -r scripts/music/requirements.txt   # mido, numpy, scipy
```

The first render downloads the SoundFont into `music/work/soundfonts/`.

## Re-render the loop

```sh
py=scripts/music/.venv/bin/python

$py scripts/music/compose.py                         # music/lofi-loop.mid (preview C2)
$py scripts/music/render.py --export static/audio    # master in music/work/main, then the .ogg and .m4a
$py scripts/music/check_loop.py static/audio/lofi-loop.ogg static/audio/lofi-loop.m4a
$py scripts/music/previews.py C2                     # preview MP3s, by name or all of them
```

A render takes about 20 seconds and about 4 GB of memory. The export measures each file and re-limits it if lossy encoding pushes the true peak above −1.5 dBTP.

If a browser ever clicks at the loop point, `render.py --wrap-ms 100` encodes the Opus file with the loop's own audio wrapped round both ends. It makes the junction smoother but puts slightly more codec noise in the last few milliseconds, so it is off by default.

## Tweak the loop

- **Tempo, key, length, lead instrument, seed, harmony:** the constants at the top of `compose.py`, or `--tempo`, `--key`, `--bars`, `--lead`, `--seed` and `--colour`. `BARS` must be a multiple of 4 and at least 40; it stretches the main groove (A″). The seed drives the humanisation and small choices such as comping patterns, ghost notes and bass approach notes.
- **Harmony colour:** `borrowed` uses G-minor colours (♭VII in B; iv and ♭III in the breakdown). `bright-b`, the site's choice, makes B diatonic. `diatonic` also makes the breakdown diatonic, and `diatonic-e` also replaces the E7♭9 in bars 15 and 39. Bars whose harmony doesn't change come out note-for-note the same in every colour.
- **Chords and melody:** `CHORDS` holds the voicings, the `*_CHART` lists hold the progression one bar per entry, and `P` holds the lead phrases as `beat:length:pitch`.
- **Mix:** the constants at the top of `render.py` and the per-stem chain in `process()`.
- **Crackle:** `CRACKLE` in `crackle.py` (offline, for previews) and in `src/lib/audio/crackle-worklet.ts` (live). Keep them in sync.

## Sound effects

| Sound         | Plays on                                         | Variations         | Made by                                     |
| ------------- | ------------------------------------------------ | ------------------ | ------------------------------------------- |
| key tap       | `type`                                           | 8                  | Synthesised live (`src/lib/audio/synth.ts`) |
| blip on / off | sound on and `palette-change` / sound off        | 1 each             | Synthesised live (`src/lib/audio/synth.ts`) |
| sticker       | `sticker-hover` (14 dB quieter), `sticker-click` | 2                  | `sfx.py`                                    |
| cup-down      | `cup-down`                                       | 2                  | `sfx.py`                                    |
| sip           | `sip`                                            | 3                  | `sfx.py`                                    |
| purr          | starts on `pet-start`, fades out on `pet-end`    | 1, a seamless loop | `sfx.py`, placeholder                       |
| pet-trill     | `pet-start`                                      | 3                  | `sfx.py`, placeholder                       |
| sleepy-chirp  | `margot-wake`                                    | 3                  | `sfx.py`, placeholder                       |
| stretch-yawn  | `margot-stretch`                                 | 1                  | `sfx.py`, placeholder                       |
| meow-soft     | `palette-open`                                   | 2                  | `sfx.py`, placeholder                       |

Files are `static/audio/sfx/<sound>-<n>.ogg` and `.m4a`, numbered from 1. They are mono, 48 kHz, with 8 ms fades and a true peak of −3 dBTP or lower. One-shots are normalised to −20 LUFS (the loudest 400 ms); very transient ones (sticker, cup-down) reach their peak limit first and sit a few dB lower. The purr is −26 LUFS. Each length is a whole number of 1,024-sample AAC frames, so both formats decode to exactly the same length. The site picks one variation at random each time, with ±3% pitch and ±2 dB.

`scripts/music/sfx.py` regenerates the synthesised set and `src/lib/audio/sfx-manifest.ts`, the list of files the module loads.

## Replace a sound

1. Get the new audio in any format ffmpeg reads (wav, mp3, m4a, flac and so on), one file per variation. Recordings don't need cleaning up first.
2. Run the import script with the sound's name and the files:

   ```sh
   $py scripts/music/import_sfx.py pet-trill ~/Downloads/trill-1.mp3 ~/Downloads/trill-2.mp3 ~/Downloads/trill-3.mp3
   $py scripts/music/import_sfx.py purr ~/Desktop/myles-purring.m4a --start 12 --length 8
   ```

   It removes the sound's old files, then trims silence, converts to mono 48 kHz, reduces steady background noise, fades, normalises, encodes both formats, checks their decoded lengths and peaks, and rewrites the manifest. For the purr it picks quiet loop points in the excerpt, crossfades them and high-passes at 40 Hz. `--gain -3` makes a sound 3 dB quieter than the standard level, and `--no-denoise` skips the noise reduction.

3. Update the sound's row in `static/audio/CREDITS.md`.
4. Run `npm run check` (it checks that every file in the manifest exists), then listen on the sound board.

## Test on the sound board

`npm run dev`, then open `/dev/audio`. It has the sound toggle, a button per scene event, a 3-second typing burst, the time-of-day selector with the crossfade length, and a live level and status readout.

## How the loop stays seamless

- FluidSynth renders the 48 bars back to back (a warm-up pass, the pass that is kept, and the start of a third pass), so tails from bar 48 carry into bar 1.
- `render.py` drives libfluidsynth directly and places each event at an exact sample from the nominal tempo. A MIDI file can only store 666,667 µs per beat, which drifts by 3 samples per loop.
- Every LFO completes a whole number of cycles per loop, and the limiter wraps round the loop.
- The first 100 ms of the kept pass is crossfaded from the start of the third pass, the true continuation of its last sample.
- The site plays the decoded buffer with `loop = true` and `loopEnd = 128.0`, never `<audio loop>`.

## The composition

90 BPM, 4/4, straight eighths, G major, 48 bars = 128.0 s. As used on the site (`bright-b`):

| Bars  | Section    | Chords                                                            | What happens                                                                         |
| ----- | ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 1–8   | A          | Cmaj9 · D6/9 · Bm7 · Em9 · Cmaj9 · D6/9 · Bm7 E7♭9 · Am9 D9sus4   | Keys, bass, soft drums with side-stick                                               |
| 9–16  | A′         | as A                                                              | The vibraphone motif enters                                                          |
| 17–24 | B          | Cmaj9 · D9 · Gmaj9 · A9sus4 A9 · Cmaj9 · D9sus4 · Em9 · A9sus4 A9 | Snare, shaker sixteenths; the lead answers itself across registers                   |
| 25–28 | Breakdown  | Cmaj9 · Cm6 · Bm7 · B♭maj7♯11                                     | Drums and bass out, a warm pad, everything filtered darker, opening up again into A″ |
| 29–40 | A″         | A's bars 1–4 twice, then A's bars 5–8                             | Full groove, the lead returns varied                                                 |
| 41–48 | Turnaround | Cmaj9 · D6/9 · Bm7 · Em9 · Cmaj9 · Bm7 · Am9 · Dm9 G13            | Thins out; a soft lead run and a snare pickup lead back into bar 1                   |

The lead motif is a two-bar call and response: a rising arpeggio off the downbeat (D–G–B–D over Cmaj9), answered long–short–short–long.

## SoundFont and licence

[GeneralUser GS](https://www.schristiancollins.com/generaluser) v2.0.3 by S. Christian Collins, from its [GitHub repository](https://github.com/mrbumpy409/GeneralUser-GS). Its licence says "You may use GeneralUser GS without restriction for your own music creation, private or commercial", so the rendered audio can be published. The SoundFont itself is not redistributed here.
