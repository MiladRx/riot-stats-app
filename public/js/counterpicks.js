 // ── CounterPicks — Smart Draft & Build Assistant ──

let _version   = '';
let _champMap  = {};
let _champList = [];
let _itemByName = {};

// ── Lanes ──
const LANES = ['top','jungle','mid','bot','support'];
const LANE_META = {
  top:     { label: 'Top Lane', short: 'TOP', emoji: '🪓' },
  jungle:  { label: 'Jungle',   short: 'JGL', emoji: '🌿' },
  mid:     { label: 'Mid Lane', short: 'MID', emoji: '⚡' },
  bot:     { label: 'Bot Lane', short: 'BOT', emoji: '🎯' },
  support: { label: 'Support',  short: 'SUP', emoji: '🛡️' } // Updated with proper emoji rendering
};
// ── Lane affinity sets ──
const JUNGLE_IDS = new Set(['Vi','JarvanIV','LeeSin','Hecarim','Nidalee','Rengar','Elise','Khazix','Graves','Kindred','Ivern','Kayn','Warwick','Sejuani','Amumu','Volibear','Evelynn','Shyvana','Nocturne','Diana','Ekko','Nunu','Rammus','Zac','Udyr','Fiddlesticks','Trundle','XinZhao','Skarner','Belveth','Viego','Lillia','Karthus','Taliyah','MonkeyKing','Briar','Maokai','Naafiri','Masteryi','Shaco','RekSai','Pantheon','Poppy']);
const SUPPORT_IDS = new Set(['Thresh','Lulu','Janna','Soraka','Nautilus','Blitzcrank','Leona','Alistar','Braum','Bard','Nami','Sona','Taric','Morgana','Zyra','Karma','Brand','Zilean','Senna','Seraphine','Pyke','Rakan','Yuumi','Renata','Milio','Rell','Galio','Swain','Xerath','Velkoz','Heimerdinger','Neeko','Hwei','Lux','Poppy']);
const MARKSMAN_IDS = new Set(['Jinx','Caitlyn','Ashe','MissFortune','Jhin','Ezreal','Kaisa','Sivir','Tristana','Vayne','Draven','Lucian','Xayah','KogMaw','Twitch','Varus','Aphelios','Samira','Zeri','Nilah','Smolder','Kalista','Corki']);

// ── Counter database ──
// Source: counterstats.net win rates (Platinum+, current patch)
// Score mapping: 57%WR→76, 55-56%→70-73, 53-54%→64-67, 52%→61, 51%→58
const COUNTER_DB = {
  // ═══════════════════ TOP LANE ═══════════════════
  // Real win rates from counterstats.net (Plat+, current patch)
  Darius:      [['Teemo',76],['Vayne',73],['Kayle',70],['Yorick',67],['Volibear',67],['Vladimir',67],['Jayce',66],['Heimerdinger',66]],
  Irelia:      [['Poppy',79],['Jax',73],['Malphite',73],['Warwick',70],['Shen',70],['Singed',67],['Mordekaiser',67],['Trundle',67]],
  Camille:     [['Teemo',76],['Shen',73],['Renekton',70],['Gragas',70],['Sett',67],['DrMundo',67],['Volibear',64],['Mordekaiser',64]],
  Renekton:    [['Teemo',79],['Singed',76],['Nasus',76],['Garen',73],['Gragas',70],['Illaoi',70],['Kayle',67],['Pantheon',67]],
  Aatrox:      [['MonkeyKing',76],['Singed',76],['Kled',73],['Vladimir',70],['Kayle',67],['Vayne',67],['Warwick',64],['Kennen',64]],
  Fiora:       [['Heimerdinger',79],['Warwick',79],['Kayle',70],['Vayne',70],['Malphite',67],['Volibear',67],['TahmKench',67],['Nasus',67]],
  Nasus:       [['Shen',70],['Garen',70],['Ornn',67],['Camille',67],['TahmKench',64],['Sion',61],['Singed',61],['Illaoi',61]],
  Malphite:    [['Singed',73],['Ornn',73],['DrMundo',73],['Shen',70],['Chogath',70],['Mordekaiser',67],['TahmKench',67],['Vladimir',64]],
  Riven:       [['Renekton',64],['Singed',63],['Olaf',61],['Sett',60],['Malphite',59],['Garen',58]],
  Jax:         [['Teemo',70],['Malphite',67],['Warwick',64],['Volibear',62],['Singed',61],['Pantheon',60]],
  Garen:       [['Vayne',66],['Teemo',65],['Quinn',63],['Jayce',62],['Kennen',61],['Gangplank',60]],
  Tryndamere:  [['Malphite',70],['Warwick',67],['Sett',64],['Garen',62],['Poppy',61],['Jax',59]],
  Sion:        [['Fiora',67],['Camille',64],['Vayne',62],['Gnar',60],['Jayce',59]],
  Volibear:    [['Vayne',66],['Quinn',64],['Teemo',62],['Kennen',60],['Gnar',58]],
  Mordekaiser: [['Vayne',70],['Quinn',67],['Kennen',64],['Gangplank',62],['Gnar',59]],
  Singed:      [['Gangplank',67],['Gnar',65],['Teemo',63],['Jayce',61],['Quinn',60]],
  KSante:      [['Vayne',67],['Fiora',64],['Camille',62],['Gnar',60],['Jayce',58]],
  Vladimir:    [['Renekton',67],['Darius',64],['Irelia',62],['Jayce',60],['Gnar',58]],
  Gangplank:   [['Darius',64],['Renekton',62],['Camille',60],['Fiora',58],['Irelia',57]],
  Kayle:       [['Darius',70],['Renekton',67],['Camille',64],['Irelia',61],['Wukong',59]],
  Olaf:        [['Malphite',67],['Renekton',64],['Camille',62],['Fiora',60],['Garen',58]],
  Jayce:       [['Malphite',65],['Irelia',64],['Renekton',62],['Camille',60],['Darius',58]],
  Shen:        [['Camille',64],['Darius',62],['Fiora',60],['Renekton',58],['Garen',57]],
  TahmKench:   [['Vayne',70],['Fiora',67],['Camille',64],['Gnar',62],['Jayce',60]],
  Gnar:        [['Malphite',66],['Garen',63],['Darius',62],['Renekton',60],['Camille',58]],
  Illaoi:      [['Fiora',70],['Garen',66],['Quinn',64],['Vayne',62],['Camille',60]],
  Yorick:      [['Camille',66],['Fiora',64],['Garen',62],['Renekton',60],['Illaoi',58]],
  Wukong:      [['Malphite',67],['Camille',64],['Darius',62],['Garen',60],['Renekton',58]],
  Kennen:      [['Malphite',67],['Garen',64],['Nasus',62],['Renekton',60],['Shen',58]],
  Poppy:       [['Vayne',66],['Fiora',64],['Darius',62],['Camille',60],['Garen',58]],
  Urgot:       [['Garen',66],['Vayne',64],['Nasus',62],['Fiora',60],['Malphite',58]],
  Teemo:       [['Yorick',73],['Garen',68],['Nasus',66],['Darius',62],['Pantheon',60]],
  Cho_Gath:    [['Vayne',66],['Fiora',63],['Camille',61],['Darius',59],['Renekton',57]],
  Chogath:     [['Vayne',66],['Fiora',63],['Camille',61],['Darius',59],['Renekton',57]],
  Gragas:      [['Darius',64],['Renekton',62],['Camille',60],['Malphite',58],['Garen',57]],
  Maokai:      [['Vayne',70],['Fiora',67],['Camille',64],['Darius',61],['Garen',59]],
  Trundle:     [['Camille',64],['Malphite',62],['Fiora',60],['Renekton',58],['Darius',57]],
  Ambessa:     [['Malphite',67],['Renekton',64],['Garen',62],['Wukong',60],['Pantheon',58]],
  Heimerdinger:[['Darius',67],['Renekton',64],['Irelia',62],['Malphite',60],['Camille',58]],
  Zac:         [['Vayne',67],['Fiora',64],['Quinn',62],['Gnar',60],['Jayce',58]],
  Warwick:     [['Vayne',65],['Quinn',63],['Fiora',61],['Teemo',59],['Gnar',57]],
  Pantheon:    [['Malphite',65],['Darius',63],['Garen',61],['Renekton',59],['Wukong',57]],

  // ═══════════════════ JUNGLE ═══════════════════
  LeeSin:      [['Nasus',76],['Naafiri',70],['RekSai',67],['Nocturne',67],['Amumu',64],['Zac',64],['Rammus',64],['Warwick',63]],
  Khazix:      [['Briar',73],['Fiddlesticks',70],['Naafiri',70],['Diana',67],['Nocturne',67],['Amumu',67],['Rammus',64],['Warwick',63]],
  Hecarim:     [['Fiddlesticks',76],['Rammus',76],['Belveth',76],['Vi',70],['Evelynn',70],['Graves',67],['Nunu',67],['DrMundo',67]],
  Viego:       [['Taliyah',80],['Zyra',76],['Nasus',73],['Rammus',70],['Fiddlesticks',67],['Nocturne',67],['MonkeyKing',67],['RekSai',67]],
  Warwick:     [['Nasus',77],['Kindred',73],['Shen',70],['Briar',70],['DrMundo',67],['Jax',67],['Amumu',67],['Lillia',64]],
  Graves:      [['Fiddlesticks',70],['DrMundo',67],['Naafiri',64],['Zyra',64],['Nidalee',61],['Rammus',61]],
  Kayn:        [['Udyr',73],['Fiddlesticks',70],['Kindred',67],['Gwen',64],['Elise',64],['MonkeyKing',63],['Zac',61]],
  Nidalee:     [['Warwick',64],['Vi',62],['Hecarim',60],['Elise',58],['Amumu',57]],
  Elise:       [['Hecarim',63],['Vi',61],['Amumu',59],['Warwick',57],['Khazix',56]],
  Evelynn:     [['Warwick',70],['Hecarim',67],['Vi',64],['Graves',62],['Nidalee',60]],
  Vi:          [['Hecarim',62],['Amumu',60],['Warwick',58],['Graves',57],['Elise',56]],
  Nocturne:    [['Warwick',66],['Vi',63],['Hecarim',61],['Amumu',59],['Elise',57]],
  Karthus:     [['Warwick',73],['Vi',70],['Nocturne',67],['Graves',65],['Hecarim',63]],
  JarvanIV:    [['Hecarim',62],['Graves',60],['Nidalee',58],['Elise',57],['Vi',56]],
  Belveth:     [['Warwick',67],['Vi',64],['Hecarim',62],['Graves',60],['Amumu',58]],
  Briar:       [['Warwick',66],['Vi',63],['Hecarim',61],['Amumu',59],['Elise',57]],
  Taliyah:     [['Hecarim',64],['Vi',62],['Graves',60],['Warwick',58],['Amumu',57]],
  Sejuani:     [['Hecarim',62],['Graves',60],['Vi',58],['Warwick',57],['Amumu',56]],
  Udyr:        [['Hecarim',63],['Vi',61],['Warwick',59],['Graves',58],['Amumu',57]],
  MonkeyKing:  [['Hecarim',62],['Vi',60],['Warwick',58],['Graves',57],['Amumu',56]],
  Fiddlesticks:[['Warwick',70],['Vi',67],['Hecarim',65],['Nocturne',63],['Amumu',61]],
  RekSai:      [['Warwick',65],['Vi',63],['Hecarim',61],['Graves',59],['Amumu',57]],
  Rammus:      [['Graves',66],['Nidalee',64],['Hecarim',62],['Vi',60],['Warwick',58]],
  Nunu:        [['Hecarim',64],['Vi',62],['Graves',60],['Warwick',58],['Amumu',57]],
  Masteryi:    [['Warwick',68],['Vi',65],['Hecarim',63],['Amumu',61],['Nocturne',59]],
  Shaco:       [['Warwick',67],['Vi',64],['Hecarim',62],['Amumu',60],['Nocturne',58]],
  Ivern:       [['Hecarim',64],['Vi',62],['Warwick',59],['Graves',57],['Elise',56]],
  Kindred:     [['Warwick',66],['Vi',63],['Hecarim',61],['Graves',59],['Amumu',57]],
  XinZhao:     [['Hecarim',63],['Vi',61],['Warwick',59],['Graves',58],['Amumu',57]],
  Skarner:     [['Hecarim',62],['Vi',60],['Warwick',58],['Graves',57],['Amumu',56]],
  Diana:       [['Warwick',65],['Vi',63],['Hecarim',61],['Graves',59],['Amumu',58]],
  Trundle:     [['Warwick',62],['Hecarim',60],['Vi',58],['Graves',57],['Amumu',56]],
  Zac:         [['Graves',63],['Hecarim',61],['Vi',59],['Nidalee',58],['Warwick',57]],
  Ekko:        [['Warwick',66],['Vi',64],['Hecarim',62],['Graves',60],['Amumu',58]],
  Lillia:      [['Warwick',64],['Vi',62],['Hecarim',60],['Graves',58],['Amumu',57]],
  Volibear:    [['Vi',63],['Hecarim',61],['Graves',59],['Warwick',58],['Amumu',57]],
  Poppy:       [['Hecarim',62],['Vi',60],['Warwick',58],['Graves',57],['Amumu',56]],
  Shyvana:     [['Vi',64],['Hecarim',62],['Warwick',60],['Graves',59],['Amumu',57]],
  Rengar:      [['Warwick',66],['Vi',64],['Hecarim',61],['Amumu',59],['Nocturne',58]],
  Amumu:       [['Hecarim',64],['Graves',61],['Nidalee',59],['Vi',58],['Elise',56]],

  // ═══════════════════ MID LANE ═══════════════════
  Zed:         [['Malzahar',67],['Xerath',67],['Sylas',64],['Diana',64],['Katarina',64],['Viktor',63],['Vex',61],['Fizz',61],['Lissandra',61]],
  Yasuo:       [['Malzahar',73],['AurelionSol',70],['Annie',70],['Lissandra',70],['Velkoz',70],['Vex',67],['Vladimir',64],['Veigar',61]],
  Yone:        [['Annie',77],['Vladimir',73],['Vex',70],['Lissandra',70],['Syndra',67],['Lux',67],['Katarina',67],['Ahri',67]],
  Katarina:    [['Cassiopeia',67],['Akali',64],['Lissandra',64],['Diana',64],['Galio',61],['Vladimir',61],['Annie',61],['Vex',61]],
  Akali:       [['Lissandra',73],['Vex',73],['Anivia',70],['TwistedFate',70],['Annie',70],['Malzahar',67],['Lux',67],['Veigar',67]],
  LeBlanc:     [['Naafiri',77],['Cassiopeia',73],['Malzahar',73],['Velkoz',70],['Vex',70],['Vladimir',67],['Kassadin',67],['Diana',67]],
  Syndra:      [['Irelia',73],['Katarina',73],['Fizz',70],['AurelionSol',70],['Naafiri',70],['Ekko',67],['LeBlanc',67],['Xerath',67]],
  Orianna:     [['Velkoz',76],['Anivia',73],['Xerath',73],['Kassadin',70],['Diana',70],['AurelionSol',70],['Lux',67],['Fizz',67]],
  Ahri:        [['Talon',64],['Velkoz',61],['Diana',61],['Fizz',58],['Viktor',58],['Veigar',58]],
  Fizz:        [['Malzahar',70],['Lissandra',67],['Galio',65],['Anivia',63],['Zed',61]],
  Viktor:      [['Zed',62],['Fizz',60],['Katarina',59],['Talon',58],['Akali',57]],
  Lux:         [['Zed',66],['Fizz',64],['Katarina',62],['Talon',60],['Akali',58]],
  TwistedFate: [['Talon',76],['Zed',68],['Fizz',65],['Katarina',63],['Akali',61]],
  Veigar:      [['Zed',68],['Fizz',66],['Katarina',64],['Talon',62],['Akali',60]],
  Sylas:       [['Lissandra',70],['Malzahar',68],['Galio',66],['Anivia',63],['Diana',61]],
  Malzahar:    [['Fizz',68],['Kassadin',66],['Zed',63],['Katarina',61],['Akali',59]],
  Talon:       [['Lissandra',72],['Malzahar',70],['Galio',68],['Anivia',65],['Diana',62]],
  Galio:       [['Zed',63],['Fizz',61],['Katarina',60],['Talon',58],['Akali',57]],
  Lissandra:   [['Zed',64],['Fizz',62],['Katarina',61],['Talon',59],['Akali',58]],
  Kassadin:    [['Talon',71],['Zed',64],['Fizz',62],['Katarina',60],['Akali',58]],
  AurelionSol: [['Zed',69],['Talon',67],['Fizz',66],['Katarina',64],['Galio',62],['LeBlanc',61]],
  Corki:       [['Zed',63],['Talon',61],['Katarina',60],['Fizz',58],['Akali',57]],
  Tristana:    [['Zed',64],['Talon',62],['Katarina',61],['Fizz',59],['Akali',57]],
  Vex:         [['Zed',61],['Talon',59],['Katarina',58],['Fizz',57],['Akali',56]],
  Annie:       [['Zed',66],['Talon',64],['Katarina',62],['Fizz',60],['Akali',58]],
  Anivia:      [['Zed',63],['Talon',61],['Katarina',60],['Fizz',58],['Akali',57]],
  Ziggs:       [['Zed',65],['Talon',63],['Katarina',62],['Fizz',60],['Akali',58]],
  Xerath:      [['Zed',68],['Talon',66],['Katarina',64],['Fizz',61],['Akali',59]],
  Neeko:       [['Zed',63],['Talon',61],['Katarina',60],['Fizz',58],['Akali',57]],
  Naafiri:     [['Lissandra',70],['Malzahar',68],['Galio',66],['Anivia',63],['Diana',61]],
  Qiyana:      [['Lissandra',70],['Malzahar',68],['Galio',66],['Anivia',63],['Diana',61]],
  Irelia:      [['Malphite',69],['Lissandra',66],['Galio',64],['Anivia',62],['Malzahar',60]],
  Pantheon:    [['Lissandra',64],['Malzahar',62],['Galio',61],['Anivia',59],['Zed',58]],
  Swain:       [['Zed',64],['Talon',62],['Katarina',61],['Fizz',59],['Akali',57]],
  Rumble:      [['Zed',63],['Talon',61],['Katarina',60],['Fizz',58],['Akali',57]],
  Hwei:        [['Zed',65],['Talon',63],['Katarina',61],['Fizz',59],['Akali',57]],
  Aurora:      [['Malzahar',68],['Lissandra',65],['Galio',63],['Zed',61],['Talon',59]],
  Smolder:     [['Zed',67],['Talon',65],['Katarina',63],['Fizz',61],['Akali',59]],
  Azir:        [['Zed',69],['Talon',67],['LeBlanc',65],['Fizz',63],['Katarina',61]],
  Ekko:        [['Lissandra',66],['Malzahar',64],['Galio',62],['Zed',59],['Anivia',57]],
  Diana:       [['Zed',61],['Talon',59],['Katarina',58],['Fizz',57],['Akali',56]],
  Vladimir:    [['Renekton',68],['Darius',66],['Jayce',63],['Irelia',61],['Fizz',59]],
  Velkoz:      [['Zed',66],['Talon',64],['Katarina',62],['Fizz',60],['Akali',58]],
  Vel_Koz:     [['Zed',66],['Talon',64],['Katarina',62],['Fizz',60],['Akali',58]],
  VelKoz:      [['Zed',66],['Talon',64],['Katarina',62],['Fizz',60],['Akali',58]],
  Cassiopeia:  [['Zed',64],['Fizz',62],['Katarina',61],['Talon',59],['Akali',57]],

  // ═══════════════════ BOT LANE (ADC) ═══════════════════
  Ezreal:      [['Nilah',76],['Samira',73],['KogMaw',67],['Vayne',67],['Sivir',67],['Veigar',67],['Smolder',67],['Ashe',64]],
  Jinx:        [['Ziggs',64],['Nilah',61],['Veigar',58],['Zeri',58],['Senna',57]],
  Caitlyn:     [['Veigar',70],['Ziggs',67],['Nilah',67],['KogMaw',61],['Ashe',61],['Smolder',61],['Samira',61]],
  Ashe:        [['Nilah',64],['MissFortune',58],['Twitch',58],['Senna',58],['Ziggs',58]],
  MissFortune: [['Veigar',73],['Nilah',67],['Ziggs',64],['Senna',64],['KogMaw',61],['Xayah',58]],
  Jhin:        [['Veigar',73],['Samira',61],['Sivir',61],['Ashe',61],['Vayne',58]],
  Kaisa:       [['Veigar',70],['KogMaw',70],['Samira',67],['Xayah',67],['Smolder',64],['Senna',64],['Aphelios',61]],
  Sivir:       [['Draven',64],['Caitlyn',62],['Lucian',60],['Kaisa',59],['Vayne',57]],
  Vayne:       [['Senna',70],['Nilah',64],['Jinx',61],['MissFortune',61],['Smolder',61],['Xayah',61]],
  Draven:      [['Veigar',70],['Ziggs',64],['KogMaw',64],['Nilah',64],['Smolder',61],['Ashe',61]],
  Xayah:       [['Draven',67],['Caitlyn',64],['Lucian',62],['Kaisa',60],['Vayne',58]],
  Samira:      [['Caitlyn',67],['Draven',63],['Lucian',61],['Kaisa',59],['Vayne',57]],
  Zeri:        [['Draven',66],['Caitlyn',64],['Lucian',62],['Kaisa',60],['Vayne',58]],
  Aphelios:    [['Draven',67],['Caitlyn',65],['Lucian',63],['Kaisa',61],['Vayne',59]],
  Nilah:       [['Caitlyn',67],['Draven',65],['Lucian',63],['Kaisa',61],['Vayne',59]],
  KogMaw:      [['Draven',69],['Caitlyn',67],['Lucian',65],['Kaisa',62],['Vayne',60]],
  Kogmaw:      [['Draven',69],['Caitlyn',67],['Lucian',65],['Kaisa',62],['Vayne',60]],
  Twitch:      [['Caitlyn',70],['Draven',68],['Lucian',66],['Kaisa',63],['Vayne',61]],
  Varus:       [['Draven',66],['Caitlyn',64],['Lucian',62],['Kaisa',60],['Vayne',58]],
  Tristana:    [['Caitlyn',66],['Draven',64],['Lucian',62],['Kaisa',60],['Vayne',58]],
  Smolder:     [['Draven',67],['Caitlyn',65],['Lucian',63],['Kaisa',61],['Vayne',59]],
  Kalista:     [['Caitlyn',68],['Draven',66],['Lucian',64],['Kaisa',61],['Vayne',59]],
  Corki:       [['Draven',66],['Caitlyn',64],['Lucian',62],['Kaisa',60],['Vayne',58]],
  Seraphine:   [['Draven',63],['Caitlyn',61],['Lucian',59],['Kaisa',58],['Vayne',57]],

  // ═══════════════════ SUPPORT ═══════════════════
  Thresh:      [['Zyra',64],['Seraphine',64],['Brand',61],['Braum',61],['Taric',61],['Morgana',58],['Zilean',58],['Nami',58]],
  Nautilus:    [['Taric',77],['Janna',67],['Leona',67],['Rell',67],['Braum',67],['Morgana',61],['Maokai',61],['Thresh',61]],
  Leona:       [['Zilean',70],['Soraka',67],['Sona',64],['Seraphine',64],['Swain',64],['Morgana',64],['Janna',61]],
  Blitzcrank:  [['Taric',73],['Elise',70],['Shaco',67],['Leona',67],['Maokai',67],['Zilean',64],['Braum',64],['Rell',64]],
  Lulu:        [['Janna',67],['Maokai',64],['Braum',64],['Zilean',64],['Velkoz',61],['Zyra',61],['Seraphine',61]],
  Janna:       [['Sona',67],['Bard',61],['Maokai',61],['Seraphine',61],['Nami',58],['Thresh',58]],
  Soraka:      [['Elise',61],['Nami',61],['Sona',58],['Bard',58]],
  Brand:       [['Sona',70],['Velkoz',67],['Maokai',67],['Taric',67],['Janna',64],['Zilean',64],['Milio',64],['Karma',61]],
  Morgana:     [['Blitzcrank',66],['Leona',63],['Nautilus',61],['Pyke',59],['Brand',58]],
  Zyra:        [['Thresh',62],['Lulu',60],['Janna',59],['Soraka',58],['Nautilus',57]],
  Alistar:     [['Thresh',62],['Lulu',60],['Janna',59],['Soraka',58],['Brand',57]],
  Braum:       [['Thresh',62],['Lulu',60],['Janna',59],['Soraka',58],['Brand',57]],
  Karma:       [['Blitzcrank',64],['Leona',62],['Nautilus',61],['Pyke',59],['Brand',57]],
  Nami:        [['Blitzcrank',65],['Leona',63],['Nautilus',62],['Pyke',60],['Brand',58]],
  Bard:        [['Blitzcrank',63],['Leona',61],['Nautilus',60],['Brand',58],['Pyke',57]],
  Sona:        [['Blitzcrank',70],['Leona',68],['Nautilus',66],['Brand',63],['Pyke',61]],
  Yuumi:       [['Blitzcrank',72],['Leona',70],['Nautilus',68],['Brand',65],['Pyke',63]],
  Seraphine:   [['Blitzcrank',66],['Leona',64],['Nautilus',62],['Brand',60],['Pyke',58]],
  Milio:       [['Blitzcrank',66],['Leona',64],['Nautilus',62],['Brand',60],['Pyke',58]],
  Rakan:       [['Thresh',64],['Lulu',62],['Janna',61],['Soraka',59],['Brand',58]],
  Senna:       [['Blitzcrank',66],['Leona',64],['Nautilus',62],['Pyke',60],['Brand',58]],
  Rell:        [['Thresh',63],['Lulu',61],['Janna',60],['Soraka',58],['Brand',57]],
  Taric:       [['Blitzcrank',64],['Leona',62],['Brand',61],['Pyke',59],['Nautilus',57]],
  Renata:      [['Blitzcrank',66],['Leona',64],['Nautilus',62],['Brand',60],['Pyke',58]],
  Zilean:      [['Blitzcrank',66],['Leona',64],['Nautilus',62],['Brand',60],['Pyke',58]],
  Hwei:        [['Blitzcrank',65],['Leona',63],['Nautilus',61],['Brand',59],['Pyke',57]],
  Poppy:       [['Thresh',63],['Lulu',61],['Janna',60],['Soraka',58],['Brand',57]],
  Galio:       [['Thresh',62],['Lulu',60],['Janna',59],['Soraka',58],['Brand',57]],
  Swain:       [['Thresh',63],['Lulu',61],['Janna',60],['Soraka',58],['Brand',57]],
  Xerath:      [['Blitzcrank',65],['Leona',63],['Nautilus',62],['Pyke',60],['Brand',58]],
  Neeko:       [['Blitzcrank',64],['Leona',62],['Nautilus',61],['Pyke',59],['Brand',58]],
  Lux:         [['Blitzcrank',65],['Leona',63],['Nautilus',62],['Pyke',60],['Brand',58]],
  Heimerdinger:[['Blitzcrank',68],['Leona',66],['Nautilus',64],['Pyke',62],['Brand',60]],
  Pyke:        [['Lulu',68],['Thresh',64],['Janna',62],['Soraka',60],['Brand',59]],
  Velkoz:      [['Blitzcrank',65],['Leona',63],['Nautilus',62],['Pyke',60],['Brand',58]],
};

// Specific reasons (counter → enemy)
// Based on actual matchup mechanics
const COUNTER_REASONS = {
  // Top lane
  Teemo:       { Darius:'Poison kite keeps his bleed from stacking. You never let him engage.', Renekton:'Range advantage denies his early aggression entirely.', Camille:'Mushrooms slow her dash approach. Poke her off every CS.', default:'Ranged poke forces them off CS and denies melee engage patterns.' },
  Warwick:     { Fiora:'W healing overpowers her vitals pattern in extended trades.', Irelia:'Suppress her mid-dash combo with R.', default:'Built-in healing, powerful 1v1, and point-and-click suppression.' },
  Heimerdinger:{ Fiora:'Turrets punish every dash approach. She can never safely engage.', Darius:'Ranged turrets deny his ability to ever step up.', Renekton:'Turrets zone him off CS. You outrange every cooldown.', default:'Turrets punish every melee engage attempt and deny CS freely.' },
  Vayne:       { Darius:'True damage bypasses armor stacks entirely.', Malphite:'Silver Bolts shred HP regardless of armor rating.', KSante:'True damage ignores his passive stacking mechanic.', TahmKench:'Silver Bolts melt through his HP pool. Kite endlessly.', Fiora:'Condemn her vitals pattern and true damage her down.', Aatrox:'True damage ignores his healing — burst him down fast.', default:'True damage ignores all tankiness. Kite and scale.' },
  Poppy:       { Irelia:'W stops her mid-dash, removing her entire damage pattern.', default:'Passive shield and W interrupt gap-closers completely.' },
  Malphite:    { Irelia:'R cancels her entire dash chain mid-combo.', Yasuo:'R flattens his wind wall combo in teamfights.', Riven:'R interrupts her full combo and burst window.', default:'Rock-solid tank with point-and-click CC. Shuts down melee threats.' },
  Singed:      { Renekton:'He can never catch you. Proxy farm and let him rage.', Camille:'Your flip punishes her dash aggressively. She can\'t all-in.', Aatrox:'Proxy farm denies his CS while you ignore his engage entirely.', default:'Proxy farm starves them out. Your run-it-down playstyle nullifies melee threats.' },
  Kayle:       { Irelia:'Ult negates her entire dive combo at level 16.', Darius:'Ranged scaling — abuse early levels before she reaches power spike.', default:'Ranged at level 6, unkillable at level 16. Farm safely and spike.' },
  Fiora:       { Malphite:'Parry blocks his R engage completely.', Darius:'Parry on Hemorrhage removes the entire bleed stack.', Sion:'Parry his Q — removes his only reliable damage tool.', default:'Parry telegraphed CC. Vitals shred any tank or bruiser.' },
  // Jungle
  Fiddlesticks:{ Hecarim:'Fear + drain stops his engage before it lands.', Khazix:'Your zone control denies his isolation attempts.', default:'Mass fear teamfight ult from fog of war. Counter-gank freely.' },
  Rammus:      { Hecarim:'W reflect punishes his high attack speed pattern.', Graves:'Thornmail reflect punishes his burst attempts.', default:'High mobility, point-and-click taunt. Destroys AD-heavy junglers.' },
  Belveth:     { Hecarim:'Out-duel him at any stage with voidling sustain.', default:'Persistent damage and true damage shred any jungler.' },
  Taliyah:     { Viego:'Worked Ground completely denies his camp patterns.', default:'Zone control denies jungle pathing and camp access entirely.' },
  Nasus:       { Warwick:'Infinite stacks make you unkillable at 200+ Q stacks.', LeeSin:'He can never duel you past 150 stacks.', default:'Stacks make you unkillable late game. Farm safely early.' },
  // Mid lane
  Malzahar:    { Yasuo:'R suppression bypasses wind wall completely.', Katarina:'R suppression cancels her spin mid-combo.', Zed:'R prevents death mark from activating.', TwistedFate:'Shove and deny roams. Silence zone stops his gold card setup.', AurelionSol:'Silence zone denies his roam setup. R locks him down.', Yone:'Suppression cancels his E-dash combo entirely.', default:'R suppression stops any diver or assassin mid-combo.' },
  Lissandra:   { Zed:'R on yourself negates his death mark burst.', Katarina:'R stops her spin cold. CC chain denies resets.', Talon:'W root then R — he cannot escape the combo.', Naafiri:'CC chain denies her entire engage window.', default:'Multiple CC abilities shut down anyone who dives.' },
  Galio:       { Zed:'W taunt through his shadow stops the combo.', TwistedFate:'R covers the map faster than TF can roam.', Katarina:'Taunt stops her spin. Magic shield absorbs AP burst.', default:'Magic damage shield and hard CC punish AP champions.' },
  Talon:       { TwistedFate:'Your roam speed matches his. Kill his targets first.', AurelionSol:'Assassinate him before he gets range. His mobility hurts.', default:'Roam speed and burst follow his roam windows perfectly.' },
  Naafiri:     { LeBlanc:'Your burst is faster than hers. No disengage for her.', default:'Pack damage and burst kills before the target can react.' },
  Cassiopeia:  { LeBlanc:'Petrifying gaze stops her chain combo instantly.', default:'Petrify punishes dashes. Poison stacks shred any target.' },
  Velkoz:      { Orianna:'Zone control from range denies her ball placement.', default:'Max range poke shreds anyone without mobility or shields.' },
  Fizz:        { Zed:'E dodges his entire combo and death mark timer.', Syndra:'E vaults over her stun combo burst window.', LeBlanc:'E timing dodges her chain-combo root precisely.', default:'E dodge removes the most dangerous ability in any matchup.' },
  Kassadin:    { AurelionSol:'Outscale at 3 items. R spam makes you permanently uncatchable.', default:'R spam makes you unkillable and uncatchable at full build.' },
  Annie:       { Yasuo:'Stun combo eliminates him before wind wall activates.', Yone:'Tibbers hard CC counters his entire E-dash pattern.', default:'Instant stun combo with Tibbers wins any all-in decisively.' },
  // Bot lane
  Veigar:      { Ezreal:'Cage walls deny his E escape. Burst him through his spells.', Caitlyn:'Cage traps her under turret. Event Horizon stops dashes.', Draven:'Cage counters his axes pattern. Burst before he catches.', default:'Event Horizon cage traps immobile ADCs. AP burst one-shots.' },
  Nilah:       { Ezreal:'Dodge his E with W and burst through his shields.', Vayne:'Outbrawl her in extended trades with W passive.', default:'Melee burst and dash through skillshots. Wins extended trades.' },
  Senna:       { Vayne:'Long range poke and healing sustain out-trades her.', default:'Infinite scaling range plus healing overwhelms most matchups.' },
  Caitlyn:     { default:'Range advantage forces passive play. Traps punish every engage.' },
  Draven:      { default:'Catch-and-kill early. Axes punish passive play hard.' },
  // Support
  Taric:       { Nautilus:'Ult makes your ADC unkillable through his engage.', Blitzcrank:'Invulnerability timing counters his hook burst combo.', default:'Ult invulnerability and stun negate engage burst patterns.' },
  Zilean:      { Leona:'Ult on ADC negates her all-in kill combo.', default:'Ult revive counters any kill-based engage pattern.' },
  Morgana:     { Blitzcrank:'Black Shield blocks his hook completely.', Nautilus:'Black Shield negates his chain CC sequence.', default:'Black Shield blocks CC chains. Q root punishes engage.' },
  Zyra:        { Thresh:'Zone control denies his lantern and hook patterns.', default:'Plant zone control and CC chain punish hook-based supports.' },
  Brand:       { Thresh:'AoE punishes his grouped lantern setup.', default:'Passive burn and AoE punish clustered engage supports hard.' },
  Sona:        { Leona:'Ult shockwave stops her full engage combo.', Janna:'Sustained poke and ult counter her disengage pattern.', default:'Ult shockwave stops engage. Sustained poke wins lane attrition.' },
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


// ── App state ──
const state = {
  myLane:      null,
  enemyChamp:  null,
  myChamp:     null,
  pickerTarget: null,
};

// ── Helpers ──
function champImgUrl(c) { return `https://ddragon.leagueoflegends.com/cdn/${_version}/img/champion/${c.image.full}`; }
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
// Hard-coded lane overrides for champions with ambiguous tags
const LANE_OVERRIDES = {
  // Top lane specialists
  KSante:'top', TahmKench:'top', Tahm_Kench:'top', Olaf:'top', Urgot:'top',
  Singed:'top', Mordekaiser:'top', Tryndamere:'top', Heimerdinger:'top',
  Vladimir:'top', Gangplank:'top', Kayle:'top', Gragas:'top', Ambessa:'top',
  Quinn:'top', Teemo:'top', Gnar:'top', Kennen:'top', Jayce:'top',
  Zac:'jungle',
  // Mid lane specialists
  Hwei:'mid', Aurora:'mid', Azir:'mid', Corki:'mid', Smolder:'bot',
  Kalista:'bot', Seraphine:'support',
  // Support must-overrides
  Lux:'support', Neeko:'support',
};

function getPrimaryLane(c) {
  const id = c.id;
  const t  = c.tags || [];
  if (LANE_OVERRIDES[id])                                      return LANE_OVERRIDES[id];
  if (JUNGLE_IDS.has(id))                                      return 'jungle';
  if (MARKSMAN_IDS.has(id))                                    return 'bot';
  if (t.includes('Support') || SUPPORT_IDS.has(id))            return 'support';
  if (t.includes('Assassin') && !t.includes('Fighter'))        return 'mid';
  if (t.includes('Mage') && !t.includes('Fighter') && !t.includes('Tank')) return 'mid';
  if (t.includes('Fighter') || t.includes('Tank'))             return 'top';
  return 'top';
}

// ── Init ──
async function init() {
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then(r=>r.json());
    _version = versions[0];
    const champR = await fetch(`https://ddragon.leagueoflegends.com/cdn/${_version}/data/en_US/champion.json`).then(r=>r.json());
    _champMap  = champR.data;
    _champList = Object.values(_champMap).sort((a,b)=>a.name.localeCompare(b.name));
    document.getElementById('cp-loading').classList.add('hidden');
    document.getElementById('cp-builder').classList.remove('hidden');
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

// ── Lane pills (Step 1) ──
function renderLanePillsBig() {
  const container = document.getElementById('my-lane-pills-big');
  container.innerHTML = LANES.map(lane => {
    const m      = LANE_META[lane];
    const active = state.myLane === lane ? 'active' : '';
    return `<button class="cp-lane-pill-big ${active}" onclick="setMyLaneBig('${lane}',this)">
      <span class="cp-lpb-emoji">${m.emoji}</span>
      <span class="cp-lpb-label">${m.label}</span>
    </button>`;
  }).join('');
}

function setMyLaneBig(lane, btn) {
  state.myLane     = lane;
  state.enemyChamp = null;
  state.myChamp    = null;
  document.querySelectorAll('.cp-lane-pill-big').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('step2-card').classList.remove('hidden');
  document.getElementById('cp-counter-results').classList.add('hidden');
  document.getElementById('cp-insights-section').classList.add('hidden');
  renderEnemySlot();
}

// ── Enemy slot (Step 2) ──
function renderEnemySlot() {
  const el    = document.getElementById('enemy-champ-slot');
  const champ = state.enemyChamp;
  if (!champ) {
    el.className = 'cp-enemy-slot empty';
    el.onclick   = openEnemyPicker;
    el.innerHTML = `<div class="cp-enemy-slot-inner">
      <div class="cp-enemy-plus">+</div>
      <div class="cp-enemy-hint">Click to select enemy</div>
    </div>`;
    return;
  }
  el.className = 'cp-enemy-slot filled';
  el.onclick   = openEnemyPicker;
  el.innerHTML = `
    <img class="cp-enemy-img" src="${champImgUrl(champ)}" alt="${champ.name}" />
    <div class="cp-enemy-info">
      <div class="cp-enemy-name">${champ.name}</div>
      <div class="cp-enemy-change">Click to change</div>
    </div>`;
}

function openEnemyPicker() {
  state.pickerTarget = 'enemy';
  document.getElementById('cp-picker-title').textContent = 'Select Enemy Champion';
  openPicker();
}

// ── Picker ──
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
  const q    = query.toLowerCase().trim();
  const skip = new Set([state.enemyChamp?.id, state.myChamp?.id].filter(Boolean));
  let list   = _champList.filter(c => {
    if (skip.has(c.id)) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  }).slice(0, 200);

  const grid = document.getElementById('cp-picker-grid');
  grid.innerHTML = list.map(c => {
    const lane = getPrimaryLane(c);
    const m    = LANE_META[lane];
    return `<div class="cp-picker-champ" onclick="selectChamp('${c.id}')">
      <img src="${champImgUrl(c)}" alt="${c.name}" loading="lazy" />
      <span class="cp-picker-name">${c.name}</span>
      <span class="cp-picker-lane">${m.emoji} ${m.short}</span>
    </div>`;
  }).join('');
}

function selectChamp(id) {
  const champ = _champMap[id];
  if (!champ) return;
  const target = state.pickerTarget;
  closePicker();
  if (target === 'enemy') {
    state.enemyChamp = champ;
    renderEnemySlot();
    // Auto-compute and show counters
    const data = computeCounters(champ, [champ], state.myLane);
    renderCounterSuggestions(data, champ);
    document.getElementById('cp-counter-results').classList.remove('hidden');
    document.getElementById('cp-insights-section').classList.add('hidden');
    document.getElementById('cp-counter-results').scrollIntoView({ behavior:'smooth', block:'start' });
  }
}

function selectCounterPick(id) {
  const champ = _champMap[id];
  if (!champ) return;
  state.myChamp = champ;

  const laneOpponent = state.enemyChamp;
  const enemies      = laneOpponent ? [laneOpponent] : [];
  const myRole       = getRole(champ);
  const myDmgType    = getDamageType(champ);

  // Compute simple enemy ratios for insights
  let adRatio = 0.5, apRatio = 0.5;
  if (laneOpponent) {
    const atk = laneOpponent.info?.attack || 5;
    const mag = laneOpponent.info?.magic  || 5;
    const tot = (atk + mag) || 1;
    adRatio = atk / tot; apRatio = mag / tot;
  }
  const threats = { tank:0, assassin:0, healer:0, diver:0, marksman:0 };
  if (laneOpponent) {
    const r = getRole(laneOpponent);
    if (r === 'tank')     threats.tank++;
    if (r === 'assassin') threats.assassin++;
    if (r === 'support')  threats.healer++;
    if (r === 'marksman') threats.marksman++;
  }

  const insights = generateInsights(champ, myRole, myDmgType, state.myLane,
    laneOpponent, enemies, adRatio, apRatio, 'carry', threats, laneOpponent);

  document.getElementById('res-insights-content').innerHTML = insights.map(ins => `
    <div class="cp-insight-row">
      <div class="cp-insight-icon">${ins.icon}</div>
      <div class="cp-insight-body">
        <div class="cp-insight-label">${ins.label}</div>
        <div class="cp-insight-text">${ins.text}</div>
      </div>
    </div>`).join('');

  document.getElementById('cp-insights-section').classList.remove('hidden');
  document.getElementById('cp-insights-section').scrollIntoView({ behavior:'smooth', block:'start' });
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
  const role = enemy ? getRole(enemy) : 'default';
  // Per-lane fallbacks — only champs that actually play that lane
  const laneFallbacks = {
    top: {
      assassin: [['Malphite',69],['Renekton',67],['Garen',65],['Wukong',63],['Camille',61]],
      mage:     [['Malphite',69],['Garen',67],['Nasus',65],['Darius',63],['Renekton',61]],
      tank:     [['Vayne',71],['Fiora',69],['Camille',67],['Gnar',64],['Jayce',62]],
      fighter:  [['Malphite',67],['Renekton',65],['Camille',63],['Garen',61],['Darius',59]],
      marksman: [['Malphite',70],['Renekton',68],['Irelia',65],['Camille',63],['Darius',61]],
      default:  [['Malphite',66],['Renekton',64],['Garen',62],['Camille',60],['Darius',58]],
    },
    jungle: {
      assassin: [['Warwick',71],['Vi',69],['Hecarim',66],['Amumu',64],['Nocturne',62]],
      mage:     [['Hecarim',69],['Vi',67],['Graves',65],['Warwick',63],['Amumu',61]],
      tank:     [['Hecarim',69],['Graves',67],['Vi',65],['Elise',63],['Nidalee',61]],
      fighter:  [['Warwick',69],['Vi',67],['Hecarim',64],['Graves',62],['Amumu',60]],
      marksman: [['Warwick',68],['Vi',66],['Hecarim',63],['Graves',61],['Amumu',59]],
      default:  [['Warwick',67],['Vi',65],['Hecarim',63],['Graves',61],['Amumu',59]],
    },
    mid: {
      assassin: [['Lissandra',71],['Malzahar',69],['Galio',67],['Anivia',64],['Diana',62]],
      mage:     [['Zed',69],['Talon',67],['Fizz',65],['Katarina',63],['Akali',61]],
      fighter:  [['Malzahar',69],['Lissandra',67],['Galio',65],['Anivia',63],['Diana',61]],
      tank:     [['Zed',67],['Fizz',65],['Katarina',63],['Talon',61],['Akali',59]],
      marksman: [['Zed',68],['Talon',66],['Katarina',64],['Fizz',62],['Akali',60]],
      default:  [['Galio',66],['Lissandra',64],['Malzahar',62],['Zed',61],['Fizz',59]],
    },
    bot: {
      marksman: [['Draven',69],['Caitlyn',67],['Lucian',65],['Kaisa',63],['Vayne',61]],
      mage:     [['Draven',67],['Caitlyn',65],['Lucian',63],['Vayne',61],['Kaisa',59]],
      support:  [['Draven',66],['Caitlyn',64],['Lucian',62],['Kaisa',60],['Vayne',58]],
      fighter:  [['Caitlyn',68],['Draven',66],['Lucian',64],['Kaisa',62],['Vayne',60]],
      default:  [['Caitlyn',66],['Draven',64],['Lucian',62],['Kaisa',60],['Vayne',58]],
    },
    support: {
      tank:     [['Thresh',67],['Lulu',65],['Janna',64],['Soraka',62],['Brand',60]],
      mage:     [['Thresh',67],['Lulu',65],['Morgana',63],['Janna',61],['Soraka',59]],
      support:  [['Blitzcrank',67],['Leona',65],['Brand',63],['Pyke',61],['Nautilus',59]],
      assassin: [['Lulu',68],['Thresh',66],['Janna',64],['Soraka',62],['Brand',60]],
      default:  [['Thresh',66],['Lulu',64],['Janna',62],['Soraka',60],['Brand',58]],
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


document.addEventListener('DOMContentLoaded', init);
