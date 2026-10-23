// Builds the FLUX.2-klein jobs for Aakhri Local: locked cast portraits, then EP1's 15 shots conditioned on them.
// node build_jobs.js  -> jobs/cast.json, jobs/ep01.json
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const MODEL = 'D:\\ai\\models\\flux2-klein-4b-int4-ov';
const STYLE = 'Cinematic anime film still, semi-realistic painted anime art like a Makoto Shinkai movie, detailed hand-painted lighting, soft depth of field, film grain.';

// locked looks (series_bible.md); every prompt repeats them word for word
const MEERA = 'Meera, a 26-year-old Indian woman with warm brown skin, long black hair in a low side braid over her right shoulder, tired kind brown eyes, wearing light-blue nurse scrubs under a loose grey cardigan, a hospital ID lanyard and a canvas tote bag';
const OLDMAN = 'an elderly Indian man of 68 with neat white hair, a thick white moustache, round gold wire-rimmed glasses, a brown wool sweater vest over a white kurta and an old brown leather satchel, lit by a soft warm amber glow';
const TC = 'a middle-aged Indian railway ticket checker with short black hair greying at the temples, a black moustache, a black coat over a white shirt and a brass T.C. badge';
const COACH = 'inside an empty Mumbai local train coach at night, green bench seats, steel grab handles, flickering white tube lights, rain on the windows, city lights streaking past';

const ref = n => path.join(ROOT, 'refs', 'cast', `${n}.png`);
const out = (ep, id) => path.join(ROOT, ep, 'shots_ai', `${id}.png`);

const cast = {
  model: MODEL, width: 576, height: 1024, steps: 4,
  items: [1, 2, 3, 4].flatMap(seed => [
    { id: `meera_${seed}`, seed, out: path.join(ROOT, 'refs', 'cast', 'options', `meera_${seed}.png`),
      prompt: `${STYLE} Character portrait of ${MEERA}. Upper body, facing the viewer, gentle tired expression, standing outside a hospital at night in light rain, cold blue light with a warm rim light.` },
    { id: `oldman_${seed}`, seed, out: path.join(ROOT, 'refs', 'cast', 'options', `oldman_${seed}.png`),
      prompt: `${STYLE} Character portrait of ${OLDMAN}. Upper body, sitting on a green train seat with the satchel on his lap, kind gentle smile, looking at the viewer, night train interior.` },
    ...(seed <= 2 ? [{ id: `tc_${seed}`, seed, out: path.join(ROOT, 'refs', 'cast', 'options', `tc_${seed}.png`),
      prompt: `${STYLE} Character portrait of ${TC}. Upper body, holding a ticket punch, stern frown, inside a night train coach under fluorescent light.` }] : []),
  ]),
};

// [id, refs, prompt]
const S = [
  ['s01', ['meera'], `${STYLE} Medium-wide shot: ${MEERA}, stepping out of glowing hospital glass doors at night in heavy rain, checking her cracked silver wristwatch, exhausted. A red EMERGENCY sign glows above, wet ground reflects cyan and red light.`],
  ['s02', ['meera'], `${STYLE} High angle looking down a wet railway station staircase at night: ${MEERA}, running down the steps, braid swinging, motion blur. A large old platform clock at the bottom shows 1:11. Yellow sodium lights, puddles.`],
  ['s03', [], `${STYLE} Low angle at track level on an empty Mumbai railway platform at night in heavy rain: a white and purple Mumbai suburban local train arrives, its single bright headlight blooming, rain lit like needles. A lone small figure of a nurse in a grey cardigan stands at the platform edge.`],
  ['s04', ['meera'], `${STYLE} Wide shot ${COACH}: ${MEERA}, slumped exhausted on a green seat by the window, head resting against the glass, eyes half closed. One tube light flickers.`],
  ['s05', ['oldman'], `${STYLE} Medium shot ${COACH}: sitting on the seat directly opposite the camera is ${OLDMAN}. Satchel on his lap, hands folded on it, a gentle knowing smile. He alone is lit warm amber, everything else cold blue. Blurred raindrops on glass in the foreground.`],
  ['s06', ['meera'], `${STYLE} Close-up side profile of ${MEERA}, leaning her head on a rain-streaked train window at night, orange and white city lights streaking across her face, tired heavy eyes, polite faint smile.`],
  ['s07', ['oldman'], `${STYLE} Over-the-shoulder shot from behind a young woman's blurred dark braid and grey cardigan: ${OLDMAN}, leaning forward and holding out a small old yellowed cardboard train ticket between two fingers, kind smile, warm light, ${COACH}.`],
  ['s08', ['meera'], `${STYLE} Medium close-up of ${MEERA}, sitting in a night train, taking an old yellowed cardboard train ticket from an elderly hand reaching in from the right, puzzled polite smile, warm light touching one side of her face.`],
  ['s09', [], `${STYLE} Extreme close-up, top down: a young Indian woman's brown palm holding an old yellowed Indian Railways cardboard ticket with faded print reading "VT - THANE 14-07-1975 SEAT 0", one corner scorched black. A cracked silver wristwatch on her wrist and the grey cardigan cuff. Dim train light.`],
  ['s10', ['meera'], `${STYLE} Close-up of ${MEERA}, looking up from a ticket in her hands with an amused, curious half-laugh, about to speak, night train interior with cold blue light.`],
  ['s11', [], `${STYLE} Point-of-view shot ${COACH}: the green bench seat opposite is completely empty, a faint dent where someone sat, rain streaming down the dark window behind it. Eerie cold blue light, no people.`],
  ['s12', ['meera'], `${STYLE} Wide shot from the far end of an empty night Mumbai local train coach: ${MEERA}, standing alone in the middle of the aisle, looking around anxiously, open doors on both sides show only black rain, swaying grab handles.`],
  ['s13', ['meera', 'tc'], `${STYLE} Two-shot ${COACH}: ${MEERA}, shaken, pointing at an empty seat, while ${TC}, punches her train pass with a ticket punch and looks puzzled.`],
  ['s14', ['tc'], `${STYLE} Medium close-up, slightly low angle: ${TC}, frowning and glancing around an empty night train coach, uneasy, flickering tube light above.`],
  ['s15', [], `${STYLE} Extreme close-up: a young Indian woman's trembling brown hand holding an old yellowed train ticket, a cracked silver wristwatch on her wrist clearly showing 1:12, grey cardigan cuff, dark night train background, dramatic light.`],
];
const ep01 = {
  model: MODEL, width: 576, height: 1024, steps: 4,
  items: S.map(([id, refs, prompt]) => ({ id, seed: 7, prompt, refs: refs.map(ref), out: out('ep01', id) })),
};

// EP2 "Seat 0" (ep02/ep02_script.md)
const TIFFIN = 'a small round two-tier steel tiffin box';
const S2 = [
  ['s01', `${STYLE} Wide shot of a long empty railway platform at night in light drizzle: ${MEERA}, standing alone in a cone of cold light under a flickering station sign, holding an old yellowed train ticket in both hands, darkness on both sides.`],
  ['s02', `${STYLE} Close-up of ${MEERA}, a bright train headlight sweeping across her face from the side, scared but determined eyes, rain, night.`],
  ['s03', `${STYLE} Shot from inside ${COACH.replace('inside ', '')}: ${OLDMAN}, sitting with ${TIFFIN} on his lap, looking up warmly at a young nurse in a grey cardigan stepping in through the doorway.`],
  ['s04', `${STYLE} Medium shot ${COACH}: ${MEERA}, sitting stiffly on a green seat gripping her tote bag strap, tense and suspicious, looking across at someone.`],
  ['s05', `${STYLE} Medium close-up ${COACH}: ${OLDMAN}, chuckling and turning his head to look out of the rain-streaked window at the city lights, nostalgic.`],
  ['s06', `${STYLE} Close-up of an elderly Indian man's wrinkled hands patting ${TIFFIN} resting on his lap, brown wool sweater vest and white kurta, warm amber light, night train interior.`],
  ['s07', `${STYLE} Close-up of ${MEERA}, laughing softly with her eyes crinkling, her guard down, warm light touching one side of her face, city lights streaking behind her through the train window.`],
  ['s08', `${STYLE} Symmetrical wide two-shot ${COACH}: ${OLDMAN}, telling a story with hand gestures on one side, while ${MEERA}, leans in listening on the other side; warm amber light on his side and cold blue light on hers meeting in the middle of the aisle.`],
  ['s09', `${STYLE} Close-up of ${MEERA}, asking a gentle sincere question, soft eyes, mixed warm and cold light, night train interior.`],
  ['s10', `${STYLE} Medium shot ${COACH}: ${OLDMAN}, smiling faintly and pointing toward the empty seat right next to the open train door, rain blowing in through the open door.`],
  ['s11', `${STYLE} Extreme close-up of a cracked silver wristwatch on a young woman's brown wrist with a grey cardigan cuff, the watch clearly showing 1:12, dim train light.`],
  ['s12', `${STYLE} Wide shot of an empty night Mumbai local train coach with its fluorescent tube lights flickering, almost completely dark, eerie, no people.`],
  ['s13', `${STYLE} Medium shot ${COACH}: ${MEERA}, half standing up from her seat in shock, wide eyes, staring at the empty seat opposite her, cold blue light.`],
  ['s14', `${STYLE} ${TIFFIN} sitting alone on an empty green train bench seat, a thin wisp of steam rising from it, faint warm glow around it, empty night train coach, no people.`],
  ['s15', `${STYLE} Top-down close-up: a young Indian woman's brown hands opening ${TIFFIN}, fresh glistening orange jalebis inside, and "14-7-75" scratched by hand on the underside of the lid, warm light from inside the box.`],
];
const ep02 = { model: MODEL, width: 576, height: 1024, steps: 4, items: S2.map(([id, prompt]) => ({ id, seed: 7, prompt, out: out('ep02', id) })) };

fs.mkdirSync(path.join(__dirname, 'jobs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'jobs', 'cast.json'), JSON.stringify(cast, null, 1));
fs.writeFileSync(path.join(__dirname, 'jobs', 'ep01.json'), JSON.stringify(ep01, null, 1));
fs.writeFileSync(path.join(__dirname, 'jobs', 'ep02.json'), JSON.stringify(ep02, null, 1));
console.log('cast', cast.items.length, 'ep01', ep01.items.length, 'ep02', ep02.items.length);
