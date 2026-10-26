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

// EP3 "1975" (ep03/ep03_script.md): new locked looks for Meera off duty and the archive clerk; sepia for the 1975 flashback
const MEERA_OFF = 'Meera, a 26-year-old Indian woman with warm brown skin, long black hair in a low side braid over her right shoulder, tired kind brown eyes, wearing a mustard yellow kurta with jeans, a grey cardigan tied around her waist and a canvas tote bag';
const CLERK = 'a thin elderly Indian archive clerk with thick black-rimmed spectacles, a grey sleeveless sweater over a white shirt and a pencil behind his ear';
const SEPIA = 'Sepia-toned 1970s flashback, faded vintage film grain, cinematic anime film still, semi-realistic painted anime art like a Makoto Shinkai movie.';
const ARCHIVE = 'inside a huge old colonial railway archive room with towering wooden shelves of red cloth-bound registers, slow ceiling fans and light shafts through tall windows';
const S3 = [
  ['s01', `${STYLE} Low-angle wide shot of the gothic Victorian Chhatrapati Shivaji Terminus railway station in Mumbai on an overcast monsoon morning, pigeons taking off, crowds of commuters, ${MEERA_OFF}, walking against the crowd.`],
  ['s02', `${STYLE} From behind: ${MEERA_OFF}, pushing open a tall heavy old teak door with a brass plate in a colonial corridor with arches, daylight, dust in the light.`],
  ['s03', `${STYLE} High-angle wide shot ${ARCHIVE}, dust floating in the light, ${MEERA_OFF}, small in the frame walking down the aisle.`],
  ['s04', `${STYLE} Medium close-up ${ARCHIVE}: ${CLERK}, sitting at a cluttered desk with files and a rubber stamp, peering skeptically over his spectacles at an old yellowed train ticket.`],
  ['s05', `${STYLE} Close-up: an old red cloth-bound register open on a desk, handwritten ink ledger entries, an elderly finger stopping on one line, dust in the air, warm daylight.`],
  ['s06', `${STYLE} Medium shot ${ARCHIVE}: ${MEERA_OFF}, sitting alone at a long wooden table under a green banker's lamp, carefully unfolding a large brittle yellowed newspaper.`],
  ['s07', `${STYLE} Top-down: an old yellowed 1975 English newspaper front page on a wooden table, a large headline about a train fire, a grainy black and white photo of a man silhouetted in smoke carrying a baby.`],
  ['s08', `${SEPIA} A 1970s Mumbai local train coach on fire at night, flames and thick smoke, silhouettes of people running on the platform in panic.`],
  ['s09', `${SEPIA} ${OLDMAN.replace(', lit by a soft warm amber glow', '')}, stepping out of thick smoke from a burning train door at night, cradling a crying baby wrapped in a red and gold embroidered shawl, soot on his face, heroic.`],
  ['s10', `${SEPIA} On a 1970s railway platform at night, an elderly Indian man with white hair, round glasses and a leather satchel hands a baby in an embroidered shawl to a railway porter in a red kurta with a brass arm badge, then turns toward the burning train, flames ahead of him.`],
  ['s11', `${STYLE} Close-up ${ARCHIVE.replace('inside ', 'in ')}: ${MEERA_OFF}, tears welling in her eyes, touching a grainy old newspaper photo with her fingertip, green lamp light on her face.`],
  ['s12', `${STYLE} Over-the-shoulder shot of a young woman with a black braid and a mustard kurta leaning close over an old newspaper, a small grainy photo of a baby in a hospital cot with a caption, green lamp light.`],
  ['s13', `${STYLE} Extreme close-up of an old yellowed newspaper: a small grainy black and white photo of a baby in a hospital cot with a short printed caption beneath it, dramatic lamp light.`],
  ['s14', `${STYLE} Close-up ${ARCHIVE.replace('inside ', 'in ')}: ${MEERA_OFF}, pale with shock, staring down at a newspaper, a ceiling fan blurred in the background.`],
  ['s15', `${STYLE} Close-up: a young Indian woman's shaking brown hand holding a smartphone showing an incoming call screen with a heart and a photo of a smiling middle-aged Indian woman, an old newspaper blurred behind.`],
];
const ep03 = { model: MODEL, width: 576, height: 1024, steps: 4, items: S3.map(([id, prompt]) => ({ id, seed: 7, prompt, out: out('ep03', id) })) };
fs.mkdirSync(path.join(__dirname, 'jobs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'jobs', 'ep03.json'), JSON.stringify(ep03, null, 1));

// EP4 "Sudha" (ep04/ep04_script.md): new locked look for Meera's mother
const SUDHA = 'Sudha, a 50-year-old Indian woman with warm brown skin, grey-streaked black hair in a neat bun, kind tired eyes, reading glasses on a chain around her neck, wearing a pale green cotton saree with a maroon border';
const FLAT = "in a small cozy one-room Mumbai chawl flat at night with a tiny kitchen corner, a steel utensil rack, a wall calendar and warm lamp light";
const S4 = [
  ['s01', `${STYLE} Low-angle wide shot of an old Mumbai chawl building at night, wooden balconies with clotheslines, one warm lit window, ${MEERA_OFF}, with damp hair climbing the outside wooden stairs.`],
  ['s02', `${STYLE} Medium shot ${FLAT}: ${SUDHA}, pouring chai from a small pan into two small glasses at a gas stove, steam rising.`],
  ['s03', `${STYLE} Top-down close-up of a small wooden table with two glasses of chai, a young woman's brown hand placing an old folded yellowed newspaper with a train fire headline on it, warm light.`],
  ['s04', `${STYLE} Close-up ${FLAT}: ${MEERA_OFF}, with damp hair and wet eyes, trembling as she asks a question.`],
  ['s05', `${STYLE} Medium close-up ${FLAT}: ${SUDHA}, frozen with a glass of chai halfway to her lips, staring at an old newspaper, stunned.`],
  ['s06', `${STYLE} Medium shot ${FLAT}: ${SUDHA}, sitting on the edge of a bed looking out of a window at a distant railway line and city lights at night, remembering, melancholy.`],
  ['s07', `${STYLE} Close-up ${FLAT}: ${SUDHA}, with tears in her eyes; behind her on the wall a framed photo of an older woman with a marigold garland.`],
  ['s08', `${STYLE} Low-angle shot ${FLAT}: ${SUDHA}, reaching up to take an old rusted round biscuit tin down from the top of a steel cupboard.`],
  ['s09', `${STYLE} Top-down close-up of an open rusty round biscuit tin containing a faded red and gold embroidered baby shawl and half of a burnt old yellow cardboard train ticket, warm light.`],
  ['s10', `${STYLE} Top-down: a young woman's brown hand and an older woman's brown hand side by side on a wooden table, placing a whole old yellowed train ticket next to a half-burnt identical ticket.`],
  ['s11', `${STYLE} Extreme close-up of two old yellowed cardboard train tickets lined up edge to edge, identical faded print, a scorch mark continuing across both, warm lamp light.`],
  ['s12', `${STYLE} Two-shot across a small table ${FLAT}: ${SUDHA}, and ${MEERA_OFF}, looking at each other with wet eyes, old tickets and a rusty tin between them.`],
  ['s13', `${STYLE} Close-up of a paper wall calendar showing July, the date 14 circled in red ink with a small handwritten note, warm home light.`],
  ['s14', `${STYLE} Close-up ${FLAT}: ${MEERA_OFF}, holding her mother's hand across a small table, determined face with tear tracks.`],
  ['s15', `${STYLE} Exterior view through a rain-covered window at night: a mother in a pale green saree and her daughter in a mustard kurta sitting at a small table inside a warm lit room, the lights of a passing train streaking across the glass.`],
];
const ep04 = { model: MODEL, width: 576, height: 1024, steps: 4, items: S4.map(([id, prompt]) => ({ id, seed: 7, prompt, out: out('ep04', id) })) };
fs.writeFileSync(path.join(__dirname, 'jobs', 'ep04.json'), JSON.stringify(ep04, null, 1));

fs.mkdirSync(path.join(__dirname, 'jobs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'jobs', 'cast.json'), JSON.stringify(cast, null, 1));
fs.writeFileSync(path.join(__dirname, 'jobs', 'ep01.json'), JSON.stringify(ep01, null, 1));
fs.writeFileSync(path.join(__dirname, 'jobs', 'ep02.json'), JSON.stringify(ep02, null, 1));
console.log('cast', cast.items.length, 'ep01', ep01.items.length, 'ep02', ep02.items.length);
