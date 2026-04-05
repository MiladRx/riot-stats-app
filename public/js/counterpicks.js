// ── CounterPicks — Smart Draft & Build Assistant ──

let _version   = '';
let _champMap  = {};
let _champList = [];
let _itemByName = {};

// ── Lanes ──
const LANES = ['top','jungle','mid','bot','support'];
const LANE_META = {
  top:     { label: 'Top Lane', short: 'TOP', emoji: '🏔' },
  jungle:  { label: 'Jungle',   short: 'JGL', emoji: '🌿' },
  mid:     { label: 'Mid Lane', short: 'MID', emoji: '⚡' },
  bot:     { label: 'Bot Lane', short: 'BOT', emoji: '🎯' },
  support: { label: 'Support',  short: 'SUP', emoji: '🛡' },
};

// ── Lane affinity sets ──
const JUNGLE_IDS = new Set(['Vi','JarvanIV','LeeSin','Hecarim','Nidalee','Rengar','Elise','Khazix','Graves','Kindred','Ivern','Kayn','Warwick','Sejuani','Amumu','Volibear','Evelynn','Shyvana','Nocturne','Diana','Ekko','Nunu','Rammus','Zac','Udyr','Fiddlesticks','Trundle','XinZhao','Skarner','Belveth','Viego','Lillia','Karthus','Taliyah','Poppy','MonkeyKing','Pantheon','Briar','Maokai','Naafiri','Masteryi','Shaco']);
const SUPPORT_IDS = new Set(['Thresh','Lulu','Janna','Soraka','Nautilus','Blitzcrank','Leona','Alistar','Braum','Bard','Nami','Sona','Taric','Morgana','Zyra','Karma','Brand','Zilean','Senna','Seraphine','Pyke','Rakan','Yuumi','Renata','Milio','Rell','Galio','Swain','Xerath','Velkoz','Heimerdinger','Neeko']);
const MARKSMAN_IDS = new Set(['Jinx','Caitlyn','Ashe','MissFortune','Jhin','Ezreal','Kaisa','Sivir','Tristana','Vayne','Draven','Lucian','Xayah','Kogmaw','Twitch','Varus','Aphelios','Samira','Zeri','Nilah']);

// ── Counter database ──
// Format: champId → [ [counterId, matchupScore 0-100], ... ]
// Score = how favoured the counter is (100 = hardest counter, 55 = slight edge)
const COUNTER_DB = {
  // ── TOP LANE ──
  Darius:      [['Vayne',72],['Quinn',70],['Teemo',68],['Fiora',65],['Malphite',62],['Gnar',60],['Jayce',59]],
  Garen:       [['Vayne',73],['Teemo',71],['Quinn',69],['Jayce',65],['Fiora',63],['Kennen',60]],
  Fiora:       [['Malphite',70],['Poppy',68],['Pantheon',66],['Camille',63],['Wukong',60],['Garen',58]],
  Camille:     [['Malphite',72],['Poppy',69],['Jax',65],['Warwick',63],['Fiora',60]],
  Malphite:    [['Fiora',74],['Vayne',71],['Camille',65],['Darius',62],['Garen',59]],
  Irelia:      [['Malphite',73],['Pantheon',70],['Renekton',67],['Garen',63],['Camille',61]],
  Renekton:    [['Nasus',68],['Fiora',65],['Camille',63],['Malphite',62],['Jayce',60]],
  Nasus:       [['Darius',71],['Renekton',69],['Camille',66],['Fiora',64],['Garen',60]],
  Riven:       [['Renekton',72],['Malphite',70],['Pantheon',67],['Garen',63],['Wukong',60]],
  Jax:         [['Teemo',73],['Pantheon',70],['Malphite',68],['Quinn',65],['Wukong',62]],
  Teemo:       [['Yorick',75],['Garen',70],['Nasus',68],['Pantheon',65],['Darius',62]],
  Shen:        [['Camille',68],['Darius',65],['Fiora',64],['Renekton',62],['Garen',60]],
  Yorick:      [['Camille',70],['Fiora',68],['Garen',65],['Renekton',63],['Illaoi',60]],
  Illaoi:      [['Fiora',72],['Garen',68],['Quinn',66],['Vayne',65],['Camille',62]],
  Wukong:      [['Malphite',71],['Camille',68],['Darius',65],['Garen',62],['Renekton',60]],
  Jayce:       [['Malphite',70],['Irelia',67],['Renekton',65],['Camille',63],['Nasus',60]],
  Kennen:      [['Malphite',72],['Garen',68],['Nasus',65],['Renekton',63],['Shen',61]],
  Pantheon:    [['Malphite',70],['Darius',68],['Garen',65],['Renekton',62],['Wukong',60]],
  Tryndamere:  [['Malphite',74],['Pantheon',71],['Garen',68],['Trundle',65],['Nasus',62]],
  Aatrox:      [['Renekton',72],['Darius',70],['Malphite',67],['Garen',64],['Fiora',62]],
  Gnar:        [['Malphite',70],['Garen',67],['Darius',65],['Renekton',63],['Camille',60]],
  Sion:        [['Vayne',72],['Fiora',70],['Camille',67],['Darius',64],['Garen',62]],
  Urgot:       [['Garen',70],['Vayne',68],['Nasus',65],['Fiora',63],['Malphite',60]],
  Maokai:      [['Vayne',73],['Fiora',70],['Camille',67],['Darius',63],['Garen',61]],
  Cho_Gath:    [['Vayne',71],['Fiora',68],['Camille',65],['Darius',62],['Renekton',60]],
  Volibear:    [['Vayne',70],['Quinn',68],['Teemo',66],['Kennen',63],['Gnar',61]],
  Mordekaiser: [['Vayne',74],['Quinn',71],['Kennen',68],['Gangplank',65],['Gnar',62]],
  Poppy:       [['Vayne',70],['Fiora',68],['Darius',65],['Camille',62],['Garen',60]],
  Ambessa:     [['Malphite',72],['Renekton',70],['Pantheon',68],['Garen',65],['Wukong',62]],

  // ── JUNGLE ──
  LeeSin:      [['Amumu',68],['Warwick',65],['Elise',63],['Hecarim',62],['Vi',60]],
  Khazix:      [['Warwick',72],['Vi',68],['Hecarim',65],['Amumu',63],['JarvanIV',61]],
  Rengar:      [['Warwick',73],['Vi',70],['Hecarim',67],['Amumu',64],['Nocturne',61]],
  Hecarim:     [['Warwick',70],['Amumu',68],['Vi',65],['Elise',62],['Khazix',60]],
  Graves:      [['Warwick',68],['Vi',65],['Elise',63],['Hecarim',61],['Amumu',59]],
  Nidalee:     [['Warwick',71],['Vi',68],['Hecarim',65],['Elise',62],['Amumu',60]],
  Elise:       [['Hecarim',68],['Vi',65],['Amumu',63],['Warwick',61],['Khazix',59]],
  Warwick:     [['Hecarim',65],['Khazix',63],['Rengar',62],['Graves',60],['Nidalee',58]],
  Amumu:       [['Hecarim',67],['Graves',64],['Nidalee',62],['Vi',60],['Elise',58]],
  Evelynn:     [['Warwick',74],['Hecarim',70],['Vi',67],['Graves',64],['Nidalee',62]],
  Vi:          [['Hecarim',66],['Amumu',64],['Warwick',62],['Graves',60],['Elise',58]],
  Nocturne:    [['Warwick',70],['Vi',67],['Hecarim',64],['Amumu',62],['Elise',60]],
  Kayn:        [['Warwick',68],['Vi',66],['Hecarim',64],['Graves',61],['Amumu',59]],
  Viego:       [['Warwick',69],['Vi',66],['Hecarim',63],['Graves',61],['Amumu',59]],
  Shyvana:     [['Vi',68],['Hecarim',65],['Warwick',63],['Graves',61],['Amumu',59]],
  Diana:       [['Warwick',69],['Vi',67],['Hecarim',64],['Graves',62],['Amumu',60]],
  Ekko:        [['Warwick',70],['Vi',68],['Hecarim',65],['Graves',62],['Amumu',60]],
  Lillia:      [['Warwick',68],['Vi',65],['Hecarim',63],['Graves',61],['Amumu',59]],
  Karthus:     [['Warwick',75],['Vi',72],['Nocturne',70],['Graves',67],['Hecarim',65]],
  JarvanIV:    [['Hecarim',65],['Graves',63],['Nidalee',61],['Elise',60],['Vi',58]],
  Belveth:     [['Warwick',71],['Vi',68],['Hecarim',65],['Graves',63],['Amumu',61]],
  Briar:       [['Warwick',70],['Vi',67],['Hecarim',65],['Amumu',62],['Elise',60]],
  Taliyah:     [['Hecarim',68],['Vi',65],['Graves',63],['Warwick',61],['Amumu',59]],
  Sejuani:     [['Hecarim',66],['Graves',64],['Vi',62],['Warwick',60],['Amumu',58]],
  Udyr:        [['Hecarim',67],['Vi',65],['Warwick',63],['Graves',61],['Amumu',59]],
  MonkeyKing:  [['Hecarim',65],['Vi',63],['Warwick',61],['Graves',60],['Amumu',58]],

  // ── MID LANE ──
  Zed:         [['Lissandra',78],['Malzahar',76],['Galio',74],['Anivia',70],['Fizz',67],['Diana',65]],
  Fizz:        [['Malzahar',75],['Lissandra',72],['Galio',70],['Anivia',68],['Zed',65]],
  Yasuo:       [['Malzahar',80],['Annie',74],['Galio',72],['Anivia',70],['Lissandra',68]],
  Yone:        [['Malzahar',78],['Annie',73],['Galio',71],['Lissandra',69],['Anivia',67]],
  Katarina:    [['Malzahar',80],['Galio',76],['Lissandra',74],['Diana',68],['Kassadin',65]],
  Akali:       [['Malzahar',77],['Galio',74],['Lissandra',72],['Anivia',68],['Diana',65]],
  Syndra:      [['Zed',65],['Fizz',63],['Katarina',62],['Talon',60],['Akali',58]],
  Orianna:     [['Zed',67],['Fizz',65],['Katarina',63],['Akali',61],['Talon',59]],
  LeBlanc:     [['Malzahar',76],['Galio',73],['Lissandra',71],['Anivia',68],['Diana',65]],
  Viktor:      [['Zed',66],['Fizz',64],['Katarina',62],['Talon',61],['Akali',59]],
  Cassiopeia:  [['Zed',67],['Fizz',65],['Katarina',63],['Talon',61],['Akali',59]],
  Lux:         [['Zed',70],['Fizz',68],['Katarina',66],['Talon',64],['Akali',62]],
  TwistedFate: [['Talon',80],['Zed',72],['Fizz',69],['Katarina',67],['Akali',65]],
  Ahri:        [['Zed',66],['Fizz',64],['Katarina',62],['Talon',61],['Akali',59],['LeBlanc',57]],
  Veigar:      [['Zed',72],['Fizz',70],['Katarina',68],['Talon',66],['Akali',64]],
  Sylas:       [['Lissandra',74],['Malzahar',72],['Galio',70],['Anivia',67],['Diana',64]],
  Malzahar:    [['Fizz',72],['Kassadin',70],['Zed',67],['Katarina',65],['Akali',63]],
  Talon:       [['Lissandra',76],['Malzahar',74],['Galio',72],['Anivia',68],['Diana',65]],
  Galio:       [['Zed',67],['Fizz',65],['Katarina',63],['Talon',61],['Akali',59]],
  Lissandra:   [['Zed',68],['Fizz',66],['Katarina',64],['Talon',62],['Akali',60]],
  Kassadin:    [['Talon',75],['Zed',68],['Fizz',65],['Katarina',63],['Akali',61]],
  AurelionSol: [['Zed',73],['Talon',71],['Fizz',70],['Katarina',68],['Galio',66],['LeBlanc',64],['Kassadin',63]],
  Corki:       [['Zed',67],['Talon',65],['Katarina',63],['Fizz',62],['Akali',60]],
  Ekko:        [['Lissandra',70],['Malzahar',68],['Galio',66],['Zed',63],['Anivia',61]],
  Tristana:    [['Zed',68],['Talon',66],['Katarina',64],['Fizz',62],['Akali',60]],
  Vex:         [['Zed',65],['Talon',63],['Katarina',62],['Fizz',60],['Akali',58]],
  Annie:       [['Zed',70],['Talon',68],['Katarina',66],['Fizz',64],['Akali',62]],
  Anivia:      [['Zed',67],['Talon',65],['Katarina',63],['Fizz',61],['Akali',59]],
  Ziggs:       [['Zed',69],['Talon',67],['Katarina',65],['Fizz',63],['Akali',61]],
  Xerath:      [['Zed',72],['Talon',70],['Katarina',68],['Fizz',65],['Akali',63]],
  Vel_Koz:     [['Zed',70],['Talon',68],['Katarina',66],['Fizz',64],['Akali',62]],
  VelKoz:      [['Zed',70],['Talon',68],['Katarina',66],['Fizz',64],['Akali',62]],
  Neeko:       [['Zed',67],['Talon',65],['Katarina',63],['Fizz',61],['Akali',59]],
  Naafiri:     [['Lissandra',74],['Malzahar',72],['Galio',70],['Anivia',67],['Diana',64]],
  Qiyana:      [['Lissandra',74],['Malzahar',72],['Galio',70],['Anivia',67],['Diana',64]],
  Irelia:      [['Malphite',73],['Lissandra',70],['Galio',68],['Anivia',65],['Malzahar',63]],
  Diana:       [['Zed',65],['Talon',63],['Katarina',62],['Fizz',60],['Akali',58]],
  Pantheon:    [['Lissandra',68],['Malzahar',66],['Galio',65],['Anivia',63],['Zed',61]],
  Swain:       [['Zed',68],['Talon',66],['Katarina',64],['Fizz',62],['Akali',60]],
  Rumble:      [['Zed',67],['Talon',65],['Katarina',63],['Fizz',61],['Akali',59]],

  // ── BOT LANE ──
  Jinx:        [['Draven',72],['Caitlyn',70],['Lucian',68],['Kaisa',65],['Sivir',62]],
  Caitlyn:     [['Draven',70],['Vayne',68],['Lucian',66],['Kaisa',64],['Xayah',62]],
  Ashe:        [['Draven',73],['Lucian',70],['Caitlyn',68],['Vayne',65],['Kaisa',62]],
  MissFortune: [['Draven',70],['Caitlyn',68],['Lucian',66],['Vayne',64],['Kaisa',62]],
  Jhin:        [['Draven',71],['Caitlyn',69],['Lucian',67],['Vayne',64],['Kaisa',62]],
  Ezreal:      [['Draven',72],['Caitlyn',68],['Lucian',66],['Vayne',64],['Kaisa',62]],
  Kaisa:       [['Draven',71],['Caitlyn',68],['Lucian',66],['Vayne',64],['Jhin',62]],
  Sivir:       [['Draven',70],['Caitlyn',68],['Lucian',66],['Kaisa',64],['Vayne',62]],
  Vayne:       [['Caitlyn',72],['Draven',70],['Lucian',68],['Kaisa',65],['MissFortune',62]],
  Draven:      [['Caitlyn',68],['Vayne',65],['Lucian',64],['Kaisa',62],['Ezreal',60]],
  Xayah:       [['Draven',71],['Caitlyn',68],['Lucian',66],['Kaisa',64],['Vayne',62]],
  Samira:      [['Caitlyn',73],['Draven',70],['Lucian',68],['Kaisa',65],['Vayne',63]],
  Zeri:        [['Draven',70],['Caitlyn',68],['Lucian',66],['Kaisa',64],['Vayne',62]],
  Aphelios:    [['Draven',71],['Caitlyn',69],['Lucian',67],['Kaisa',65],['Vayne',63]],
  Nilah:       [['Caitlyn',72],['Draven',70],['Lucian',68],['Kaisa',65],['Vayne',63]],
  Kogmaw:      [['Draven',73],['Caitlyn',71],['Lucian',69],['Kaisa',66],['Vayne',64]],
  Twitch:      [['Caitlyn',74],['Draven',72],['Lucian',70],['Kaisa',67],['Vayne',65]],
  Varus:       [['Draven',70],['Caitlyn',68],['Lucian',66],['Kaisa',64],['Vayne',62]],
  Tristana:    [['Caitlyn',70],['Draven',68],['Lucian',66],['Kaisa',64],['Vayne',62]],

  // ── SUPPORT ──
  Thresh:      [['Blitzcrank',68],['Leona',66],['Nautilus',65],['Pyke',63],['Brand',61]],
  Lulu:        [['Blitzcrank',70],['Leona',68],['Nautilus',66],['Brand',64],['Pyke',62]],
  Janna:       [['Blitzcrank',71],['Leona',69],['Nautilus',67],['Brand',65],['Pyke',63]],
  Soraka:      [['Blitzcrank',72],['Leona',70],['Nautilus',68],['Brand',65],['Pyke',63]],
  Nautilus:    [['Thresh',67],['Lulu',65],['Janna',64],['Soraka',62],['Brand',60]],
  Leona:       [['Thresh',67],['Lulu',65],['Janna',64],['Soraka',62],['Brand',60]],
  Blitzcrank:  [['Thresh',68],['Lulu',66],['Janna',65],['Soraka',63],['Brand',61]],
  Pyke:        [['Lulu',72],['Thresh',68],['Janna',66],['Soraka',64],['Brand',62]],
  Brand:       [['Thresh',66],['Lulu',64],['Janna',63],['Soraka',61],['Nautilus',59]],
  Morgana:     [['Blitzcrank',70],['Leona',67],['Nautilus',65],['Pyke',63],['Brand',61]],
  Zyra:        [['Thresh',66],['Lulu',64],['Janna',63],['Soraka',61],['Nautilus',59]],
  Alistar:     [['Thresh',66],['Lulu',64],['Janna',63],['Soraka',61],['Brand',59]],
  Braum:       [['Thresh',66],['Lulu',64],['Janna',63],['Soraka',61],['Brand',59]],
  Karma:       [['Blitzcrank',68],['Leona',66],['Nautilus',64],['Pyke',62],['Brand',60]],
  Nami:        [['Blitzcrank',69],['Leona',67],['Nautilus',65],['Pyke',63],['Brand',61]],
  Bard:        [['Blitzcrank',67],['Leona',65],['Nautilus',63],['Brand',61],['Pyke',59]],
  Sona:        [['Blitzcrank',73],['Leona',71],['Nautilus',69],['Brand',66],['Pyke',64]],
  Yuumi:       [['Blitzcrank',75],['Leona',73],['Nautilus',71],['Brand',68],['Pyke',66]],
  Seraphine:   [['Blitzcrank',70],['Leona',68],['Nautilus',66],['Brand',63],['Pyke',61]],
  Milio:       [['Blitzcrank',70],['Leona',68],['Nautilus',66],['Brand',63],['Pyke',61]],
  Rakan:       [['Thresh',68],['Lulu',66],['Janna',65],['Soraka',63],['Brand',61]],
  Senna:       [['Blitzcrank',70],['Leona',68],['Nautilus',66],['Pyke',63],['Brand',61]],
  Swain:       [['Thresh',67],['Lulu',65],['Janna',64],['Soraka',62],['Brand',60]],
  Rell:        [['Thresh',67],['Lulu',65],['Janna',64],['Soraka',62],['Brand',60]],
  Taric:       [['Blitzcrank',68],['Leona',66],['Brand',64],['Pyke',62],['Nautilus',60]],
  Renata:      [['Blitzcrank',70],['Leona',68],['Nautilus',66],['Brand',63],['Pyke',61]],
  Zilean:      [['Blitzcrank',70],['Leona',68],['Nautilus',66],['Brand',63],['Pyke',61]],
};

// Specific reasons (counter → enemy)
const COUNTER_REASONS = {
  Malphite:    { Zed:'Passive absorbs burst. R interrupts dashes and wind wall.', Irelia:'R cancels her dashes mid-combo.', default:'Hard CC and tankiness neutralize melee gap-closers.' },
  Lissandra:   { Zed:'E escapes death mark. R on herself negates his burst.', Katarina:'R stops her mid-spin. Your CC chain denies resets.', default:'Multiple CC abilities shut down anyone who dives.' },
  Malzahar:    { Yasuo:'R suppression fully bypasses wind wall.', Katarina:'R suppression cancels her spin mid-combo.', Zed:'R prevents death mark from activating.', TwistedFate:'Counterpush and roam denial — shove and follow his picks.', AurelionSol:'Silence zone denies his roam setup. R locks him down.', default:'R suppression counters any diving or roaming assassin.' },
  Galio:       { Zed:'W taunts through his shadow.', TwistedFate:'R covers the map faster than TF can roam.', default:'Magic shield and hard CC punish AP champions hard.' },
  Talon:       { TwistedFate:'Your roam speed matches his. Kill his targets before he does.', AurelionSol:'Assassinate him before he gets range. His immobility hurts.', default:'Fast roam speed and burst pressure follows his roam windows.' },
  Warwick:     { default:'Built-in healing, powerful 1v1, and suppression on gank secures kills.' },
  Vi:          { default:'Unstoppable R engage ignores dashes. Point-and-click CC on gank.' },
  Draven:      { default:'Oppressive early laner — zone them off CS and punish each catch.' },
  Caitlyn:     { default:'Superior range forces enemies to play passively and miss CS.' },
  Vayne:       { Darius:'True damage bypasses armor stacks completely.', Malphite:'Silver Bolts shred your HP regardless of armor.', default:'True damage ignores tankiness — scales into unkillable carry.' },
  Fiora:       { Malphite:'Parry blocks your R engage completely.', Darius:'Parry on Hemorrhage removes entire bleed stack.', default:'Parry punishes telegraphed CC abilities hard.' },
  Camille:     { Fiora:'Hookshot gap-close and true damage are strong in the matchup.', default:'True damage and mobility give a decisive edge in trades.' },
  Fizz:        { Zed:'Playful/Trickster dodges his combo and death mark.', Syndra:'Pole Vault dodges her stun combo and burst.', default:'E dodge negates the most dangerous ability in the matchup.' },
  Kassadin:    { AurelionSol:'Outscale him hard. R spam makes him useless at 3 items.', default:'Ult spam makes him unkillable and uncatchable at 3 items.' },
};

// Composition-based counters
const COMP_COUNTERS = {
  heavy_ap:       { trait:'Magic Resist',    champs:['Malphite','Galio','Morgana','Maokai','Shen','Sion','Diana','Kayle','Wukong','Garen'] },
  heavy_ad:       { trait:'Armor / Dodge',   champs:['Malphite','Rammus','Jax','Wukong','Quinn','Teemo','Nasus','Poppy','Renekton','Garen'] },
  heavy_tank:     { trait:'Armor Pen',       champs:['Fiora','Vayne','Camille','Kayle','Jayce','Gnar','Kennen','Quinn','Aatrox','Gangplank'] },
  heavy_assassin: { trait:'Shields / CC',    champs:['Lissandra','Malzahar','Galio','Morgana','Lulu','Janna','Karma','Soraka','Renata','Zilean'] },
  heavy_heal:     { trait:'Grievous Wounds', champs:['Katarina','Brand','Karthus','Cassiopeia','Varus','MissFortune','Tristana','Singed','Fizz','Mordekaiser'] },
  heavy_cc:       { trait:'CC Immunity',     champs:['Olaf','Morgana','Lissandra','Gangplank','Sivir','Kayle','Hecarim','Fiora','Garen','Urgot'] },
  heavy_engage:   { trait:'Disengage',       champs:['Janna','Lulu','Soraka','Nami','Karma','Sivir','Vayne','Quinn','Yasuo','Tristana'] },
};

// Item data
const ITEM_NAMES = {
  lethality:    ['Duskblade of Draktharr','Eclipse',"Serylda's Grudge",'Edge of Night','Axiom Arc','Opportunity'],
  ad_crit:      ['Infinity Edge','Galeforce','Kraken Slayer','Phantom Dancer','Immortal Shieldbow','Navori Flickerblade','Collector'],
  ad_bruiser:   ['Trinity Force','Ravenous Hydra',"Sterak's Gage",'Black Cleaver','Stridebreaker','Sundered Sky'],
  ap_damage:    ["Shadowflame","Luden's Companion",'Stormsurge','Hextech Rocketbelt','Malignance','Horizon Focus'],
  magic_resist: ["Banshee's Veil",'Force of Nature','Maw of Malmortius','Spirit Visage','Kaenic Rookern'],
  anti_heal_ad: ['Mortal Reminder','Chempunk Chainsword'],
  anti_heal_ap: ['Morellonomicon'],
  tank_bust_ad: ["Serylda's Grudge",'Black Cleaver','Kraken Slayer'],
  tank_bust_ap: ['Void Staff','Cryptbloom'],
  boots: {
    armor:'Plated Steelcaps', mr:"Mercury's Treads", cdr:'Ionian Boots of Lucidity',
    magic:"Sorcerer's Shoes", attack:"Berserker's Greaves", swift:'Boots of Swiftness',
  },
};

// ── App state ──
const state = {
  enemy:     { top:null, jungle:null, mid:null, bot:null, support:null },
  ally:      { top:null, jungle:null, mid:null, bot:null, support:null },
  myLane:    'mid',
  myChamp:   null,
  playstyle: 'carry',
  pickerTarget: null,
};

// ── Helpers ──
function champImgUrl(c) { return `https://ddragon.leagueoflegends.com/cdn/${_version}/img/champion/${c.image.full}`; }
function itemImgUrl(id)  { return `https://ddragon.leagueoflegends.com/cdn/${_version}/img/item/${id}.png`; }
function getItem(name) {
  if (!name) return null;
  const key = name.toLowerCase();
  if (_itemByName[key]) return _itemByName[key];
  for (const [k, item] of Object.entries(_itemByName)) {
    if (k.includes(key) || key.includes(k)) return item;
  }
  return null;
}
function resolveItems(names) { return names.map(n => getItem(n)).filter(Boolean); }
function getDamageType(c) {
  const a = c.info?.attack||0, m = c.info?.magic||0;
  if (m > a+2) return 'AP'; if (a > m+2) return 'AD'; return 'MIXED';
}
function getRole(c) {
  const t = c.tags||[];
  if (t.includes('Assassin')) return 'assassin';
  if (t.includes('Mage'))     return 'mage';
  if (t.includes('Marksman')) return 'marksman';
  if (t.includes('Tank'))     return 'tank';
  if (t.includes('Support'))  return 'support';
  if (t.includes('Fighter'))  return 'fighter';
  return 'fighter';
}
function getPrimaryLane(c) {
  const id=c.id, t=c.tags||[];
  if (JUNGLE_IDS.has(id))                                 return 'jungle';
  if (MARKSMAN_IDS.has(id) && !SUPPORT_IDS.has(id))       return 'bot';
  if (t.includes('Support') || SUPPORT_IDS.has(id))       return 'support';
  if (t.includes('Assassin') && !t.includes('Fighter'))   return 'mid';
  if (t.includes('Mage') && !t.includes('Fighter') && !t.includes('Tank')) return 'mid';
  if (t.includes('Fighter') || t.includes('Tank'))        return 'top';
  return 'top';
}

// ── Init ──
async function init() {
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r=>r.json());
    _version = versions[0];
    const [champR, itemR] = await Promise.all([
      fetch(`https://ddragon.leagueoflegends.com/cdn/${_version}/data/en_US/champion.json`).then(r=>r.json()),
      fetch(`https://ddragon.leagueoflegends.com/cdn/${_version}/data/en_US/item.json`).then(r=>r.json()),
    ]);
    _champMap  = champR.data;
    _champList = Object.values(_champMap).sort((a,b)=>a.name.localeCompare(b.name));
    for (const [id,item] of Object.entries(itemR.data)) {
      if (!item.maps?.['11'] || !item.gold?.purchasable || item.gold.total < 1000 || item.consumed) continue;
      _itemByName[item.name.toLowerCase()] = { id, ...item };
    }
    document.getElementById('cp-loading').classList.add('hidden');
    document.getElementById('cp-builder').classList.remove('hidden');
    renderLaneGrid('enemy');
    renderLaneGrid('ally');
    renderLanePillsBig();
    document.getElementById('cp-picker-search').addEventListener('input', e=>renderPickerGrid(e.target.value));
    document.getElementById('cp-picker-overlay').addEventListener('click', e=>{
      if (e.target===document.getElementById('cp-picker-overlay')) closePicker();
    });
  } catch(err) {
    document.getElementById('cp-loading').innerHTML =
      `<div class="cp-loading-text" style="color:var(--red)">Failed to load data. Check your connection.</div>`;
  }
}

// ── Lane grid ──
function renderLaneGrid(team) {
  const grid = document.getElementById(`${team}-lane-grid`);
  grid.innerHTML = LANES.map(lane => {
    const m = LANE_META[lane];
    return `<div class="cp-lane-col">
      <div class="cp-lane-header">
        <span class="cp-lane-emoji">${m.emoji}</span>
        <span class="cp-lane-short">${m.short}</span>
      </div>
      <div class="cp-lane-slot empty" id="${team}-${lane}" onclick="openPickerForLane('${team}','${lane}')">
        <span class="cp-slot-plus-lane">+</span>
      </div>
    </div>`;
  }).join('');
}

function updateLaneSlot(team, lane) {
  const champ    = state[team][lane];
  const el       = document.getElementById(`${team}-${lane}`);
  const isMySlot = team==='ally' && lane===state.myLane && champ?.id===state.myChamp?.id;
  if (!champ) {
    el.className = 'cp-lane-slot empty';
    el.onclick   = ()=>openPickerForLane(team,lane);
    el.innerHTML = `<span class="cp-slot-plus-lane">+</span>`;
    return;
  }
  el.className = `cp-lane-slot filled ${team}-filled${isMySlot?' my-slot':''}`;
  el.onclick   = null;
  el.innerHTML = `
    <img src="${champImgUrl(champ)}" alt="${champ.name}" title="${champ.name}" />
    <div class="cp-lane-slot-name">${champ.name}</div>
    ${isMySlot
      ? `<div class="cp-lane-slot-you">YOU</div>`
      : `<button class="cp-lane-slot-remove" onclick="removeLaneChamp('${team}','${lane}',event)">✕</button>`}`;
}

function removeLaneChamp(team, lane, e) {
  e.stopPropagation();
  state[team][lane] = null;
  updateLaneSlot(team, lane);
  if (team === 'enemy') invalidateCounters();
}

// ── Big lane pills (step 2) ──
function renderLanePillsBig() {
  const container = document.getElementById('my-lane-pills-big');
  container.innerHTML = LANES.map(lane => {
    const m      = LANE_META[lane];
    const active = state.myLane===lane ? 'active' : '';
    return `<button class="cp-lane-pill-big ${active}" onclick="setMyLaneBig('${lane}',this)">
      <span class="cp-lpb-emoji">${m.emoji}</span>
      <span class="cp-lpb-label">${m.label}</span>
    </button>`;
  }).join('');
}

function setMyLaneBig(lane, btn) {
  state.myLane = lane;
  document.querySelectorAll('.cp-lane-pill-big').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // Reset counter results if lane changes
  document.getElementById('cp-counter-results').classList.add('hidden');
  document.getElementById('cp-picked-section').classList.add('hidden');
}

// ── Picker ──
function openPickerForLane(team, lane) {
  state.pickerTarget = { team, lane };
  const m = LANE_META[lane];
  document.getElementById('cp-picker-title').textContent =
    team==='enemy' ? `Enemy ${m.label}` : `Ally ${m.label}`;
  openPicker();
}
function openPickerForMyChamp() {
  state.pickerTarget = 'my';
  document.getElementById('cp-picker-title').textContent = 'Select Your Champion';
  openPicker();
}
function openPicker() {
  document.getElementById('cp-picker-overlay').classList.remove('hidden');
  const inp = document.getElementById('cp-picker-search');
  inp.value = ''; inp.focus();
  renderPickerGrid('');
}
function closePicker() {
  document.getElementById('cp-picker-overlay').classList.add('hidden');
  state.pickerTarget = null;
}
function renderPickerGrid(query) {
  const q = query.toLowerCase().trim();
  const taken = new Set([
    state.myChamp?.id,
    ...Object.values(state.enemy).filter(Boolean).map(c=>c.id),
    ...Object.values(state.ally).filter(Boolean).map(c=>c.id),
  ]);
  let targetLane = state.pickerTarget?.lane || null;
  let list = _champList.filter(c => {
    if (taken.has(c.id)) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });
  if (!q && targetLane) {
    list = list.sort((a,b)=>{
      const af = getPrimaryLane(a)===targetLane?0:1;
      const bf = getPrimaryLane(b)===targetLane?0:1;
      return af-bf;
    });
  }
  list = list.slice(0, 200);
  const grid = document.getElementById('cp-picker-grid');
  grid.innerHTML = list.map(c=>{
    const lane = getPrimaryLane(c);
    const m    = LANE_META[lane];
    const isMatch = targetLane && lane===targetLane;
    return `<div class="cp-picker-champ ${isMatch?'lane-match':''}" onclick="selectChamp('${c.id}')">
      <img src="${champImgUrl(c)}" alt="${c.name}" loading="lazy" />
      <span class="cp-picker-name">${c.name}</span>
      <span class="cp-picker-lane">${m.emoji} ${m.short}</span>
    </div>`;
  }).join('');
}
function selectChamp(id) {
  const champ = _champMap[id];
  if (!champ) return;
  const t = state.pickerTarget;
  if (t==='my') {
    if (state.myChamp && state.myLane && state.ally[state.myLane]?.id===state.myChamp.id) {
      state.ally[state.myLane] = null; updateLaneSlot('ally',state.myLane);
    }
    state.myChamp = champ;
    renderMyChampCard();
    syncAllyLane();
  } else if (t?.team && t?.lane) {
    state[t.team][t.lane] = champ;
    updateLaneSlot(t.team, t.lane);
    if (t.team === 'enemy') invalidateCounters();
  }
  closePicker();
}

function syncAllyLane() {
  if (!state.myChamp || !state.myLane) return;
  state.ally[state.myLane] = state.myChamp;
  updateLaneSlot('ally', state.myLane);
}

// ── My champ card (step 4) ──
function renderMyChampCard() {
  const el    = document.getElementById('my-champ-slot');
  const champ = state.myChamp;
  if (!champ) {
    el.innerHTML = `<div class="cp-slot-empty-my" onclick="openPickerForMyChamp()">
      <span class="cp-slot-plus-big">+</span>
      <span class="cp-slot-hint">Click to select</span>
    </div>`;
    return;
  }
  const dmg = getDamageType(champ);
  el.innerHTML = `
    <div class="cp-my-champ-filled">
      <img class="cp-my-champ-img" src="${champImgUrl(champ)}" alt="${champ.name}" />
      <div class="cp-my-champ-info">
        <div class="cp-my-champ-name">${champ.name}</div>
        <div class="cp-my-champ-role">${champ.tags.join(' · ')}</div>
        <span class="cp-my-champ-dmg-tag ${dmg.toLowerCase()}">${dmg} Damage</span>
      </div>
      <button class="cp-my-champ-remove" onclick="clearMyChamp()">✕</button>
    </div>`;

  // Lane pills inside picked card
  const laneEl = document.getElementById('my-lane-pills');
  laneEl.innerHTML = LANES.map(lane=>{
    const m = LANE_META[lane];
    const active = state.myLane===lane?'active':'';
    return `<button class="cp-lane-pill ${active}" onclick="setMyLane('${lane}',this)">${m.emoji} ${m.short}</button>`;
  }).join('');
}

function clearMyChamp() {
  if (state.myChamp && state.myLane && state.ally[state.myLane]?.id===state.myChamp.id) {
    state.ally[state.myLane]=null; updateLaneSlot('ally',state.myLane);
  }
  state.myChamp = null;
  renderMyChampCard();
  document.getElementById('cp-results').classList.add('hidden');
}

function setMyLane(lane, btn) {
  if (state.myLane && state.ally[state.myLane]?.id===state.myChamp?.id) {
    state.ally[state.myLane]=null; updateLaneSlot('ally',state.myLane);
  }
  state.myLane = lane;
  document.querySelectorAll('.cp-lane-pill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  syncAllyLane();
}

function setPlaystyle(ps, btn) {
  state.playstyle = ps;
  document.querySelectorAll('.cp-ps-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Invalidate stale counter results when enemy changes ──
function invalidateCounters() {
  const resultsEl = document.getElementById('cp-counter-results');
  if (!resultsEl.classList.contains('hidden')) {
    // Show a stale banner instead of hiding completely
    const meta = document.getElementById('cp-counter-meta');
    meta.innerHTML = `<span style="color:var(--orange)">⚠ Enemy team changed — click <strong>Find Counter Picks</strong> to refresh.</span>`;
    document.getElementById('cp-counter-grid').style.opacity = '0.35';
  }
}

// ── FIND COUNTERS ──
function findCounters() {
  const err = document.getElementById('cp-error-msg');
  err.classList.add('hidden');
  const enemies = Object.values(state.enemy).filter(Boolean);
  if (!enemies.length) {
    err.textContent = 'Add at least one enemy champion first.';
    err.classList.remove('hidden');
    return;
  }

  const laneEnemy  = state.enemy[state.myLane];
  const suggestions = computeCounters(laneEnemy, enemies, state.myLane);

  document.getElementById('cp-counter-grid').style.opacity = '1';
  renderCounterSuggestions(suggestions, laneEnemy);
  document.getElementById('cp-counter-results').classList.remove('hidden');
  document.getElementById('cp-counter-results').scrollIntoView({ behavior:'smooth', block:'start' });
}

function computeCounters(laneEnemy, allEnemies, myLane) {
  let sumAtk=0, sumMag=0;
  let tankCount=0, assassinCount=0, healCount=0, ccCount=0;
  for (const e of allEnemies) {
    sumAtk += e.info?.attack||0; sumMag += e.info?.magic||0;
    const r = getRole(e);
    if (r==='tank')     tankCount++;
    if (r==='assassin') assassinCount++;
    if (r==='support')  healCount++;
    const tags = e.tags||[];
    if (tags.includes('Tank') || tags.includes('Support')) ccCount++;
  }
  const total   = (sumAtk+sumMag)||1;
  const adRatio = sumAtk/total;
  const apRatio = sumMag/total;

  const enemyIds = new Set(allEnemies.map(e=>e.id));

  const scored = {};

  // Build a set of champion IDs that naturally play myLane
  const lanePool = new Set(_champList.filter(c => getPrimaryLane(c) === myLane).map(c => c.id));

  // Restrict addEntry to only accept champs in the lane pool
  const addEntryLaned = (id, matchupScore, source) => {
    const cid = normalizeId(id);
    if (!cid || !_champMap[cid] || enemyIds.has(cid)) return;
    if (!lanePool.has(cid)) return; // ← hard lane filter
    if (!scored[cid]) scored[cid] = { matchupScore: 0, compBonus: 0, sources: [] };
    if (source === 'direct') {
      if (matchupScore > scored[cid].matchupScore) scored[cid].matchupScore = matchupScore;
    } else {
      scored[cid].compBonus += matchupScore;
    }
    if (!scored[cid].sources.includes(source)) scored[cid].sources.push(source);
  };

  // 1. Direct counters — use the laneEnemy's actual DDragon id for lookup
  if (laneEnemy) {
    // Try exact id first, then normalized
    const dbKey = COUNTER_DB[laneEnemy.id]
      ? laneEnemy.id
      : Object.keys(COUNTER_DB).find(k => normalizeId(k) === laneEnemy.id);
    const entries = dbKey ? COUNTER_DB[dbKey] : [];
    entries.forEach(([id, score]) => addEntryLaned(id, score, 'direct'));
  }

  // 2. Comp-based bonuses — lane-gated
  if (adRatio > 0.65)     COMP_COUNTERS.heavy_ad.champs.forEach(id => addEntryLaned(id, 6, 'comp'));
  if (apRatio > 0.65)     COMP_COUNTERS.heavy_ap.champs.forEach(id => addEntryLaned(id, 6, 'comp'));
  if (tankCount >= 2)     COMP_COUNTERS.heavy_tank.champs.forEach(id => addEntryLaned(id, 6, 'comp'));
  if (assassinCount >= 2) COMP_COUNTERS.heavy_assassin.champs.forEach(id => addEntryLaned(id, 6, 'comp'));
  if (healCount >= 1)     COMP_COUNTERS.heavy_heal.champs.forEach(id => addEntryLaned(id, 5, 'comp'));
  if (ccCount >= 3)       COMP_COUNTERS.heavy_cc.champs.forEach(id => addEntryLaned(id, 5, 'comp'));

  // 3. Fallback — if we have fewer than 5 results, fill with top lane-pool champs
  if (Object.keys(scored).length < 5) {
    const fallback = getRoleFallbackCounters(laneEnemy, myLane);
    fallback.forEach(([id, score]) => addEntryLaned(id, score, 'direct'));
  }

  // 4. If still empty, seed ALL lane-pool champs with a base score so lane is never empty
  if (Object.keys(scored).length === 0) {
    lanePool.forEach(id => {
      if (!enemyIds.has(id)) {
        scored[id] = { matchupScore: 56, compBonus: 0, sources: ['lane'] };
      }
    });
  }

  // Calculate final percentage
  const results = Object.entries(scored)
    .map(([id, data]) => {
      const base  = data.matchupScore || 55;
      const bonus = Math.min(data.compBonus * 0.4, 10);
      const pct   = Math.min(Math.round(base + bonus), 97);
      const champ = _champMap[id];
      const reason = getCounterReason(champ, laneEnemy, data.sources, adRatio, apRatio, tankCount, assassinCount, healCount, ccCount);
      return { champ, pct, reason, isDirect: data.sources.includes('direct') };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  return { results, adRatio, apRatio, tankCount, assassinCount, healCount, laneEnemy };
}

// Role-based fallback counters, filtered to the target lane
function getRoleFallbackCounters(enemy, myLane) {
  const role = getRole(enemy);
  // Per-lane fallbacks — only champs that actually play that lane
  const laneFallbacks = {
    top: {
      assassin: [['Malphite',70],['Renekton',68],['Garen',66],['Pantheon',64],['Wukong',62]],
      mage:     [['Malphite',70],['Garen',68],['Nasus',66],['Darius',64],['Renekton',62]],
      tank:     [['Vayne',72],['Fiora',70],['Camille',68],['Gnar',65],['Jayce',63]],
      fighter:  [['Malphite',68],['Renekton',66],['Camille',64],['Garen',62],['Darius',60]],
      default:  [['Malphite',67],['Renekton',65],['Garen',63],['Camille',61],['Darius',59]],
    },
    jungle: {
      assassin: [['Warwick',72],['Vi',70],['Hecarim',67],['Amumu',65],['Nocturne',63]],
      mage:     [['Hecarim',70],['Vi',68],['Graves',66],['Warwick',64],['Amumu',62]],
      tank:     [['Hecarim',70],['Graves',68],['Vi',66],['Elise',64],['Nidalee',62]],
      fighter:  [['Warwick',70],['Vi',68],['Hecarim',65],['Graves',63],['Amumu',61]],
      default:  [['Warwick',68],['Vi',66],['Hecarim',64],['Graves',62],['Amumu',60]],
    },
    mid: {
      assassin: [['Lissandra',72],['Malzahar',70],['Galio',68],['Anivia',65],['Diana',63]],
      mage:     [['Zed',70],['Talon',68],['Fizz',66],['Katarina',64],['Akali',62]],
      fighter:  [['Malzahar',70],['Lissandra',68],['Galio',66],['Anivia',64],['Diana',62]],
      tank:     [['Zed',68],['Fizz',66],['Katarina',64],['Talon',62],['Akali',60]],
      default:  [['Galio',67],['Lissandra',65],['Malzahar',63],['Zed',62],['Fizz',60]],
    },
    bot: {
      marksman: [['Draven',70],['Caitlyn',68],['Lucian',66],['Kaisa',64],['Vayne',62]],
      mage:     [['Draven',68],['Caitlyn',66],['Lucian',64],['Vayne',62],['Kaisa',60]],
      support:  [['Draven',67],['Caitlyn',65],['Lucian',63],['Kaisa',61],['Vayne',59]],
      default:  [['Caitlyn',67],['Draven',65],['Lucian',63],['Kaisa',61],['Vayne',59]],
    },
    support: {
      tank:     [['Thresh',68],['Lulu',66],['Janna',65],['Soraka',63],['Brand',61]],
      mage:     [['Thresh',68],['Lulu',66],['Morgana',64],['Janna',62],['Soraka',60]],
      support:  [['Blitzcrank',68],['Leona',66],['Brand',64],['Pyke',62],['Nautilus',60]],
      default:  [['Thresh',67],['Lulu',65],['Janna',63],['Soraka',61],['Brand',59]],
    },
  };
  const laneMap = laneFallbacks[myLane] || laneFallbacks.mid;
  return laneMap[role] || laneMap.default;
}

function normalizeId(name) {
  if (!name) return null;
  // Exact match
  if (_champMap[name]) return name;
  // Strip apostrophes, spaces, dots — match case-insensitively
  const clean = name.replace(/['\s.\-_]/g, '').toLowerCase();
  const found = Object.keys(_champMap).find(id => id.toLowerCase().replace(/['\s.\-_]/g,'') === clean);
  return found || null;
}

function getCounterReason(champ, laneEnemy, sources, adRatio, apRatio, tankCount, assassinCount, healCount, ccCount) {
  // Check curated reason first
  if (laneEnemy && COUNTER_REASONS[champ.id]) {
    const entry = COUNTER_REASONS[champ.id];
    if (entry[laneEnemy.id]) return entry[laneEnemy.id];
    if (entry.default)       return entry.default;
  }

  // Build a contextual reason
  const reasons = [];
  if (sources.includes('direct') && laneEnemy) {
    reasons.push(`Strong lane matchup against ${laneEnemy.name}`);
  }
  if (sources.includes('comp')) {
    if (adRatio > 0.65)     reasons.push('handles heavy AD comps well');
    if (apRatio > 0.65)     reasons.push('naturally resists magic-heavy teams');
    if (tankCount >= 2)     reasons.push('armor penetration shreds their tanks');
    if (assassinCount >= 2) reasons.push('CC or shields neutralize their assassins');
    if (healCount >= 1)     reasons.push('applies Grievous Wounds to deny healing');
    if (ccCount >= 3)       reasons.push('CC immunity or cleanse avoids their lockdown');
  }
  return reasons.length ? reasons.join(' · ') + '.' : `Effective pick for the ${state.myLane} role against this composition.`;
}

function renderCounterSuggestions(data, laneEnemy) {
  const { results, adRatio, apRatio, tankCount, assassinCount, healCount } = data;
  const m = LANE_META[state.myLane];

  // Meta line
  let metaParts = [];
  if (laneEnemy)          metaParts.push(`Countering <strong>${laneEnemy.name}</strong> in ${m.label}`);
  else                    metaParts.push(`Best picks for ${m.label}`);
  if (adRatio > 0.65)     metaParts.push('vs heavy AD');
  else if (apRatio > 0.65)metaParts.push('vs heavy AP');
  if (tankCount >= 2)     metaParts.push('armor pen needed');
  if (assassinCount >= 2) metaParts.push('anti-assassin');
  if (healCount >= 1)     metaParts.push('anti-heal value');
  document.getElementById('cp-counter-meta').innerHTML = metaParts.join(' · ');

  if (!results.length) {
    document.getElementById('cp-counter-grid').innerHTML =
      `<div style="color:var(--text3);font-size:0.82rem;padding:8px 0">No specific counters found. Try adding more enemy champions.</div>`;
    return;
  }

  document.getElementById('cp-counter-grid').innerHTML = results.map((r, i) => {
    const pctColor = r.pct >= 75 ? '#32d7c3' : r.pct >= 65 ? '#ffd60a' : 'var(--text3)';
    const pctBarColor = r.pct >= 75 ? 'rgba(50,215,195,0.7)' : r.pct >= 65 ? 'rgba(255,214,10,0.7)' : 'rgba(255,255,255,0.25)';
    const rankLabel = i === 0 ? '★' : `${i+1}`;
    return `
    <div class="cp-counter-card ${r.isDirect?'is-direct':''} ${i===0?'is-top':''}}" onclick="selectCounterPick('${r.champ.id}')">
      <div class="cp-counter-rank ${i===0?'rank-gold':''}">${rankLabel}</div>
      <img class="cp-counter-img" src="${champImgUrl(r.champ)}" alt="${r.champ.name}" />
      <div class="cp-counter-info">
        <div class="cp-counter-name-row">
          <div class="cp-counter-name">${r.champ.name}</div>
          <div class="cp-counter-pct" style="color:${pctColor}">${r.pct}%</div>
        </div>
        <div class="cp-counter-pct-bar-wrap">
          <div class="cp-counter-pct-bar" style="width:${r.pct}%;background:${pctBarColor}"></div>
        </div>
        <div class="cp-counter-tags">
          ${r.isDirect ? `<span class="cp-counter-tag direct">Direct Counter</span>` : ''}
          <span class="cp-counter-tag role">${r.champ.tags[0]||'Fighter'}</span>
          <span class="cp-counter-tag dmg ${getDamageType(r.champ).toLowerCase()}">${getDamageType(r.champ)}</span>
        </div>
        <div class="cp-counter-reason">${r.reason}</div>
      </div>
      <button class="cp-counter-pick-btn">Pick →</button>
    </div>`;
  }).join('');
}

function selectCounterPick(id) {
  const champ = _champMap[id];
  if (!champ) return;
  // Clear previous
  if (state.myChamp && state.myLane && state.ally[state.myLane]?.id===state.myChamp.id) {
    state.ally[state.myLane]=null; updateLaneSlot('ally',state.myLane);
  }
  state.myChamp = champ;
  document.getElementById('cp-picked-section').classList.remove('hidden');
  renderMyChampCard();
  syncAllyLane();
  document.getElementById('cp-results').classList.add('hidden');
  document.getElementById('cp-picked-section').scrollIntoView({ behavior:'smooth', block:'start' });
}

// ── GET BUILD ──
function getBuild() {
  const err = document.getElementById('cp-error-msg');
  err.classList.add('hidden');
  if (!state.myChamp) {
    err.textContent = 'Select a champion first (click a suggestion above or pick manually).';
    err.classList.remove('hidden');
    return;
  }
  const enemies = Object.values(state.enemy).filter(Boolean);
  if (!enemies.length) {
    err.textContent = 'Add at least one enemy champion.';
    err.classList.remove('hidden');
    return;
  }
  const btn = document.getElementById('cp-picked-section').querySelector('.cp-build-btn');
  btn.textContent = 'Building…';
  btn.disabled = true;
  setTimeout(()=>{
    try {
      const allies = Object.values(state.ally).filter(Boolean);
      const result = runAnalysis(state.myChamp, state.myLane, enemies, allies, state.playstyle);
      renderResults(result);
      document.getElementById('cp-results').classList.remove('hidden');
      document.getElementById('cp-results').scrollIntoView({ behavior:'smooth', block:'start' });
    } catch(e) {
      err.textContent = 'Something went wrong.';
      err.classList.remove('hidden');
    } finally {
      btn.textContent = '🛠 Get Build & Insights';
      btn.disabled = false;
    }
  },200);
}

// ── Analysis engine (unchanged from before) ──
function runAnalysis(myChamp, myLane, enemies, allies, playstyle) {
  let sumAtk=0, sumMag=0;
  const threats={tank:0,assassin:0,healer:0,diver:0,marksman:0};
  for (const e of enemies) {
    sumAtk+=e.info?.attack||0; sumMag+=e.info?.magic||0;
    const r=getRole(e);
    if(r==='tank')     threats.tank++;
    if(r==='assassin') threats.assassin++;
    if(r==='support')  threats.healer++;
    if(r==='marksman') threats.marksman++;
    if(r==='fighter'&&(e.info?.damage||0)>5) threats.diver++;
  }
  const total=  (sumAtk+sumMag)||1;
  const adRatio = sumAtk/total, apRatio=sumMag/total;
  const laneOpponent = state.enemy[myLane]||null;
  const biggestThreat = enemies.reduce((b,e)=>
    ((e.info?.damage||0)+(e.info?.difficulty||0))>((b.info?.damage||0)+(b.info?.difficulty||0))?e:b
  );
  const myRole=getRole(myChamp), myDmgType=getDamageType(myChamp);
  const build    = buildRecommendation(myChamp,myRole,myDmgType,myLane,laneOpponent,enemies,adRatio,apRatio,playstyle,threats);
  const insights = generateInsights(myChamp,myRole,myDmgType,myLane,laneOpponent,enemies,adRatio,apRatio,playstyle,threats,biggestThreat);
  return {adRatio,apRatio,threats,enemies,laneOpponent,biggestThreat,build,insights,myRole,myDmgType,myLane};
}

function buildRecommendation(myChamp,myRole,myDmgType,myLane,laneOpponent,enemies,adRatio,apRatio,playstyle,threats){
  const heavyAD=adRatio>0.6,heavyAP=apRatio>0.6;
  const needAntiHeal=threats.healer>0,needTankBust=threats.tank>=2,heavyAssassin=threats.assassin>=2;
  const oppDmg=laneOpponent?getDamageType(laneOpponent):null;
  let core=[],adapt=[],boots='',ahead=null,behind=null;
  if(myRole==='assassin'&&myDmgType!=='AP'){
    core=resolveItems(ITEM_NAMES.lethality.slice(0,3));
    adapt=resolveItems([needTankBust?"Serylda's Grudge":"Duskblade of Draktharr",needAntiHeal?"Chempunk Chainsword":"Axiom Arc",(heavyAP||oppDmg==='AP')?"Maw of Malmortius":"Edge of Night"]);
    boots=(heavyAP||oppDmg==='AP')?ITEM_NAMES.boots.mr:ITEM_NAMES.boots.cdr;
    ahead=getItem("Axiom Arc"); behind=getItem("Edge of Night");
  } else if(myRole==='mage'||myDmgType==='AP'){
    core=resolveItems([ITEM_NAMES.ap_damage[0],ITEM_NAMES.ap_damage[1],"Rabadon's Deathcap"]);
    adapt=resolveItems([needTankBust?"Void Staff":ITEM_NAMES.ap_damage[2],(heavyAD||oppDmg==='AD')?"Zhonya's Hourglass":"Lich Bane",needAntiHeal?"Morellonomicon":"Cryptbloom"]);
    boots=(heavyAD||oppDmg==='AD')?ITEM_NAMES.boots.mr:ITEM_NAMES.boots.magic;
    ahead=getItem("Mejai's Soulstealer"); behind=getItem("Zhonya's Hourglass");
  } else if(myRole==='marksman'){
    core=resolveItems([ITEM_NAMES.ad_crit[0],ITEM_NAMES.ad_crit[1],ITEM_NAMES.ad_crit[2]]);
    adapt=resolveItems([needTankBust?"Kraken Slayer":ITEM_NAMES.ad_crit[3],needAntiHeal?"Mortal Reminder":ITEM_NAMES.ad_crit[4],heavyAssassin?"Immortal Shieldbow":ITEM_NAMES.ad_crit[5]]);
    boots=ITEM_NAMES.boots.attack;
    ahead=getItem("Infinity Edge"); behind=getItem("Immortal Shieldbow");
  } else if(myRole==='fighter'){
    if(myLane==='jungle'){
      core=resolveItems(["Blade of the Ruined King","Trinity Force","Sterak's Gage"]);
      adapt=resolveItems([needTankBust?"Black Cleaver":ITEM_NAMES.ad_bruiser[3],heavyAP?"Maw of Malmortius":"Dead Man's Plate",needAntiHeal?"Chempunk Chainsword":"Ravenous Hydra"]);
    } else {
      core=resolveItems([ITEM_NAMES.ad_bruiser[0],ITEM_NAMES.ad_bruiser[1],ITEM_NAMES.ad_bruiser[2]]);
      adapt=resolveItems([needTankBust?"Black Cleaver":ITEM_NAMES.ad_bruiser[3],(heavyAP||oppDmg==='AP')?"Maw of Malmortius":(heavyAD?"Dead Man's Plate":ITEM_NAMES.ad_bruiser[4]),needAntiHeal?"Chempunk Chainsword":"Sterak's Gage"]);
    }
    boots=(heavyAP||oppDmg==='AP')?ITEM_NAMES.boots.mr:ITEM_NAMES.boots.armor;
    ahead=getItem("Black Cleaver"); behind=getItem("Sterak's Gage");
  } else if(myRole==='tank'){
    core=resolveItems(["Sunfire Aegis","Heartsteel",heavyAP?"Force of Nature":"Warmog's Armor"]);
    adapt=resolveItems([heavyAD?"Frozen Heart":"Spirit Visage",needAntiHeal?"Thornmail":"Randuin's Omen",heavyAP?"Kaenic Rookern":"Dead Man's Plate"]);
    boots=heavyAP?ITEM_NAMES.boots.mr:ITEM_NAMES.boots.armor;
    ahead=getItem("Heartsteel"); behind=getItem("Warmog's Armor");
  } else if(myRole==='support'){
    const tags=myChamp.tags||[];
    if(tags.includes('Tank')||tags.includes('Fighter')){
      core=resolveItems(["Locket of the Iron Solari","Zeke's Convergence","Shurelya's Battlesong"]);
      adapt=resolveItems([heavyAD?"Frozen Heart":"Gargoyle Stoneplate",heavyAP?"Force of Nature":"Warmog's Armor",needAntiHeal?"Thornmail":"Knight's Vow"]);
    } else {
      core=resolveItems(["Moonstone Renewer","Staff of Flowing Water","Ardent Censer"]);
      adapt=resolveItems([heavyAD?"Locket of the Iron Solari":"Redemption",heavyAP?"Force of Nature":"Mikael's Blessing",needAntiHeal?"Thornmail":"Chemtech Putrifier"]);
    }
    boots=heavyAP?ITEM_NAMES.boots.mr:ITEM_NAMES.boots.cdr;
    ahead=getItem("Ardent Censer"); behind=getItem("Locket of the Iron Solari");
  }
  if(playstyle==='antiheal'){const ah=myDmgType==='AP'?getItem("Morellonomicon"):myRole==='marksman'?getItem("Mortal Reminder"):getItem("Chempunk Chainsword");if(ah&&adapt.length)adapt[adapt.length-1]=ah;}
  if(playstyle==='antitank'){const at=myDmgType==='AP'?getItem("Void Staff"):getItem("Black Cleaver");if(at&&adapt.length)adapt[0]=at;}
  if(playstyle==='safe'){const def=(heavyAP||oppDmg==='AP')?getItem("Banshee's Veil"):(heavyAD||oppDmg==='AD')?getItem("Randuin's Omen"):getItem("Immortal Shieldbow");if(def&&adapt.length)adapt[adapt.length-1]=def;}
  if(playstyle==='aggressive'){const d=myDmgType==='AP'?getItem("Shadowflame"):getItem("Eclipse");if(d&&adapt.length)adapt[0]=d;}
  return{items:[...core,...adapt].filter(Boolean).slice(0,6),boots:getItem(boots),ahead,behind};
}

function generateInsights(myChamp,myRole,myDmgType,myLane,laneOpponent,enemies,adRatio,apRatio,playstyle,threats,biggestThreat){
  const out=[];
  if(laneOpponent&&myLane){
    const oppRole=getRole(laneOpponent),oppDmg=getDamageType(laneOpponent),m=LANE_META[myLane];
    let t=`You're countering ${laneOpponent.name} in ${m.label}.`;
    if(oppRole==='assassin')  t+=' Play safe early — bait their key ability before committing.';
    else if(oppRole==='tank') t+=' Punish their weak early game before they scale.';
    else if(oppRole==='mage') t+=' Dodge their combo. Trade short on their cooldowns.';
    else if(oppRole==='marksman') t+=' Aggressive early — zone them off CS, they\'re weak pre-items.';
    else if(oppRole==='fighter') t+=' Use terrain and ability timing to outmaneuver their trades.';
    if(oppDmg==='AP'&&myDmgType==='AD') t+=' Consider early magic resist.';
    out.push({icon:'🆚',label:`Lane Matchup vs ${laneOpponent.name}`,text:t});
  }
  const laneAdvice={
    top:{fighter:'Split push when ahead. TP to skirmishes.',tank:'Frontline and engage. Stack HP and peel.',default:'Control Herald and set up TP flanks.'},
    jungle:{default:'Efficient clear + gank lanes with CC. Secure objectives.',assassin:'Look for picks on overextended laners and invade when safe.',tank:'Engage-focused. Secure Rift Herald and stack Dragons.'},
    mid:{mage:'Poke and shove the wave. Roam bot for Dragon.',assassin:'Look for isolated kills. Roam when your wave is pushed.',default:'Rotate to objectives. Your central position dictates the pace.'},
    bot:{marksman:'CS is king. Survive to your 3-item spike before fighting.',default:'Farm to your power spike. Avoid early trades if behind.'},
    support:{tank:'Engage when cooldowns reset. Deep ward their jungle.',support:'Control vision. Peel carries and trade through them.',default:'Maintain vision priority and enable your ADC.'},
  };
  const la=laneAdvice[myLane];
  const roleAdv=la?.[myRole]||la?.default||'';
  if(roleAdv) out.push({icon:'🗺',label:`${LANE_META[myLane].label} Strategy`,text:roleAdv});
  if(biggestThreat){
    const tRole=getRole(biggestThreat);
    const hints={assassin:'Play safe with wards down. They spike at level 6.',mage:'Dodge their combo before trading.',marksman:'Close the gap and zone them early.',tank:"Don't focus them. Build armor pen and hit their backline.",fighter:'Avoid 1v1s without your team. Kite with terrain.',support:'Negate their vision and punish overextension.'};
    out.push({icon:'⚠️',label:`Biggest Threat: ${biggestThreat.name}`,text:hints[tRole]||'High-priority target. Build accordingly.'});
  }
  const adPct=Math.round(adRatio*100),apPct=100-adPct;
  let ft='';
  if(adRatio>0.75)      ft=`Heavy AD (${adPct}%) — armor is critical.`;
  else if(apRatio>0.75) ft=`Heavy AP (${apPct}%) — rush magic resist.`;
  else                  ft=`Mixed damage (${adPct}% AD / ${apPct}% AP) — build adaptive.`;
  if(threats.assassin>=2) ft+=' Group up — assassins prey on isolation.';
  if(threats.healer>0)    ft+=' Apply Grievous Wounds immediately.';
  if(threats.tank>=3)     ft+=' Ignore their tanks, collapse on carries.';
  out.push({icon:'⚔️',label:'Fight Strategy',text:ft});
  return out;
}

// ── Render build results ──
function renderResults(result){
  const{adRatio,apRatio,threats,enemies,build,insights,myLane}=result;
  const adPct=Math.round(adRatio*100),apPct=100-adPct;
  document.getElementById('res-damage-bar').innerHTML=`
    <div class="cp-dmg-bar-wrap">
      <div class="cp-dmg-label-row"><span class="cp-dmg-ad">⚔️ Physical ${adPct}%</span><span class="cp-dmg-ap">✨ Magic ${apPct}%</span></div>
      <div class="cp-dmg-bar"><div class="cp-dmg-bar-fill-ad" style="width:${adPct}%"></div><div class="cp-dmg-bar-fill-ap" style="width:${apPct}%"></div></div>
    </div>`;
  const badges=[];
  if(threats.tank>0)     badges.push(`<span class="cp-threat-badge tank">🛡 ${threats.tank} Tank${threats.tank>1?'s':''}</span>`);
  if(threats.assassin>0) badges.push(`<span class="cp-threat-badge assassin">🗡 ${threats.assassin} Assassin${threats.assassin>1?'s':''}</span>`);
  if(threats.healer>0)   badges.push(`<span class="cp-threat-badge healer">💊 Healing</span>`);
  if(threats.diver>0)    badges.push(`<span class="cp-threat-badge diver">🏃 Dive Threat</span>`);
  document.getElementById('res-threats').innerHTML=`<div class="cp-threats-row">${badges.length?badges.join(''):'<span class="cp-threat-badge neutral">Standard Comp</span>'}</div>`;
  document.getElementById('res-champ-icons').innerHTML=`<div class="cp-result-lanes">${LANES.map(lane=>{
    const champ=state.enemy[lane],m=LANE_META[lane],isOpp=myLane===lane;
    return`<div class="cp-result-lane ${isOpp?'is-opponent':''}">
      <div class="cp-result-lane-label">${m.emoji} ${m.short}</div>
      ${champ?`<img src="${champImgUrl(champ)}" alt="${champ.name}" title="${champ.name}"/><div class="cp-result-lane-name">${champ.name}</div>${isOpp?'<div class="cp-result-lane-opp-tag">YOUR LANE</div>':''}`:`<div class="cp-result-lane-empty">—</div>`}
    </div>`;
  }).join('')}</div>`;
  const noteMap={carry:'Full damage — eliminate their backline.',safe:'Defensive first — survive and scale.',aggressive:'Snowball early before they can react.',scaling:'Farm safely, spike at 3 items.',antitank:'Armor penetration priority.',antiheal:'Apply Grievous Wounds every fight.'};
  document.getElementById('res-build-note').textContent=noteMap[state.playstyle]||'';
  document.getElementById('res-items').innerHTML=build.items.map((item,i)=>`
    <div class="cp-item-slot" title="${item.name}">
      <img src="${itemImgUrl(item.id)}" alt="${item.name}"/>
      <span class="cp-item-num">${i+1}</span>
      <div class="cp-item-name-tip">${item.name}</div>
    </div>`).join('');
  document.getElementById('res-boots').innerHTML=build.boots?`
    <div class="cp-boots-label">Boots</div>
    <div class="cp-item-slot" title="${build.boots.name}">
      <img src="${itemImgUrl(build.boots.id)}" alt="${build.boots.name}"/>
      <div class="cp-item-name-tip">${build.boots.name}</div>
    </div>`:'';
  document.getElementById('res-situational-content').innerHTML=`
    <div class="cp-situ-row">
      <div class="cp-situ-label win">If Ahead</div>
      ${build.ahead?`<div class="cp-situ-item"><img src="${itemImgUrl(build.ahead.id)}" alt="${build.ahead.name}"/><span>${build.ahead.name}</span></div><span class="cp-situ-reason">→ Press your lead</span>`:'<span class="cp-situ-reason">Stay on core build and push advantages</span>'}
    </div>
    <div class="cp-situ-row">
      <div class="cp-situ-label lose">If Behind</div>
      ${build.behind?`<div class="cp-situ-item"><img src="${itemImgUrl(build.behind.id)}" alt="${build.behind.name}"/><span>${build.behind.name}</span></div><span class="cp-situ-reason">→ Survive and scale back</span>`:'<span class="cp-situ-reason">Play safe and farm to comeback</span>'}
    </div>`;
  document.getElementById('res-insights-content').innerHTML=insights.map(ins=>`
    <div class="cp-insight-row">
      <div class="cp-insight-icon">${ins.icon}</div>
      <div class="cp-insight-body">
        <div class="cp-insight-label">${ins.label}</div>
        <div class="cp-insight-text">${ins.text}</div>
      </div>
    </div>`).join('');
}

document.addEventListener('DOMContentLoaded', init);
