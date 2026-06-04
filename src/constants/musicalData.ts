/**
 * musicalData.ts
 * All static instrument, genre, sub-style, vibe, and suggestion data used by
 * MusicalParamsPanel. Keeping data separate from the component eliminates the
 * "god component" mixing of data, logic and render in a single file.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InstrumentOption {
  name: string;
  icon: string;
}

export interface VibeTile {
  name: string;
  emoji: string;
  bpm: number;
  rhythm: string;
  instruments: string[];
}

export interface VibeCategory {
  id: string;
  label: string;
  color: string;
  summary: string;
  artists: string[];
  moods: string[];
  era: string;
  tiles: VibeTile[];
}

export interface SubStyleEntry {
  name: string;
  description: string;
  bpmOffset: number;
  mood: string;
  signature: string;
  addInstruments: string[];
}

// ─── BPM presets ─────────────────────────────────────────────────────────────

export const BPM_PRESETS = [
  { label: 'Very Slow', value: 60 },
  { label: 'Slow',      value: 80 },
  { label: 'Moderate',  value: 100 },
  { label: 'Upbeat',    value: 120 },
  { label: 'Fast',      value: 140 },
  { label: 'Very Fast', value: 160 },
] as const;

// ─── Instrument families ─────────────────────────────────────────────────────

export const INSTRUMENT_FAMILIES: { emoji: string; label: string; instruments: InstrumentOption[] }[] = [
  { emoji: '\uD83C\uDFBA', label: 'Brass', instruments: [
    { name: 'Trumpet', icon: '🎺' }, { name: 'Trombone', icon: '🎺' }, { name: 'French Horn', icon: '📯' },
    { name: 'Tuba', icon: '🎺' }, { name: 'Cornet', icon: '🎺' }, { name: 'Flugelhorn', icon: '🎺' },
    { name: 'Euphonium', icon: '🎺' }, { name: 'Sousaphone', icon: '🎺' }, { name: 'Brass Section', icon: '🎺' },
    { name: 'Muted Trumpet', icon: '🎺' },
  ] },
  { emoji: '\uD83C\uDFBB', label: 'Strings', instruments: [
    { name: 'Violin', icon: '🎻' }, { name: 'Alto Violin', icon: '🎻' }, { name: 'Viola', icon: '🎻' },
    { name: 'Cello', icon: '🎻' }, { name: 'Double Bass', icon: '🎻' }, { name: 'Harp', icon: '🎼' },
    { name: 'Mandolin', icon: '🪕' }, { name: 'Banjo', icon: '🪕' }, { name: 'Ukulele', icon: '🎸' },
    { name: 'Fiddle', icon: '🎻' }, { name: 'String Ensemble', icon: '🎻' }, { name: 'Pizzicato Strings', icon: '🎻' },
    { name: 'Lute', icon: '🪕' }, { name: 'Lyre', icon: '🎼' },
  ] },
  { emoji: '\uD83C\uDFB8', label: 'Guitar', instruments: [
    { name: 'Acoustic Guitar', icon: '🎸' }, { name: 'Electric Guitar', icon: '⚡️' },
    { name: 'Bass Guitar', icon: '🎸' }, { name: 'Twelve-String Guitar', icon: '🎸' }, { name: 'Baritone Guitar', icon: '🎸' },
    { name: 'Nylon Guitar', icon: '🎸' }, { name: 'Slide Guitar', icon: '🎸' }, { name: 'Resonator Guitar', icon: '🎸' },
    { name: 'Pedal Steel Guitar', icon: '🎸' }, { name: 'Lap Steel Guitar', icon: '🎸' }, { name: 'Classical Guitar', icon: '🎸' },
  ] },
  { emoji: '\uD83C\uDFB9', label: 'Keys', instruments: [
    { name: 'Grand Piano', icon: '🎹' }, { name: 'Piano', icon: '🎹' }, { name: 'Rhodes', icon: '🎹' },
    { name: 'Organ', icon: '🎹' }, { name: 'Synth', icon: '🎛️' }, { name: 'Celesta', icon: '✨' },
    { name: 'Accordion', icon: '🪗' }, { name: 'Keytar', icon: '🎹' }, { name: 'Upright Piano', icon: '🎹' },
    { name: 'Harpsichord', icon: '🎹' }, { name: 'Clavinet', icon: '🎹' }, { name: 'Wurlitzer', icon: '🎹' },
    { name: 'Mellotron', icon: '🎹' }, { name: 'Hammond Organ', icon: '🎹' }, { name: 'Toy Piano', icon: '🎹' },
  ] },
  { emoji: '\uD83C\uDFB7', label: 'Woodwinds', instruments: [
    { name: 'Saxophone', icon: '🎷' }, { name: 'Flute', icon: '🎶' }, { name: 'Clarinet', icon: '🎶' },
    { name: 'Oboe', icon: '🎶' }, { name: 'Piccolo', icon: '🎶' }, { name: 'Tin Whistle', icon: '🎶' },
    { name: 'Soprano Sax', icon: '🎷' }, { name: 'Baritone Sax', icon: '🎷' }, { name: 'Bass Clarinet', icon: '🎶' },
    { name: 'Bassoon', icon: '🎶' }, { name: 'English Horn', icon: '🎶' }, { name: 'Recorder', icon: '🎶' },
  ] },
  { emoji: '\uD83E\uDD41', label: 'Percussion', instruments: [
    { name: 'Standard Drum Kit', icon: '🥁' }, { name: 'Afrobeat Kit', icon: '🥁' }, { name: 'Electronic Kit', icon: '🎛️' },
    { name: 'Orchestral Percussion', icon: '🥁' }, { name: 'Latin Percussion', icon: '🪘' }, { name: 'Tribal Percussion', icon: '🪘' },
    { name: 'Tambourine', icon: '🛎️' }, { name: 'Guiro', icon: '🪇' }, { name: 'Triangle', icon: '🔺' },
    { name: 'Shaker', icon: '🪇' }, { name: 'Cowbell', icon: '🛎️' }, { name: 'Conga', icon: '🪘' },
    { name: 'Bongos', icon: '🪘' }, { name: 'Cajón', icon: '🪵' }, { name: 'Tubular Bells', icon: '🔔' },
    { name: 'Glockenspiel', icon: '🎶' }, { name: 'Xylophone', icon: '🎶' }, { name: 'Marimba', icon: '🎶' },
    { name: 'Timpani', icon: '🥁' }, { name: 'Djembe', icon: '🪘' }, { name: 'Timbales', icon: '🪘' },
    { name: 'Steel Drums', icon: '🛢️' }, { name: 'Handpan', icon: '🛸' }, { name: 'Vibraphone', icon: '🎶' },
    { name: 'Castanets', icon: '🪇' }, { name: 'Claves', icon: '🥢' }, { name: 'Woodblock', icon: '🪵' },
    { name: 'Frame Drum', icon: '🪘' }, { name: 'Cabasa', icon: '🪇' }, { name: 'Taiko Drums', icon: '🥁' },
  ] },
  { emoji: '\uD83C\uDFA4', label: 'Vocals', instruments: [
    { name: 'Lead Vocals', icon: '🎤' }, { name: 'Backing Vocals', icon: '🎶' }, { name: 'Choir', icon: '🎵' },
    { name: 'Gospel Choir', icon: '🎵' }, { name: 'Falsetto', icon: '🎤' }, { name: 'Whisper Vocals', icon: '🤫' },
    { name: 'Spoken Word', icon: '🗣️' }, { name: 'Vocal Chops', icon: '🎚️' }, { name: 'Vocoder', icon: '🤖' },
    { name: 'Beatbox', icon: '🎤' }, { name: 'Harmony Stacks', icon: '🎶' },
  ] },
  { emoji: '\uD83C\uDF9B\uFE0F', label: 'Electronic', instruments: [
    { name: 'Synthesizer', icon: '🎛️' }, { name: 'Sampler', icon: '🎚️' }, { name: '808', icon: '🎚️' },
    { name: 'TR-909', icon: '🎚️' }, { name: 'Moog Bass', icon: '🎛️' }, { name: 'Arp Synth', icon: '🎛️' },
    { name: 'FM Bass', icon: '🎛️' }, { name: 'Sub Bass', icon: '🔊' }, { name: 'Reese Bass', icon: '🔊' },
    { name: 'Acid Bass (TB-303)', icon: '🎛️' }, { name: 'Supersaw Lead', icon: '🎛️' }, { name: 'Pluck Synth', icon: '🎛️' },
    { name: 'Wavetable Pad', icon: '🎛️' }, { name: 'Granular Pad', icon: '🌫️' }, { name: 'Drum Machine', icon: '🎚️' },
  ] },
  { emoji: '\uD83C\uDFBC', label: 'Cinematic', instruments: [
    { name: 'Cinematic Strings', icon: '🎻' }, { name: 'Epic Brass', icon: '🎺' }, { name: 'Choir Pad', icon: '🎵' },
    { name: 'Cinematic Drums', icon: '🥁' }, { name: 'Sub Boom', icon: '💥' }, { name: 'Riser', icon: '📈' },
    { name: 'Atmospheric Pad', icon: '🌌' }, { name: 'Drone', icon: '🌫️' }, { name: 'Braam', icon: '💥' },
    { name: 'Music Box', icon: '🎶' },
  ] },
  { emoji: '\uD83E\uDE97', label: 'Folk / Ethnic', instruments: [
    { name: 'Alto Harmonica', icon: '🎶' }, { name: 'Kazoo', icon: '🎶' }, { name: 'Jaw Harp', icon: '🎶' },
    { name: 'Pan Flute', icon: '🎶' }, { name: 'Tribal Percussion', icon: '🪘' }, { name: 'Bouzouki', icon: '🪕' },
    { name: 'Sitar', icon: '🪕' }, { name: 'Duduk', icon: '🎶' }, { name: 'Bodhrán', icon: '🪘' }, { name: 'Whistle', icon: '🎶' },
    { name: 'Bagpipes', icon: '🎶' }, { name: 'Erhu', icon: '🎻' }, { name: 'Koto', icon: '🪕' },
    { name: 'Shamisen', icon: '🪕' }, { name: 'Guzheng', icon: '🪕' }, { name: 'Oud', icon: '🪕' },
    { name: 'Kora', icon: '🪕' }, { name: 'Balalaika', icon: '🪕' }, { name: 'Charango', icon: '🪕' },
    { name: 'Didgeridoo', icon: '🎶' }, { name: 'Shakuhachi', icon: '🎶' }, { name: 'Mbira', icon: '🎶' },
    { name: 'Hammered Dulcimer', icon: '🎼' },
  ] },
];

// ─── Sub-style data ───────────────────────────────────────────────────────────

export const SUB_STYLE_DATA: Record<string, SubStyleEntry[]> = {
  'Rock': [
    { name: 'Classic', description: 'Big riffs, driving rhythm, arena-ready dynamics.', bpmOffset: 0, mood: 'Anthemic', signature: 'Power chords, verse-chorus-solo arc', addInstruments: ['Lead Vocals'] },
    { name: 'Indie', description: 'Lo-fi warmth, jangly guitars, understated vocals.', bpmOffset: -10, mood: 'Introspective', signature: 'Clean tones, reverb-drenched hooks', addInstruments: ['Acoustic Guitar'] },
    { name: 'Psychedelic', description: 'Swirling textures, phased effects, consciousness-expanding sound.', bpmOffset: -20, mood: 'Dreamy', signature: 'Tape delay, backward guitars, sitar accents', addInstruments: ['Synthesizer', 'Sitar'] },
    { name: 'Prog', description: 'Complex time signatures, extended compositions, technical mastery.', bpmOffset: +10, mood: 'Epic', signature: 'Odd meters, synth layers, dynamic shifts', addInstruments: ['Synthesizer', 'Grand Piano'] },
    { name: 'Alternative', description: 'Genre-fluid experimentation, angular melodies, raw emotion.', bpmOffset: -5, mood: 'Restless', signature: 'Dissonant textures, dynamic contrast', addInstruments: [] },
    { name: 'Garage', description: 'Lo-fi grit, shouted hooks, basement-stage urgency.', bpmOffset: +15, mood: 'Raw', signature: 'Fast downstrokes, blown-out drums, call-and-response shouts', addInstruments: ['Bass Guitar'] },
    { name: 'Post-Rock', description: 'Cinematic builds, delay-drenched guitars, instrumental storytelling.', bpmOffset: -15, mood: 'Expansive', signature: 'Crescendo swells, tremolo picking, wide reverb', addInstruments: ['Grand Piano', 'Synthesizer'] },
  ],
  'Jazz': [
    { name: 'Swing', description: 'Bouncy shuffle feel, big-band punch, infectious groove.', bpmOffset: +15, mood: 'Joyful', signature: 'Walking bass, brass stabs, swing feel', addInstruments: ['Trumpet', 'Trombone'] },
    { name: 'Bebop', description: 'Virtuosic improv, rapid harmonic movement, intimate combo.', bpmOffset: +40, mood: 'Intense', signature: 'Fast unison heads, complex changes', addInstruments: ['Trumpet'] },
    { name: 'Fusion', description: 'Electric jazz meets rock energy, groove-forward sophistication.', bpmOffset: -15, mood: 'Driving', signature: 'Distorted keys, slap bass, polyrhythm', addInstruments: ['Electric Guitar', 'Synthesizer'] },
    { name: 'Smooth', description: 'Polished production, accessible melody, velvet atmosphere.', bpmOffset: -30, mood: 'Relaxed', signature: 'Soprano sax lead, lush pads', addInstruments: ['Synthesizer'] },
    { name: 'Latin', description: 'Afro-Cuban clave patterns, percussive heat, harmonic color.', bpmOffset: -5, mood: 'Fiery', signature: 'Montuno piano, conga patterns, horn riffs', addInstruments: ['Latin Percussion', 'Trumpet'] },
    { name: 'Cool', description: 'Laid-back phrasing, brushed drums, airy horn voicings.', bpmOffset: -20, mood: 'Relaxed', signature: 'Muted brass, smooth lines, understated swing', addInstruments: ['French Horn'] },
    { name: 'Nu Jazz', description: 'Electronic textures with jazz harmony, beat-centric.', bpmOffset: -10, mood: 'Modern', signature: 'Programmed drums, Rhodes and synth layers', addInstruments: ['Sampler', 'Rhodes'] },
  ],
  'Hip-Hop': [
    { name: 'Trap', description: 'Sub-heavy 808s, hi-hat rolls, dark atmospheric pads.', bpmOffset: -20, mood: 'Menacing', signature: 'Triplet hi-hats, pitched 808, sparse vocals', addInstruments: ['Synthesizer'] },
    { name: 'Boom Bap', description: 'Punchy drums, sample-based loops, lyric-forward production.', bpmOffset: 0, mood: 'Gritty', signature: 'Chopped samples, snappy snare, vinyl crackle', addInstruments: [] },
    { name: 'Lo-Fi', description: 'Dusty textures, detuned samples, beatmaking as meditation.', bpmOffset: -15, mood: 'Chill', signature: 'Vinyl hiss, jazz piano chops, soft kicks', addInstruments: ['Rhodes'] },
    { name: 'Cloud Rap', description: 'Ethereal pads, reverb-washed vocals, dreamy slow-motion feel.', bpmOffset: -25, mood: 'Ethereal', signature: 'Spacious reverb, airy synths, Auto-Tune', addInstruments: ['Synthesizer'] },
    { name: 'Drill', description: 'Sliding 808s, ominous melodies, relentless rhythmic energy.', bpmOffset: +50, mood: 'Aggressive', signature: 'Sliding bass, dark piano loops, rapid hi-hats', addInstruments: ['Grand Piano'] },
    { name: 'Phonk', description: 'Memphis samples, cowbells, distorted 808 slides.', bpmOffset: +10, mood: 'Menacing', signature: 'Chopped soul loops, trunk-rattle bass, gritty textures', addInstruments: ['Cowbell', '808'] },
    { name: 'Jazz Rap', description: 'Swing-infused drums, upright bass, conscious flows.', bpmOffset: -5, mood: 'Thoughtful', signature: 'Sax riffs, dusty Rhodes, head-nod groove', addInstruments: ['Saxophone', 'Rhodes'] },
  ],
  'Pop': [
    { name: 'Indie Pop', description: 'Hand-crafted charm, quirky arrangements, authentic texture.', bpmOffset: -10, mood: 'Whimsical', signature: 'Ukulele/glockenspiel accents, lo-fi sheen', addInstruments: ['Acoustic Guitar'] },
    { name: 'K-Pop', description: 'Maximalist production, genre-blending sections, precision choreography sound.', bpmOffset: +8, mood: 'Explosive', signature: 'Beat drops, rap verses, key changes', addInstruments: ['Sampler'] },
    { name: 'Synth-Pop', description: 'Analog synth warmth, retro pulse, neon-lit atmosphere.', bpmOffset: 0, mood: 'Nostalgic', signature: 'Arpeggiator lines, gated reverb drums', addInstruments: ['Arp Synth'] },
    { name: 'Dance Pop', description: 'Four-on-the-floor energy, euphoric drops, club-radio crossover.', bpmOffset: +8, mood: 'Euphoric', signature: 'Build-drop-chorus, side-chain compression', addInstruments: ['Sampler', 'TR-909'] },
    { name: 'Bedroom Pop', description: 'Intimate vocals, DIY textures, soft-focus sparkle.', bpmOffset: -8, mood: 'Tender', signature: 'Lo-fi drums, chorusy guitars, whispered hooks', addInstruments: ['Ukulele', 'Synthesizer'] },
    { name: 'Electro Pop', description: 'Club-ready sheen, sidechained synths, big hooks.', bpmOffset: +12, mood: 'Glossy', signature: 'Four-on-floor pulse, buzzy bass, stack harmonies', addInstruments: ['Synthesizer', 'Sampler'] },
  ],
  'R&B': [
    { name: 'Neo Soul', description: 'Organic warmth, jazzy chords, conscious lyricism.', bpmOffset: -10, mood: 'Warm', signature: 'Rhodes chords, live bass, airy vocals', addInstruments: ['Rhodes'] },
    { name: 'Contemporary', description: 'Polished production, vocal runs, crossover-ready sound.', bpmOffset: 0, mood: 'Smooth', signature: 'Layered harmonies, punchy kicks, synth bass', addInstruments: ['Synthesizer'] },
    { name: 'Future R&B', description: 'Glitchy textures, pitch-shifted vocals, experimental atmospheres.', bpmOffset: -5, mood: 'Otherworldly', signature: 'Granular synthesis, chopped vocals, sub bass', addInstruments: ['Synthesizer', 'Sampler'] },
    { name: 'Alt R&B', description: 'Experimental sound design over soulful vocals.', bpmOffset: -5, mood: 'Textured', signature: 'Pitch-shifted chops, sparse drums, subby lows', addInstruments: ['Synthesizer', 'Backing Vocals'] },
  ],
  'Metal': [
    { name: 'Heavy', description: 'Chugging riffs, pounding double kicks, wall-of-sound power.', bpmOffset: -10, mood: 'Crushing', signature: 'Palm mutes, power chords, mid-tempo groove', addInstruments: ['Lead Vocals'] },
    { name: 'Death', description: 'Blast beats, guttural vocals, extreme technical precision.', bpmOffset: +30, mood: 'Brutal', signature: 'Tremolo picking, blast beats, growl vocals', addInstruments: [] },
    { name: 'Thrash', description: 'Blazing speed, tight riffing, relentless aggression.', bpmOffset: +20, mood: 'Furious', signature: 'Speed picking, gallop rhythms, rapid fills', addInstruments: [] },
    { name: 'Progressive', description: 'Odd time signatures, long-form structure, melodic sophistication.', bpmOffset: -5, mood: 'Epic', signature: 'Complex arrangements, clean/heavy contrast', addInstruments: ['Synthesizer', 'Grand Piano'] },
    { name: 'Doom', description: 'Slow-crushing riffs, low-tuned weight, ominous atmosphere.', bpmOffset: -30, mood: 'Brooding', signature: 'Sustain-heavy guitars, cavernous drums', addInstruments: ['Grand Piano'] },
    { name: 'Metalcore', description: 'Breakdowns, screamed/clean dynamics, tight syncopation.', bpmOffset: +25, mood: 'Intense', signature: 'Chugs + syncopation, double kicks, melodic choruses', addInstruments: ['Electronic Kit'] },
  ],
  'Funk': [
    { name: 'Classic', description: 'Tight pocket grooves, horn stabs, call-and-response energy.', bpmOffset: 0, mood: 'Groovy', signature: 'Chicken scratch guitar, slap bass, brass hits', addInstruments: ['Trumpet', 'Trombone'] },
    { name: 'P-Funk', description: 'Cosmic synth layers, deep grooves, psychedelic theatrics.', bpmOffset: -5, mood: 'Cosmic', signature: 'Moog bass, vocal chants, extended jams', addInstruments: ['Moog Bass', 'Synthesizer'] },
    { name: 'Neo-Funk', description: 'Modern production on classic foundations, crossover polish.', bpmOffset: +5, mood: 'Slick', signature: 'Compressed drums, filtered guitars, synth bass', addInstruments: ['Synthesizer'] },
    { name: 'Electro-Funk', description: 'Drum machines meet live bass, robotic vocals, dance floor heat.', bpmOffset: +10, mood: 'Electric', signature: 'TR-808/909, vocoder, side-chain groove', addInstruments: ['TR-909', 'Synthesizer'] },
    { name: 'G-Funk', description: 'West Coast glide, talkbox leads, deep pocket swing.', bpmOffset: -5, mood: 'Laid-back', signature: 'Moog bass slides, whistle leads, swung hats', addInstruments: ['Moog Bass', 'Synthesizer'] },
  ],
  'Reggae': [
    { name: 'Roots', description: 'One-drop rhythm, conscious lyrics, earthy warmth.', bpmOffset: 0, mood: 'Spiritual', signature: 'One-drop drums, organ bubble, horn melodies', addInstruments: ['Organ'] },
    { name: 'Dancehall', description: 'Digital riddims, toasting vocals, high-energy bounce.', bpmOffset: +15, mood: 'Hype', signature: 'Digital drums, singjay flow, bass-heavy mix', addInstruments: ['Electronic Kit', 'Sampler'] },
    { name: 'Dub', description: 'Echo-drenched soundscapes, bass as lead, minimalist deconstruction.', bpmOffset: -10, mood: 'Hypnotic', signature: 'Spring reverb, tape delay, bass drops', addInstruments: ['Synthesizer'] },
    { name: 'Lovers Rock', description: 'Romantic reggae croon, silky guitars, sweet harmonies.', bpmOffset: +5, mood: 'Romantic', signature: 'One-drop groove, airy chords, stacked vocals', addInstruments: ['Backing Vocals', 'Electric Guitar'] },
  ],
  'Blues': [
    { name: 'Delta', description: 'Raw acoustic slide guitar, field-holler roots, primal emotion.', bpmOffset: -10, mood: 'Raw', signature: 'Slide guitar, fingerpicking, sparse arrangement', addInstruments: ['Acoustic Guitar'] },
    { name: 'Chicago', description: 'Amplified grit, shuffling drums, harmonica wails.', bpmOffset: 0, mood: 'Gritty', signature: 'Amplified harp, shuffle beat, call-response', addInstruments: ['Alto Harmonica'] },
    { name: 'Electric', description: 'Overdriven lead tones, band-driven power, stadium blues.', bpmOffset: +10, mood: 'Fiery', signature: 'Overdriven guitar, strong backbeat, solos', addInstruments: ['Electric Guitar'] },
    { name: 'Texas', description: 'Swinging shuffle, horn-section punch, big-hearted sound.', bpmOffset: +5, mood: 'Soulful', signature: 'Shuffle feel, brass section, call-response', addInstruments: ['Trumpet', 'Saxophone'] },
    { name: 'Soul Blues', description: 'Horn-backed grooves, churchy organ lifts.', bpmOffset: +5, mood: 'Soulful', signature: 'Organ swells, brass punches, emotive vocals', addInstruments: ['Organ', 'Trumpet'] },
  ],
  'Electronic': [
    { name: 'House', description: 'Four-on-the-floor kick, warm basslines, diva vocal chops.', bpmOffset: 0, mood: 'Euphoric', signature: 'Steady kick, offbeat hi-hat, filtered loops', addInstruments: ['Sampler'] },
    { name: 'Techno', description: 'Industrial precision, hypnotic loops, warehouse intensity.', bpmOffset: +12, mood: 'Industrial', signature: 'Relentless kick, acid lines, dark pads', addInstruments: [] },
    { name: 'Ambient', description: 'Textural landscapes, slow evolution, immersive space.', bpmOffset: -60, mood: 'Meditative', signature: 'Granular textures, field recordings, drones', addInstruments: [] },
    { name: 'IDM', description: 'Glitchy rhythms, cerebral sound design, avant-garde electronic.', bpmOffset: -10, mood: 'Cerebral', signature: 'Broken beats, complex modulation, micro-edits', addInstruments: ['Sampler'] },
    { name: 'Trance', description: 'Uplifting builds, rolling basslines, euphoric leads.', bpmOffset: +20, mood: 'Euphoric', signature: 'Supersaws, long risers, four-on-the-floor', addInstruments: ['Arp Synth', 'Sampler'] },
    { name: 'Downtempo', description: 'Laid-back grooves, smoky atmospheres, chilled pacing.', bpmOffset: -35, mood: 'Chill', signature: 'Loose drums, Rhodes chords, dusty textures', addInstruments: ['Rhodes', 'Sampler'] },
  ],
  'Synthwave': [
    { name: 'Retrowave', description: 'Neon nostalgia, pulsing arpeggios, 80s sunset chase.', bpmOffset: 0, mood: 'Nostalgic', signature: 'Arp sequences, gated snare, analog warmth', addInstruments: ['Arp Synth'] },
    { name: 'Darksynth', description: 'Horror-tinged aggression, distorted synths, cyberpunk menace.', bpmOffset: +10, mood: 'Menacing', signature: 'Distorted leads, industrial drums, evil bass', addInstruments: ['Moog Bass'] },
    { name: 'Chillwave', description: 'Hazy lo-fi wash, detuned tapes, blissed-out warmth.', bpmOffset: -20, mood: 'Blissful', signature: 'Tape warble, soft pads, reverb-heavy mix', addInstruments: [] },
    { name: 'Cyberwave', description: 'Futuristic edge, glitchy arps, neon noir mood.', bpmOffset: +6, mood: 'Neon', signature: 'Bitcrushed drums, arps, vocoder hooks', addInstruments: ['Arp Synth', 'Sampler'] },
  ],
  'Soul': [
    { name: 'Classic', description: 'Motown-era elegance, orchestral sweetness, timeless vocal power.', bpmOffset: 0, mood: 'Elegant', signature: 'String arrangements, tight rhythm section', addInstruments: ['Violin', 'Backing Vocals'] },
    { name: 'Neo Soul', description: 'Jazz-inflected grooves, live instrumentation, conscious artistry.', bpmOffset: -5, mood: 'Warm', signature: 'Rhodes keys, live drums, breathy vocals', addInstruments: ['Rhodes'] },
    { name: 'Northern Soul', description: 'Uptempo Motown energy, dance-floor urgency, rare-groove fire.', bpmOffset: +15, mood: 'Energetic', signature: 'Driving backbeat, brass stabs, stomping floor', addInstruments: ['Trumpet', 'Tambourine'] },
    { name: 'Blue-Eyed Soul', description: 'Pop-leaning soul melodies with glossy hooks.', bpmOffset: +5, mood: 'Smooth', signature: 'Clean arrangements, stacked harmonies, bright strings', addInstruments: ['Backing Vocals'] },
  ],
  'Afrobeat': [
    { name: 'Afrobeats', description: 'Modern crossover pop, infectious log-drum patterns, global appeal.', bpmOffset: +8, mood: 'Festive', signature: 'Log drums, guitar licks, sing-along hooks', addInstruments: ['Sampler'] },
    { name: 'Highlife', description: 'Jazzy guitar lines, swinging horns, West African elegance.', bpmOffset: +5, mood: 'Joyful', signature: 'Clean guitar arpeggios, brass, palm-wine feel', addInstruments: ['Trumpet', 'Acoustic Guitar'] },
    { name: 'Jùjú', description: 'Talking drum conversations, layered percussion, Yoruba praise-song tradition.', bpmOffset: 0, mood: 'Celebratory', signature: 'Talking drum, layered percussion, call-response', addInstruments: ['Tribal Percussion'] },
    { name: 'Amapiano', description: 'Log-drum bounce, airy pads, South African club feel.', bpmOffset: +2, mood: 'Groovy', signature: 'Log drum bass, shaker rolls, gentle keys', addInstruments: ['Afrobeat Kit', 'Sampler'] },
    { name: 'Afro House', description: 'Four-on-the-floor meets Afro rhythms, chant hooks.', bpmOffset: +10, mood: 'Driving', signature: 'Percussive loops, synth stabs, vocal chops', addInstruments: ['Latin Percussion', 'Synthesizer'] },
  ],
  'Country': [
    { name: 'Modern', description: 'Polished arena country with pop-leaning hooks and big drums.', bpmOffset: +5, mood: 'Uplifting', signature: 'Stacked vocals, punchy snare, clean electric leads', addInstruments: ['Electric Guitar', 'Lead Vocals'] },
    { name: 'Outlaw', description: 'Rugged, rebellious storytelling with a raw honky-tonk edge.', bpmOffset: 0, mood: 'Gritty', signature: 'Twangy Telecaster, brushed drums, baritone vocals', addInstruments: ['Pedal Steel Guitar', 'Acoustic Guitar'] },
    { name: 'Country Pop', description: 'Crossover sheen, sing-along choruses, radio polish.', bpmOffset: +8, mood: 'Bright', signature: 'Bright acoustics, claps, anthemic hooks', addInstruments: ['Acoustic Guitar', 'Backing Vocals'] },
    { name: 'Honky-Tonk', description: 'Barroom shuffle, weeping steel, two-step groove.', bpmOffset: +10, mood: 'Rowdy', signature: 'Walking bass, pedal steel cries, piano triplets', addInstruments: ['Pedal Steel Guitar', 'Piano'] },
    { name: 'Alt-Country', description: 'Roots-rock grit blended with introspective songwriting.', bpmOffset: -5, mood: 'Wistful', signature: 'Jangly guitars, organ pads, weathered vocals', addInstruments: ['Electric Guitar', 'Hammond Organ'] },
  ],
  'Folk': [
    { name: 'Singer-Songwriter', description: 'Intimate confessional storytelling, fingerpicked warmth.', bpmOffset: -5, mood: 'Tender', signature: 'Fingerstyle guitar, close vocals, sparse arrangement', addInstruments: ['Acoustic Guitar', 'Lead Vocals'] },
    { name: 'Indie Folk', description: 'Layered acoustics, hushed harmonies, organic textures.', bpmOffset: 0, mood: 'Wistful', signature: 'Banjo/mandolin layers, group harmonies, soft kick', addInstruments: ['Banjo', 'Mandolin'] },
    { name: 'Celtic', description: 'Lilting melodies, jigs and reels, misty atmosphere.', bpmOffset: +10, mood: 'Spirited', signature: 'Tin whistle, fiddle, bodhrán pulse', addInstruments: ['Tin Whistle', 'Fiddle'] },
    { name: 'Bluegrass', description: 'High-lonesome harmonies, breakneck picking, front-porch energy.', bpmOffset: +20, mood: 'Lively', signature: 'Banjo rolls, fiddle breaks, upright bass slap', addInstruments: ['Banjo', 'Fiddle'] },
    { name: 'Americana', description: 'Roots-blend of folk, country and blues with road-worn soul.', bpmOffset: 0, mood: 'Earthy', signature: 'Slide guitar, brushed drums, warm vocals', addInstruments: ['Slide Guitar', 'Acoustic Guitar'] },
  ],
  'Latin': [
    { name: 'Salsa', description: 'Fiery clave-driven horns, montuno piano, dance-floor heat.', bpmOffset: +10, mood: 'Fiery', signature: 'Horn stabs, montuno piano, conga & timbales', addInstruments: ['Trumpet', 'Timbales'] },
    { name: 'Bachata', description: 'Romantic guitar arpeggios, swaying bongó groove.', bpmOffset: -10, mood: 'Romantic', signature: 'Requinto lead, bongó, güira shuffle', addInstruments: ['Nylon Guitar', 'Bongos'] },
    { name: 'Reggaeton', description: 'Dembow bounce, catchy hooks, club-ready energy.', bpmOffset: 0, mood: 'Hype', signature: 'Dembow rhythm, synth stabs, vocal hooks', addInstruments: ['Electronic Kit', 'Synthesizer'] },
    { name: 'Cumbia', description: 'Rolling güira groove, accordion melodies, hip-swaying pulse.', bpmOffset: -5, mood: 'Festive', signature: 'Accordion lines, guacharaca scrape, steady bass', addInstruments: ['Accordion', 'Latin Percussion'] },
    { name: 'Latin Pop', description: 'Crossover hooks over warm Latin rhythms and bright production.', bpmOffset: +5, mood: 'Sunny', signature: 'Acoustic strums, percussion layers, anthemic choruses', addInstruments: ['Nylon Guitar', 'Backing Vocals'] },
    { name: 'Merengue', description: 'Breakneck two-step, blazing horns, relentless joy.', bpmOffset: +30, mood: 'Euphoric', signature: 'Fast tambora, saxophone riffs, marching bass', addInstruments: ['Saxophone', 'Latin Percussion'] },
  ],
  'Ambient': [
    { name: 'Cinematic', description: 'Sweeping orchestral textures built for screen and scale.', bpmOffset: 0, mood: 'Epic', signature: 'String swells, brass braams, deep sub booms', addInstruments: ['Cinematic Strings', 'Sub Boom'] },
    { name: 'Drone', description: 'Slow-evolving sustained tones, deep immersion.', bpmOffset: -20, mood: 'Meditative', signature: 'Layered drones, slow filter sweeps, no percussion', addInstruments: ['Drone', 'Atmospheric Pad'] },
    { name: 'Space Ambient', description: 'Vast, weightless pads evoking the cosmos.', bpmOffset: -10, mood: 'Weightless', signature: 'Reverb-soaked pads, twinkling bells, sub drones', addInstruments: ['Atmospheric Pad', 'Music Box'] },
    { name: 'Neoclassical', description: 'Solo piano and strings, fragile and emotive.', bpmOffset: 0, mood: 'Reflective', signature: 'Felt piano, intimate strings, room ambience', addInstruments: ['Grand Piano', 'Cinematic Strings'] },
  ],
};

/** Flat name-only map derived from SUB_STYLE_DATA. */
export const SUB_STYLES: Record<string, string[]> = Object.fromEntries(
  Object.entries(SUB_STYLE_DATA).map(([genre, entries]) => [genre, entries.map(e => e.name)])
);

/** Maps tile names that don't have their own SUB_STYLE_DATA key to a parent genre. */
export const TILE_SUBSTYLE_FALLBACK: Record<string, string> = {
  'House': 'Electronic',
  'Techno': 'Electronic',
  'Drum & Bass': 'Electronic',
  'Trap': 'Hip-Hop',
  'Hard Rock': 'Rock',
  'Punk': 'Rock',
  'Grunge': 'Rock',
  'Gospel': 'Soul',
  'Indie Pop': 'Pop',
  'K-Pop': 'Pop',
  'Synth-Pop': 'Pop',
  'Bossa Nova': 'Jazz',
  'Tango': 'Jazz',
  'Bluegrass': 'Folk',
  'Americana': 'Folk',
  'Salsa': 'Latin',
  'Reggaeton': 'Latin',
  'Bachata': 'Latin',
  'Cumbia': 'Latin',
  'Cinematic': 'Ambient',
  'Lo-Fi': 'Hip-Hop',
};

// ─── Vibe categories ──────────────────────────────────────────────────────────

export const VIBE_CATEGORIES: VibeCategory[] = [
  { id: 'electronic', label: 'ÉLECTRONIQUE', color: '#06b6d4', summary: 'Synthetic textures, club energy, and precise pulse-driven production.', artists: ['Fred again..', 'BICEP', 'Justice'], moods: ['Driving', 'Futuristic', 'Late-night'], era: '90s club DNA → modern festival polish', tiles: [{ name: 'House', emoji: '\uD83C\uDFE0', bpm: 128, rhythm: 'Electronic (4/4)', instruments: ['Synthesizer', 'Sampler', 'TR-909'] }, { name: 'Techno', emoji: '\u2699\uFE0F', bpm: 140, rhythm: 'Electronic (4/4)', instruments: ['Synthesizer', 'TR-909', 'Electronic Kit'] }, { name: 'Trap', emoji: '\uD83D\uDD0A', bpm: 70, rhythm: 'Trap', instruments: ['808', 'Electronic Kit', 'Sampler'] }, { name: 'Synthwave', emoji: '\uD83C\uDF06', bpm: 110, rhythm: 'Electronic (4/4)', instruments: ['Synthesizer', 'Sampler'] }, { name: 'Drum & Bass', emoji: '\uD83E\uDD41', bpm: 174, rhythm: 'Breakbeat', instruments: ['Electronic Kit', 'Synthesizer', 'Sampler'] }] },
  { id: 'urban', label: 'URBAIN', color: '#ec4899', summary: 'Beat-first songwriting with vocal attitude, bounce, and contemporary crossover appeal.', artists: ['SZA', 'Travis Scott', 'Burna Boy'], moods: ['Confident', 'Sensual', 'Hypnotic'], era: 'Streaming-era polish with roots in 90s/2000s rhythm culture', tiles: [{ name: 'Hip-Hop', emoji: '\uD83C\uDFA4', bpm: 90, rhythm: 'Hip-Hop', instruments: ['808', 'Electronic Kit', 'Sampler', 'Lead Vocals'] }, { name: 'R&B', emoji: '\uD83D\uDC9C', bpm: 90, rhythm: 'Funk', instruments: ['Rhodes', 'Electronic Kit', 'Lead Vocals', 'Backing Vocals'] }, { name: 'Afrobeat', emoji: '\uD83C\uDF0D', bpm: 100, rhythm: 'Afrobeat', instruments: ['Afrobeat Kit', 'Electric Guitar', 'Lead Vocals'] }, { name: 'Reggaeton', emoji: '\uD83D\uDD25', bpm: 95, rhythm: 'Cumbia', instruments: ['Electronic Kit', 'Sampler', 'Lead Vocals'] }] },
  { id: 'rock', label: 'ROCK', color: '#ef4444', summary: 'Live-band impact, punchy drums, and guitar-forward arrangements with edge.', artists: ['Arctic Monkeys', 'Foo Fighters', 'Paramore'], moods: ['Raw', 'Anthemic', 'Restless'], era: '70s riffs through 2000s alt-rock urgency', tiles: [{ name: 'Rock', emoji: '\uD83C\uDFB8', bpm: 120, rhythm: 'Rock', instruments: ['Electric Guitar', 'Standard Drum Kit', 'Bass Guitar'] }, { name: 'Hard Rock', emoji: '\uD83E\uDD18', bpm: 140, rhythm: 'Hard Rock', instruments: ['Electric Guitar', 'Standard Drum Kit', 'Bass Guitar'] }, { name: 'Punk', emoji: '\u26A1', bpm: 180, rhythm: 'Rock', instruments: ['Electric Guitar', 'Standard Drum Kit', 'Bass Guitar', 'Lead Vocals'] }, { name: 'Metal', emoji: '\uD83D\uDC80', bpm: 160, rhythm: 'Rock', instruments: ['Electric Guitar', 'Standard Drum Kit', 'Bass Guitar'] }, { name: 'Grunge', emoji: '\uD83C\uDF27\uFE0F', bpm: 100, rhythm: 'Rock', instruments: ['Electric Guitar', 'Standard Drum Kit', 'Bass Guitar', 'Lead Vocals'] }] },
  { id: 'soul-jazz', label: 'SOUL / JAZZ', color: '#8b5cf6', summary: 'Expressive harmony, groove depth, and human warmth anchored by feel.', artists: ['Amy Winehouse', 'Anderson .Paak', 'Esperanza Spalding'], moods: ['Warm', 'Playful', 'Intimate'], era: 'Timeless heritage with modern neo-soul finesse', tiles: [{ name: 'Jazz', emoji: '\uD83C\uDFB7', bpm: 165, rhythm: 'Jazz Swing', instruments: ['Saxophone', 'Piano', 'Double Bass', 'Standard Drum Kit'] }, { name: 'Blues', emoji: '\uD83C\uDFB5', bpm: 75, rhythm: 'Blues', instruments: ['Electric Guitar', 'Piano', 'Standard Drum Kit'] }, { name: 'Soul', emoji: '\u2764\uFE0F', bpm: 80, rhythm: 'Funk', instruments: ['Rhodes', 'Lead Vocals', 'Backing Vocals'] }, { name: 'Funk', emoji: '\uD83D\uDD7A', bpm: 105, rhythm: 'Funk', instruments: ['Electric Guitar', 'Standard Drum Kit', 'Bass Guitar', 'Rhodes'] }, { name: 'Gospel', emoji: '\uD83D\uDE4F', bpm: 85, rhythm: 'Blues', instruments: ['Piano', 'Choir', 'Lead Vocals'] }] },
  { id: 'world', label: 'WORLD', color: '#14b8a6', summary: 'Regional rhythms and acoustic character blended with strong cultural signatures.', artists: ['Buena Vista Social Club', 'Rosalía', 'Fela Kuti'], moods: ['Organic', 'Sunlit', 'Transportive'], era: 'Tradition-informed grooves with global-pop openness', tiles: [{ name: 'Reggae', emoji: '\uD83C\uDF34', bpm: 75, rhythm: 'Reggae', instruments: ['Electric Guitar', 'Standard Drum Kit', 'Bass Guitar'] }, { name: 'Samba', emoji: '\uD83E\uDD41', bpm: 100, rhythm: 'Samba', instruments: ['Latin Percussion', 'Standard Drum Kit'] }, { name: 'Bossa Nova', emoji: '\uD83C\uDFB8', bpm: 130, rhythm: 'Bossa Nova', instruments: ['Acoustic Guitar', 'Double Bass'] }, { name: 'Flamenco', emoji: '\uD83D\uDC83', bpm: 120, rhythm: 'Flamenco', instruments: ['Acoustic Guitar', 'Latin Percussion'] }, { name: 'Tango', emoji: '\uD83C\uDF39', bpm: 120, rhythm: 'Tango', instruments: ['Violin', 'Piano', 'Double Bass'] }] },
  { id: 'pop', label: 'POP', color: '#f59e0b', summary: 'Direct hooks, polished toplines, and wide-audience accessibility.', artists: ['Dua Lipa', 'The Weeknd', 'Caroline Polachek'], moods: ['Bright', 'Catchy', 'Cinematic'], era: '80s sheen to current chart-ready production', tiles: [{ name: 'Pop', emoji: '\u2B50', bpm: 120, rhythm: 'Disco', instruments: ['Synthesizer', 'Electronic Kit', 'Lead Vocals', 'Backing Vocals'] }, { name: 'Indie Pop', emoji: '\uD83C\uDF1F', bpm: 110, rhythm: 'Rock', instruments: ['Acoustic Guitar', 'Electronic Kit', 'Lead Vocals'] }, { name: 'K-Pop', emoji: '\u2728', bpm: 128, rhythm: 'Electronic (4/4)', instruments: ['Synthesizer', 'Electronic Kit', 'Lead Vocals', 'Backing Vocals'] }, { name: 'Synth-Pop', emoji: '\uD83C\uDFB9', bpm: 120, rhythm: 'Disco', instruments: ['Synthesizer', 'Sampler', 'Lead Vocals'] }] },
  { id: 'country-folk', label: 'COUNTRY / FOLK', color: '#d97706', summary: 'Acoustic storytelling, roots rhythms, and heartfelt vocal character.', artists: ['Chris Stapleton', 'Zach Bryan', 'The Lumineers'], moods: ['Earthy', 'Nostalgic', 'Heartfelt'], era: 'Front-porch tradition meets modern Americana', tiles: [{ name: 'Country', emoji: '\uD83E\uDD20', bpm: 110, rhythm: 'Country', instruments: ['Acoustic Guitar', 'Pedal Steel Guitar', 'Standard Drum Kit', 'Lead Vocals'] }, { name: 'Folk', emoji: '\uD83C\uDF3E', bpm: 95, rhythm: 'Folk', instruments: ['Acoustic Guitar', 'Banjo', 'Lead Vocals'] }, { name: 'Bluegrass', emoji: '\uD83E\uDE95', bpm: 140, rhythm: 'Bluegrass', instruments: ['Banjo', 'Fiddle', 'Mandolin', 'Double Bass'] }, { name: 'Americana', emoji: '\uD83D\uDEE3\uFE0F', bpm: 100, rhythm: 'Folk', instruments: ['Slide Guitar', 'Acoustic Guitar', 'Standard Drum Kit'] }] },
  { id: 'latin', label: 'LATIN', color: '#e11d48', summary: 'Clave-driven grooves, vibrant horns, and irresistible dance energy.', artists: ['Bad Bunny', 'Marc Anthony', 'Rosalía'], moods: ['Fiery', 'Romantic', 'Festive'], era: 'Tropical heritage with reggaeton-era crossover', tiles: [{ name: 'Salsa', emoji: '\uD83D\uDC83', bpm: 100, rhythm: 'Salsa', instruments: ['Trumpet', 'Piano', 'Timbales', 'Conga'] }, { name: 'Reggaeton', emoji: '\uD83D\uDD25', bpm: 95, rhythm: 'Reggaeton', instruments: ['Electronic Kit', 'Synthesizer', 'Lead Vocals'] }, { name: 'Bachata', emoji: '\uD83C\uDF39', bpm: 130, rhythm: 'Bachata', instruments: ['Nylon Guitar', 'Bongos', 'Bass Guitar'] }, { name: 'Cumbia', emoji: '\uD83C\uDFB6', bpm: 95, rhythm: 'Cumbia', instruments: ['Accordion', 'Latin Percussion', 'Bass Guitar'] }, { name: 'Latin', emoji: '\uD83C\uDF1E', bpm: 110, rhythm: 'Rumba', instruments: ['Nylon Guitar', 'Latin Percussion', 'Backing Vocals'] }] },
  { id: 'ambient-cinematic', label: 'AMBIENT / CINEMATIC', color: '#0ea5e9', summary: 'Atmospheric textures, slow-evolving pads, and widescreen emotion.', artists: ['Brian Eno', 'Jon Hopkins', 'Hans Zimmer'], moods: ['Meditative', 'Expansive', 'Dreamlike'], era: 'Ambient pioneers through modern cinematic scoring', tiles: [{ name: 'Ambient', emoji: '\uD83C\uDF0C', bpm: 80, rhythm: 'Ambient', instruments: ['Atmospheric Pad', 'Drone', 'Music Box'] }, { name: 'Cinematic', emoji: '\uD83C\uDFAC', bpm: 90, rhythm: 'Cinematic', instruments: ['Cinematic Strings', 'Epic Brass', 'Cinematic Drums', 'Sub Boom'] }, { name: 'Lo-Fi', emoji: '\uD83C\uDF19', bpm: 75, rhythm: 'Hip-Hop', instruments: ['Rhodes', 'Sampler', 'Electronic Kit'] }] },
  { id: 'classical', label: 'CLASSIQUE', color: '#6366f1', summary: 'Composed dynamics, orchestral detail, and cinematic movement over groove-first writing.', artists: ['Max Richter', 'Ólafur Arnalds', 'Hans Zimmer'], moods: ['Elegant', 'Expansive', 'Reflective'], era: 'Classical foundations with modern soundtrack sensibility', tiles: [{ name: 'Orchestral', emoji: '\uD83C\uDFBB', bpm: 100, rhythm: 'Waltz', instruments: ['Violin', 'Viola', 'Cello', 'French Horn', 'Trumpet'] }, { name: 'Baroque', emoji: '\uD83C\uDFBC', bpm: 120, rhythm: 'Waltz', instruments: ['Violin', 'Cello', 'Organ', 'Flute'] }, { name: 'Contemporary', emoji: '\uD83C\uDFB5', bpm: 80, rhythm: 'Waltz', instruments: ['Grand Piano', 'Violin', 'Cello'] }] },
];

// ─── Suggestion pills ─────────────────────────────────────────────────────────

export const RHYTHM_SUGGESTIONS = [
  'Steady 4/4 pulse', 'Syncopated groove', 'Half-time feel', 'Shuffle',
  'Swing', 'Double-time', 'Triplet feel', 'Polyrhythmic',
  'Laid-back groove', 'Driving pulse', 'Breakbeat', 'Waltz 3/4',
  'Four-on-the-floor', 'Dembow', 'Clave (son/rumba)', 'Two-step',
  'One-drop', 'Boom-bap swing', 'Trap hi-hat rolls', 'Motorik (krautrock)',
  'Second-line groove', 'Galloping rhythm', 'Bossa clave', 'Odd meter (7/8, 5/4)',
] as const;

export const NARRATIVE_SUGGESTIONS = [
  'Cinematic build', 'Melancholic introspection', 'Anthemic release',
  'Dark & moody', 'Euphoric energy', 'Nostalgic warmth', 'Aggressive intensity',
  'Dreamy atmosphere', 'Intimate & raw', 'Epic journey', 'Playful & upbeat',
  'Haunting & ethereal', 'Triumphant & bold', 'Bittersweet & tender',
  'Hypnotic & trance-like', 'Romantic & sensual', 'Rebellious & defiant',
  'Hopeful & uplifting', 'Mysterious & noir', 'Festive & celebratory',
  'Reflective & cinematic', 'Gritty & streetwise',
] as const;

// ─── Pure helper functions ────────────────────────────────────────────────────

/** Splits a comma-separated instrumentation string into a trimmed, non-empty array. */
export function parseInstrumentation(value: string): string[] {
  return value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
}

/** Returns the sub-style entries for a given tile name, falling back to a parent genre. */
export function getSubStyleEntries(tileName: string): SubStyleEntry[] {
  return SUB_STYLE_DATA[tileName] ?? SUB_STYLE_DATA[TILE_SUBSTYLE_FALLBACK[tileName] ?? ''] ?? [];
}

/** Returns sub-style names for a given tile name. */
export function getSubStyleNames(tileName: string): string[] {
  return getSubStyleEntries(tileName).map(e => e.name);
}

/** Builds the hover tooltip shown on vibe genre tiles. */
export function buildGenreTooltip(
  summary: string,
  tile: { name: string; bpm: number; rhythm: string; instruments: string[] },
): string {
  return `${tile.name}\n${summary}\n${tile.bpm} BPM · ${tile.rhythm}\n${tile.instruments.join(', ')}`;
}
