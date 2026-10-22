// Builds the Kaggle job for EP1's character-consistent keyframes (anime/kg_refkeys.py) from the locked cast.
// node anime/ep01c/build_job.js <adult-kabir ref> <young-kabir ref> <sameer ref> [seeds=1,2]   -> anime/ep01c/job_keys.json
// Each shot is conditioned on its main character's face plus a Canva scene for art style and lighting (night or golden hour).
// Prompts stay under SDXL's 77-token window (the plain IP-Adapter pipeline truncates longer ones).
const fs = require('fs'), path = require('path');
const [kabirRef, youngRef, sameerRef, seedArg = '1,2'] = process.argv.slice(2);
const seeds = seedArg.split(',').map(Number);
const b64 = f => fs.readFileSync(f).toString('base64');

const Q = 'anime screenshot, cinematic lighting, masterpiece, high score';
const NIGHT = 'night, dark room, blue phone light';
const GOLD = 'sunset, golden hour, warm light';
const KABIR = 'adult indian man, dark-skinned male, messy black hair, light stubble, blue collared shirt';
const YOUNG = 'young indian man, dark-skinned male, short black hair, clean-shaven, grey t-shirt, denim jacket';
const SAMEER = 'young indian man, dark-skinned male, messy wavy black hair, round face, mole under eye, red hoodie';

// [shot, face reference (or null), face scale, prompt]; the style reference follows the shot's lighting
const SHOTS = [
  ['s01', null, 0, `no humans, close-up, smartphone on wooden bedside table, screen glowing, dark bedroom, glass of water, ${NIGHT}, ${Q}`],
  ['s02', 'kabir', 0.65, `1boy, solo, ${KABIR}, lying in bed, holding phone above face, wide eyes, shocked, from above, ${NIGHT}, ${Q}`],
  ['s03', 'kabir', 0.55, `1boy, solo, ${KABIR}, sitting on edge of bed, holding phone, wide shot, small room, ceiling fan, cake on chair, ${NIGHT}, ${Q}`],
  ['s04', null, 0, `1boy, from behind, over the shoulder, thumb scrolling phone screen, blurry bedroom, ${NIGHT}, ${Q}`],
  ['s05', 'kabir', 0.7, `1boy, solo, ${KABIR}, close-up, looking down at phone, typing, tears in eyes, sad, ${NIGHT}, ${Q}`],
  ['s06', null, 0, `2boys, ${SAMEER} riding blue scooter, laughing, friend in denim jacket behind him, tree-lined road, ${GOLD}, ${Q}`],
  ['s07', null, 0, `2boys, sitting on bench at roadside chai stall, ${SAMEER} pointing and grinning, friend in denim jacket smiling, orange cat, ${GOLD}, ${Q}`],
  ['s08', 'young', 0.65, `1boy, solo, ${YOUNG}, laughing, closed eyes, holding small glass of chai, tea stall, ${GOLD}, ${Q}`],
  ['s09', 'sameer', 0.65, `1boy, solo, ${SAMEER}, gentle sincere smile, looking at viewer, sun behind head, backlighting, ${GOLD}, ${Q}`],
  ['s10', 'kabir', 0.6, `1boy, solo, ${KABIR}, sitting at wooden desk, opening drawer, old newspaper inside, desk lamp, ${NIGHT}, ${Q}`],
  ['s11', null, 0, `no humans, close-up, hands holding old yellowed newspaper clipping, photo of blue scooter by river, desk lamp, ${NIGHT}, ${Q}`],
  ['s12', 'kabir', 0.65, `1boy, solo, ${KABIR}, at desk, newspaper in one hand, glowing phone in other, frozen, shocked, desk lamp, ${NIGHT}, ${Q}`],
  ['s14', 'kabir', 0.75, `1boy, solo, ${KABIR}, extreme close-up, wide eyes, single tear, parted lips, half warm lamp light, half blue light, ${Q}`],
  ['s15', 'kabir', 0.55, `1boy, solo, ${KABIR}, grabbing dark jacket, rushing to open door, motion blur, corridor light, ${NIGHT}, ${Q}`],
  ['s16', null, 0, `no humans, empty small room, phone glowing on bed, birthday cake on chair, ceiling fan, closed door, ${NIGHT}, ${Q}`],
];  // s13 is a punched-in reuse of s11 in the edit

const neg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shots.json'), 'utf8')).negative + ', multiple views, panels, comic';
const job = {
  refs: { kabir: b64(kabirRef), young: b64(youngRef), sameer: b64(sameerRef), night: b64(path.join(__dirname, 'style_night.jpg')), gold: b64(path.join(__dirname, 'style_gold.jpg')) },
  negative: neg, steps: 24,
  items: SHOTS.map(([id, face, faceScale, prompt]) => ({ id, face, face_scale: faceScale, style: prompt.includes(GOLD) ? 'gold' : 'night', style_scale: face ? 0.35 : 0.5, prompt, seeds })),
};
fs.writeFileSync(path.join(__dirname, 'job_keys.json'), JSON.stringify(job));
console.log('wrote job_keys.json:', job.items.length, 'shots x', seeds.length, 'seeds');
