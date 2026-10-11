// AJANLAR: 12 karakter, her birinin 4 yeteneği var (C, Q, E ve X = ulti).
// Yetenekler Valorant'taki rollere benzer şekilde tasarlandı; isimler ve görünüşler bu oyuna özgü.

export const ROLES = {
  duelist: { name: 'DÜELLOCU', desc: 'Kendi başına leş almak için tasarlandı. Saldırının önünde gider.' },
  controller: { name: 'KONTROLCÜ', desc: 'Dumanlar ve alan kontrolüyle takımın önünü açar.' },
  initiator: { name: 'ÖNCÜ', desc: 'Düşmanı ortaya çıkarır, kör eder, sersemletir.' },
  sentinel: { name: 'GÖZCÜ', desc: 'Bölgeyi savunur, takımı iyileştirir, arkayı kollar.' },
};

export const AGENTS = {
  zephyr: {
    name: 'ZEPHYR', role: 'duelist', icon: '🌪️', ult: 7,
    bio: 'Rüzgârla dans eden çevik bir düellocu. Kimsenin yetişemediği yerlere bir anda ulaşır.',
    look: { main: 0xdfe8f0, accent: 0x6fd3ff, pants: 0x3a4a5c, skin: 0xf0c9a8, hair: 0xf2f6ff, style: 'ponytail' },
    abilities: [
      { key: 'C', name: 'Yükseliş', type: 'updraft', charges: 2, cost: 150, desc: 'Anında havaya fırla.' },
      { key: 'Q', name: 'Bulut Patlaması', type: 'smoke', mode: 'throw', radius: 3.2, duration: 5, color: 0xdfeeff, charges: 2, cost: 200, desc: 'Çarptığı yerde kısa süreli küçük bir duman bulutu açan küre fırlat.' },
      { key: 'E', name: 'Rüzgâr Atılımı', type: 'dash', charges: 1, desc: 'Hareket ettiğin yöne doğru hızla atıl.' },
      { key: 'X', name: 'Bıçak Fırtınası', type: 'bladeStorm', desc: '5 ölümcül fırlatma bıçağı çıkar. Kafaya tek atar. Leş alınca bıçaklar yenilenir.' },
    ],
  },
  ember: {
    name: 'EMBER', role: 'duelist', icon: '🔥', ult: 6,
    bio: 'Ateşi kontrol eden, alevlerin içinde iyileşen gözü kara bir savaşçı.',
    look: { main: 0x2a2224, accent: 0xff7a1a, pants: 0x1c1c22, skin: 0x8a5a3c, hair: 0x1a1210, style: 'spiky' },
    abilities: [
      { key: 'C', name: 'Alev Duvarı', type: 'fireWall', length: 16, duration: 8, dps: 30, charges: 1, cost: 200, desc: 'Baktığın yöne görüşü kesen bir ateş duvarı ör. Düşmanları yakar, seni iyileştirir.' },
      { key: 'Q', name: 'Kavisli Işık', type: 'flash', mode: 'throw', speed: 24, pop: 0.45, blind: 1.8, charges: 2, cost: 250, desc: 'Kısa sürede patlayıp bakan düşmanları kör eden ışık küresi at.' },
      { key: 'E', name: 'Sıcak Eller', type: 'molly', radius: 3.5, duration: 6, dps: 55, speed: 17, charges: 1, desc: 'Yere düşünce yanan bir ateş topu fırlat. Ateş seni iyileştirir.' },
      { key: 'X', name: 'Küllerden Doğuş', type: 'rebirth', desc: 'Bir işaret bırak. 10 saniye içinde ölürsen tam canla işarette yeniden doğarsın.' },
    ],
  },
  kira: {
    name: 'KİRA', role: 'duelist', icon: '👁️', ult: 6,
    bio: 'Düşmanlarının ruhundan beslenen, leş aldıkça güçlenen gölge avcısı.',
    look: { main: 0x2b1838, accent: 0xc04dff, pants: 0x1a1022, skin: 0xb07a5a, hair: 0x2a0e3a, style: 'long' },
    abilities: [
      { key: 'C', name: 'Kötü Göz', type: 'leer', duration: 2.2, charges: 2, cost: 250, desc: 'Duvarların içinden geçen bir göz gönder. Ona bakan düşmanların görüşü daralır.' },
      { key: 'Q', name: 'Ruh Emme', type: 'devour', amount: 60, needKill: true, charges: 2, cost: 200, desc: 'Son 5 saniyede leş aldıysan hızla 60 can yenile.' },
      { key: 'E', name: 'Kaçış', type: 'dismiss', needKill: true, charges: 2, desc: 'Son 5 saniyede leş aldıysan 2 saniyeliğine hasar almaz ve hızlanırsın.' },
      { key: 'X', name: 'İmparatoriçe', type: 'empress', desc: '25 saniye boyunca çok daha hızlı ateş et ve ruhunla güçlen.' },
    ],
  },
  blast: {
    name: 'BLAST', role: 'duelist', icon: '💥', ult: 8,
    bio: 'Patlayıcılara tutkun, gürültüyü seven yıkım uzmanı.',
    look: { main: 0xf2b134, accent: 0x18c6b5, pants: 0x2a3138, skin: 0x7a4a2c, hair: 0x101010, style: 'bandana' },
    abilities: [
      { key: 'C', name: 'Patlama Paketi', type: 'satchel', speed: 16, charges: 2, cost: 200, desc: 'Patlayınca seni ve yakındakileri fırlatan paket at. Uzun atlayışlar için kullan.' },
      { key: 'Q', name: 'El Bombası', type: 'grenade', radius: 5, dmg: 75, fuse: 1.4, speed: 18, charges: 1, cost: 200, desc: 'Sekip patlayan klasik bir el bombası at.' },
      { key: 'E', name: 'Boya Bombası', type: 'grenade', radius: 5, dmg: 55, fuse: 1.2, speed: 17, cluster: 4, charges: 1, desc: 'Patlayınca etrafa 4 küçük bomba saçan küme bombası.' },
      { key: 'X', name: 'Gösteri Bitti', type: 'rocket', desc: 'Roketatar çıkar. Tek atışlık devasa bir patlama.' },
    ],
  },
  nyx: {
    name: 'NYX', role: 'controller', icon: '🌑', ult: 7,
    bio: 'Gölgelerin arasından çıkıp kaybolan, nerede olduğu asla bilinmeyen bir hayalet.',
    look: { main: 0x1b2236, accent: 0x6c5cff, pants: 0x121624, skin: 0x5a6070, hair: 0x0e1018, style: 'hood' },
    abilities: [
      { key: 'C', name: 'Gölge Adımı', type: 'teleport', range: 14, delay: 0.7, charges: 1, cost: 100, desc: 'Baktığın yere kısa mesafe ışınlan.' },
      { key: 'Q', name: 'Paranoya', type: 'blindLine', range: 32, dur: 2.2, charges: 1, cost: 300, desc: 'Duvarlardan geçen bir gölge gönder; değdiği düşmanların görüşü kararır.' },
      { key: 'E', name: 'Karanlık Örtü', type: 'smoke', mode: 'place', range: 45, radius: 4.5, duration: 15, color: 0x2a2450, charges: 2, desc: 'Baktığın noktaya uzun süreli koyu bir duman yerleştir.' },
      { key: 'X', name: 'Gölgelerden', type: 'teleport', range: 150, delay: 1.8, desc: 'Haritada baktığın herhangi bir yere ışınlan.' },
    ],
  },
  atlas: {
    name: 'ATLAS', role: 'controller', icon: '🛰️', ult: 7,
    bio: 'Uydularıyla savaş alanını yukarıdan yöneten emekli bir komutan.',
    look: { main: 0x4a5a3a, accent: 0xff9c3a, pants: 0x3a3428, skin: 0xd8a888, hair: 0xb8b0a8, style: 'beret' },
    abilities: [
      { key: 'C', name: 'Destek İşareti', type: 'stim', range: 10, radius: 6, duration: 12, charges: 1, cost: 200, desc: 'Takım arkadaşlarını hızlandıran ve atış hızını artıran bir işaret koy.' },
      { key: 'Q', name: 'Yangın Bombası', type: 'molly', radius: 4, duration: 7, dps: 60, speed: 16, charges: 1, cost: 250, desc: 'Bölgeyi yakan bir yangın bombası at.' },
      { key: 'E', name: 'Gökyüzü Dumanı', type: 'smoke', mode: 'place', range: 60, radius: 4.5, duration: 18, color: 0x8a8f9a, charges: 3, desc: 'Uydudan baktığın noktaya duman indir.' },
      { key: 'X', name: 'Yörünge Saldırısı', type: 'orbital', range: 150, radius: 7, dps: 120, desc: 'Baktığın noktaya yörüngeden ölümcül bir lazer indir.' },
    ],
  },
  lumen: {
    name: 'LUMEN', role: 'sentinel', icon: '💠', ult: 8,
    bio: 'Takımının can damarı. Buzdan duvarlar örer, yaraları kapatır, ölüleri bile geri getirir.',
    look: { main: 0x2e8f86, accent: 0x9ff7ff, pants: 0x1f3b44, skin: 0xe8c4a0, hair: 0x101418, style: 'bun' },
    abilities: [
      { key: 'C', name: 'Bariyer', type: 'wall', range: 10, charges: 1, cost: 400, desc: 'Baktığın yere geçilmez, kırılabilir bir buz duvarı ör.' },
      { key: 'Q', name: 'Yavaşlatma Küresi', type: 'slowOrb', radius: 6, duration: 7, speed: 18, charges: 2, cost: 200, desc: 'Düştüğü alanda düşmanları yavaşlatan küre at.' },
      { key: 'E', name: 'Şifa Küresi', type: 'healOrb', amount: 60, charges: 1, desc: 'Nişan aldığın takım arkadaşını ya da kendini iyileştir.' },
      { key: 'X', name: 'Diriliş', type: 'resurrect', desc: 'Ölmüş bir takım arkadaşını tam canla diriltir.' },
    ],
  },
  gear: {
    name: 'GEAR', role: 'sentinel', icon: '🔧', ult: 8,
    bio: 'Dâhi bir mühendis. Robotları ve taretleri bölgeyi onun yerine korur.',
    look: { main: 0xf5d020, accent: 0x6b4bff, pants: 0x2d2a3a, skin: 0xd9a77c, hair: 0x1d1d1d, style: 'goggles' },
    abilities: [
      { key: 'C', name: 'Nano Sürü', type: 'nanoswarm', radius: 3.2, dps: 45, speed: 15, charges: 2, cost: 200, desc: 'Gizli bir bomba at. Düşman yaklaşınca etrafa zarar veren böcekler saçar.' },
      { key: 'Q', name: 'Alarm Robotu', type: 'alarmbot', range: 10, charges: 1, cost: 200, desc: 'Yaklaşan düşmanı yakalayıp savunmasız bırakan bir robot yerleştir.' },
      { key: 'E', name: 'Taret', type: 'turret', range: 10, charges: 1, desc: 'Önündeki düşmanlara otomatik ateş eden bir taret kur.' },
      { key: 'X', name: 'Kuşatma', type: 'lockdown', range: 10, desc: '8 saniye sonra geniş bir alandaki bütün düşmanları etkisiz bırakan cihaz kur.' },
    ],
  },
  vigil: {
    name: 'VİGİL', role: 'sentinel', icon: '🎩', ult: 6,
    bio: 'Her şeyi gören, her şeyi bilen gizemli bir casus.',
    look: { main: 0xe6e2da, accent: 0x2fd4ff, pants: 0x2a2a30, skin: 0xc49a78, hair: 0x15151a, style: 'mask' },
    abilities: [
      { key: 'C', name: 'Tuzak Teli', type: 'trap', range: 12, charges: 2, cost: 200, desc: 'Duvara gizli bir tel ger. Geçen düşmanı açığa çıkarır ve yavaşlatır.' },
      { key: 'Q', name: 'Siber Kafes', type: 'smoke', mode: 'place', range: 25, radius: 3.2, duration: 7, slow: true, color: 0x7fe9ff, charges: 2, cost: 100, desc: 'İçinden geçenleri yavaşlatan küçük bir duman kafesi yerleştir.' },
      { key: 'E', name: 'Gözetleme Kamerası', type: 'camera', range: 15, charges: 1, desc: 'Duvara, gördüğü düşmanları takıma gösteren bir kamera yerleştir.' },
      { key: 'X', name: 'Sinirsel Hırsızlık', type: 'revealAll', desc: 'Yaşayan bütün düşmanların yerini iki kez açığa çıkar.' },
    ],
  },
  hawk: {
    name: 'HAWK', role: 'initiator', icon: '🏹', ult: 8,
    bio: 'Okunu duvarların arkasına gönderen soğukkanlı bir avcı.',
    look: { main: 0x3a5f8f, accent: 0x7ff0ff, pants: 0x3b3328, skin: 0xe8c8a8, hair: 0xd8d8d8, style: 'cap' },
    abilities: [
      { key: 'C', name: 'Şok Oku', type: 'shockDart', radius: 4, dmg: 75, charges: 2, cost: 150, desc: 'Çarptığı yerde patlayıp hasar veren ok at.' },
      { key: 'Q', name: 'Baykuş Darbesi', type: 'scoutPulse', radius: 14, pulses: 3, speed: 18, charges: 1, cost: 250, desc: 'Düştüğü yerde 3 kez tarama yapıp yakındaki düşmanları gösteren küre at.' },
      { key: 'E', name: 'Keşif Oku', type: 'revealDart', radius: 25, charges: 1, desc: 'Saplandığı yerden görüş alanındaki düşmanları iki kez açığa çıkaran ok.' },
      { key: 'X', name: 'Avcının Öfkesi', type: 'hunterFury', desc: 'Duvarları delen 3 enerji ışını at. Vurduğu düşmanı yaralar ve gösterir.' },
    ],
  },
  flora: {
    name: 'FLORA', role: 'initiator', icon: '🌿', ult: 7,
    bio: 'Doğanın gücünü taşıyan, yaratıklarıyla yolu açan bir koruyucu.',
    look: { main: 0x4f8f3a, accent: 0xd8ff6a, pants: 0x3b2e22, skin: 0xe2b48c, hair: 0xb8572a, style: 'long' },
    abilities: [
      { key: 'C', name: 'Yeniden Büyüme', type: 'healArea', radius: 12, amount: 50, charges: 1, cost: 200, desc: 'Yakındaki tüm takım arkadaşlarını ve kendini iyileştir.' },
      { key: 'Q', name: 'Yol Açıcı', type: 'stunGrenade', radius: 6, stun: 3, fuse: 1.0, speed: 17, charges: 1, cost: 250, desc: 'Patladığı alandaki düşmanları sersemleten bir yaratık at.' },
      { key: 'E', name: 'Rehber Işık', type: 'flash', mode: 'throw', speed: 22, pop: 0.7, blind: 2, charges: 2, desc: 'Uçan ve patlayınca bakan düşmanları kör eden bir kuş gönder.' },
      { key: 'X', name: 'Arayıcılar', type: 'seekers', desc: 'En yakın 3 düşmanı bulup görüşlerini karartan 3 arayıcı salar.' },
    ],
  },
  quake: {
    name: 'QUAKE', role: 'initiator', icon: '🌋', ult: 8,
    bio: 'Yeri titreten, duvarların arkasındakileri bile sarsan iri yarı bir savaşçı.',
    look: { main: 0x6a6f78, accent: 0xff8a2a, pants: 0x2f2a26, skin: 0xb07650, hair: 0xd36b2a, style: 'mohawk' },
    abilities: [
      { key: 'C', name: 'Artçı Şok', type: 'aftershock', range: 12, dmg: 60, charges: 1, cost: 100, desc: 'Duvarın arkasında 3 kez patlayan bir şarj yerleştir.' },
      { key: 'Q', name: 'Parlama Noktası', type: 'flash', mode: 'wall', range: 15, pop: 0.6, blind: 2, charges: 2, cost: 250, desc: 'Duvarın içinden geçip öbür tarafta patlayan kör edici ışık.' },
      { key: 'E', name: 'Fay Hattı', type: 'faultLine', range: 26, stun: 3.5, charges: 1, desc: 'Önündeki uzun bir hat boyunca düşmanları duvarlardan geçerek sersemlet.' },
      { key: 'X', name: 'Gürleyen Gök', type: 'rollingThunder', desc: 'Önündeki geniş bir alanda bütün düşmanları havaya fırlatıp sersemlet.' },
    ],
  },
};

export const AGENT_KEYS = Object.keys(AGENTS);

export function ability(agentKey, slot) {
  return AGENTS[agentKey].abilities.find((a) => a.key === slot);
}
