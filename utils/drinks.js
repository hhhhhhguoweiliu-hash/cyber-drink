// utils/drinks.js - 酒类数据、专属骚话、成就系统
// 每种酒有 glassType 字段决定 Canvas 杯型，quotes 字段是按醉酒等级的专属文案

// 酒类列表
const DRINKS = [
  {
    id: 'beer',
    name: '啤酒',
    emoji: '🍺',
    color: '#FAC775',
    liquidColor: 'rgba(250, 199, 117, 0.78)',
    strokeColor: '#EF9F27',
    foamColor: '#FAEEDA',
    abv: 5,
    drunkSpeed: 1.0,
    desc: '度数低 · 上头慢',
    sipsPerGlass: 8,
    tag: '入门首选',
    glassType: 'beer_mug'  // 高柱+把手
  },
  {
    id: 'baijiu',
    name: '白酒',
    emoji: '🍶',
    color: '#F5C4B3',
    liquidColor: 'rgba(245, 220, 200, 0.65)',
    strokeColor: '#D85A30',
    foamColor: '#FAECE7',
    abv: 53,
    drunkSpeed: 3.0,
    desc: '一口就上头',
    sipsPerGlass: 5,
    tag: '硬核选手',
    glassType: 'shot_glass'  // 小矮杯
  },
  {
    id: 'whiskey',
    name: '威士忌',
    emoji: '🥃',
    color: '#D4A574',
    liquidColor: 'rgba(192, 128, 60, 0.72)',
    strokeColor: '#8B5E3C',
    foamColor: '#E8D5C4',
    abv: 40,
    drunkSpeed: 2.5,
    desc: '有品位 · 后劲大',
    sipsPerGlass: 6,
    tag: '文艺青年',
    glassType: 'rocks_glass'  // 矮宽+厚底
  },
  {
    id: 'cocktail',
    name: '鸡尾酒',
    emoji: '🍹',
    color: '#F4C0D1',
    liquidColor: 'rgba(244, 130, 180, 0.72)',
    strokeColor: '#D4537E',
    foamColor: '#FBEAF0',
    abv: 15,
    drunkSpeed: 1.5,
    desc: '花里胡哨 · 不知不觉',
    sipsPerGlass: 7,
    tag: '氛围担当',
    glassType: 'cocktail_glass'  // V碗+高脚
  },
  {
    id: 'erguotou',
    name: '二锅头',
    emoji: '🥴',
    color: '#9FE1CB',
    liquidColor: 'rgba(180, 230, 210, 0.6)',
    strokeColor: '#1D9E75',
    foamColor: '#E1F5EE',
    abv: 56,
    drunkSpeed: 3.5,
    desc: '够劲 · 穷喝的',
    sipsPerGlass: 4,
    tag: '性价比之王',
    glassType: 'erguotou_glass'  // 小杯略锥
  },
  {
    id: 'wine',
    name: '红酒',
    emoji: '🍷',
    color: '#C77B7B',
    liquidColor: 'rgba(160, 30, 40, 0.82)',
    strokeColor: '#8B3A3A',
    foamColor: '#F5D5D5',
    abv: 13,
    drunkSpeed: 1.2,
    desc: '优雅 · 慢慢品',
    sipsPerGlass: 8,
    tag: '装逼必备',
    glassType: 'wine_glass'  // 大碗+高脚
  }
]

// 醉酒等级 + 通用文案（用于没找到专属文案时兜底）
const DRUNK_LEVELS = [
  { min: 0,   max: 15,  status: '清醒',     color: '#5DCAA5', effect: 'none' },
  { min: 15,  max: 35,  status: '微醺',     color: '#EF9F27', effect: 'none' },
  { min: 35,  max: 55,  status: '上头了',   color: '#BA7517', effect: 'wobble' },
  { min: 55,  max: 75,  status: '醉了',     color: '#D85A30', effect: 'blur' },
  { min: 75,  max: 92,  status: '断片边缘', color: '#A32D2D', effect: 'heavy' },
  { min: 92,  max: 100, status: '已断片',   color: '#791F1F', effect: 'blackout' }
]

// 通用兜底文案（按等级）
const FALLBACK_QUOTES = [
  ['今天状态不错', '先整一口热热身', '喝酒不开车'],
  ['感觉还不错，再来一口', '今天心情好', '这酒不上头啊'],
  ['我没醉！我能喝！', '再来！谁怕谁！', '我酒量你知道的'],
  ['我没醉！真的没醉！', '你说的那个朋友是不是你自己？', '我给你讲个故事啊...'],
  ['你谁啊？', '这地在转...它为什么在转？', '明天我一定不喝了'],
  ['zzz...', '...（已无响应）', '次日醒来：我昨晚干了什么？']
]

// 每种酒的专属骚话 - 按 [清醒, 微醺, 上头了, 醉了, 断片边缘, 已断片] 分组
const DRINK_QUOTES = {
  beer: [
    ['先开一罐热热身', '服务员，来一打！', '今晚不醉不归', '啤酒配花生绝了'],
    ['爽！再来一罐！', '老板，加冰！', '这啤酒不上头啊', '咕咚咕咚'],
    ['服务员！再来一箱！', '老板！我账呢？', '哥几个走一个！', '今晚我请！'],
    ['我说我平时不这样的...', '服务员怎么不倒酒？', '啤酒？啤酒是什么？', '我账单呢？'],
    ['卫生间在哪...卫生间...', '吧台在哪？', '吧台在转...'],
    ['z...z...', '啤酒...啤酒...', '...嘟...嘟...']
  ],
  baijiu: [
    ['感情深一口闷', '干了干了', '哥俩好', '五粮液茅合剑南春'],
    ['再来一杯！', '小意思', '这酒有劲', '满上满上'],
    ['干！谁不干谁孙子！', '哥！咱俩再走一个！', '我跟你说啊...', '感情深！'],
    ['我没醉！我能走直线！', '这酒不纯...', '哥，你听我说...', '我没醉！真没醉！'],
    ['你是谁啊？', '我家里电话多少来着？', '哥...哥你叫什么？'],
    ['z...z...', '...嘟...嘟...', '白酒...白酒...']
  ],
  whiskey: [
    ['On the rocks', '不加冰，谢谢', '今晚不写诗了', '先品一口'],
    ['这口感层次感不错', '雪莉桶的香气', '品，要品', '再来一杯，不加冰'],
    ['调酒师！', '今晚的诗有了', '威士忌加冰也行', '再来一杯，单桶的'],
    ['Show me the way...', 'The night is still young...', '调酒师去哪了？', '今晚的诗没了'],
    ['Where am I?', 'Whiskey...gone...', '调酒师呢...？'],
    ['...zzz...', 'Whiskey...whiskey...', '...silence...']
  ],
  cocktail: [
    ['今天点个长岛', '调酒师推荐', '再来一杯Mojito', '今晚氛围不错'],
    ['再来一杯长岛！', '调酒师，加点樱桃', '我请客！', 'Mojito不加糖'],
    ['Singapore Sling！', '调酒师！调酒师！', '点单！点单！', '再来一杯彩虹'],
    ['这杯什么来着？', '我点了几杯了？', '调酒师去哪了？', '账单...账单...'],
    ['调酒师...调酒师呢？', '吧台在哪？', 'Mojito...Mojito...'],
    ['...zzz...', 'cocktail...gone...', '...嘟...嘟...']
  ],
  erguotou: [
    ['够劲', '这酒够劲', '穷喝的也过瘾', '红星还是牛栏山？'],
    ['再来一瓶！', '够劲！', '二锅头最对味', '北京的味道'],
    ['服务员！再来一瓶！', '我跟你说，我北京人...', '够劲！再来！', '红星牛栏山都行'],
    ['二锅头...二锅头是什么？', '这酒...上头...', '北京...北京...', '服务员呢？'],
    ['北京...北京...', '红星...红星...', '我北京...我北京...'],
    ['z...z...', '二锅头...二锅头...', '...嘟...嘟...']
  ],
  wine: [
    ['今晚品一支波尔多', '摇一摇再喝', '这酒年份不错', '先醒醒酒'],
    ['黑皮诺的果香', '单宁柔顺', '再开一瓶！', '果香不错'],
    ['醒酒！醒酒！', '再来一瓶，82年的！', '酒柜里还有什么？', '摇一摇再喝'],
    ['这酒...这酒涩...', '醒酒器呢？醒酒器？', '波尔多...波尔多...', '果香...果香没了'],
    ['酒窖...酒窖在哪？', '82年...82年...', '波尔多...波尔多...'],
    ['...zzz...', '红酒...红酒...', '...嘟...嘟...']
  ]
}

// 成就列表（扩展到 11 个）
const ACHIEVEMENTS = [
  { id: 'first_sip', name: '第一口', desc: '喝了第一口酒', condition: (s) => s.totalSips >= 1 },
  { id: 'beer_lover', name: '啤酒肚', desc: '累计喝完10杯啤酒', condition: (s) => (s.drinkRecords || []).filter(r => r.drinkId === 'beer').length >= 10 },
  { id: 'baijiu_warrior', name: '白酒战神', desc: '累计喝完5杯白酒', condition: (s) => (s.drinkRecords || []).filter(r => r.drinkId === 'baijiu').length >= 5 },
  { id: 'hundred_sips', name: '百杯不醉', desc: '累计喝满100口', condition: (s) => s.totalSips >= 100 },
  { id: 'century_club', name: '千杯不醉', desc: '累计喝满1000口', condition: (s) => s.totalSips >= 1000 },
  { id: 'blackout', name: '断片达人', desc: '第一次喝到断片', condition: (s) => s.maxDrunkLevel >= 92 },
  { id: 'all_drinks', name: '全能酒鬼', desc: '尝试过所有酒类', condition: (s) => {
    const tried = new Set((s.drinkRecords || []).map(r => r.drinkId))
    return tried.size >= DRINKS.length
  }},
  { id: 'tipsy_master', name: '微醺艺术家', desc: '停在微醺状态结束一局', condition: (s) => s.maxDrunkLevel >= 15 && s.maxDrunkLevel < 35 },
  { id: 'shot_master', name: '一口闷', desc: '3秒内喝完一整杯', condition: (s) => (s.unlockedFlags || []).includes('shot_master') },
  { id: 'mix_master', name: '混喝达人', desc: '一局喝过3种以上酒', condition: (s) => (s.unlockedFlags || []).includes('mix_master') },
  { id: 'early_bird', name: '早酒鬼', desc: '早上6点前喝酒', condition: (s) => (s.unlockedFlags || []).includes('early_bird') }
]

// 根据醉酒度获取等级索引
function getDrunkLevel(drunkValue) {
  for (let i = DRUNK_LEVELS.length - 1; i >= 0; i--) {
    if (drunkValue >= DRUNK_LEVELS[i].min) {
      return { ...DRUNK_LEVELS[i], levelIndex: i }
    }
  }
  return { ...DRUNK_LEVELS[0], levelIndex: 0 }
}

// 获取专属文案：传入酒 id 和醉酒度
function getRandomQuote(drunkValue, drinkId) {
  const { levelIndex } = getDrunkLevel(drunkValue)
  let pool = []
  if (drinkId && DRINK_QUOTES[drinkId]) {
    pool = DRINK_QUOTES[drinkId][levelIndex] || []
  }
  if (!pool.length) {
    pool = FALLBACK_QUOTES[levelIndex] || FALLBACK_QUOTES[0]
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

// 检查成就解锁
function checkAchievements(stats) {
  const newlyUnlocked = []
  const existing = new Set(stats.unlockedAchievements || [])
  for (const ach of ACHIEVEMENTS) {
    if (!existing.has(ach.id) && ach.condition(stats)) {
      newlyUnlocked.push(ach)
      stats.unlockedAchievements = stats.unlockedAchievements || []
      stats.unlockedAchievements.push(ach.id)
    }
  }
  return newlyUnlocked
}

// 解锁 flag 类成就（一口闷/混喝达人/早酒鬼）
function unlockFlag(stats, flag) {
  stats.unlockedFlags = stats.unlockedFlags || []
  if (!stats.unlockedFlags.includes(flag)) {
    stats.unlockedFlags.push(flag)
    return true
  }
  return false
}

// ============================================================
// 风格模式
// ============================================================
const STYLE_MODES = {
  heroic: {
    id: 'heroic',
    name: '绿林好汉',
    sub: '豪迈风',
    tagline: '大碗喝酒 大口吃肉',
    desc: '江湖儿女，不醉不归',
    emoji: '⚔️',
    // 主题色
    theme: {
      bgGradient: 'linear-gradient(180deg, #1a1206 0%, #2b1d0c 40%, #1a1206 100%)',
      bgCard: 'rgba(80, 50, 15, 0.12)',
      bgCardActive: 'rgba(120, 70, 20, 0.25)',
      borderActive: '#c88a2e',
      accent: '#c88a2e',
      accentLight: 'rgba(200, 138, 46, 0.15)',
      text: '#e8d5b0',
      textSub: '#a89070',
      textMuted: '#6b5a3e',
      glow: 'rgba(200, 138, 46, 0.4)',
      navBar: '#1a1206',
      navTitle: '#c88a2e'
    },
    // 豪迈风格文案池
    quotes: {
      enter: ['好汉来了！', '酒家掌柜，上酒！', '今日不醉不归！', '江湖救急，先来一碗'],
      glassEmpty: ['碗空了！满上！', '酒保！再来一碗！', '这碗太小了换大的'],
      chug: ['咕咚咕咚咕咚！', '痛快！', '豪气干云！', '这才像样！'],
      result: ['好汉海量！', '这酒量，梁山第一！', '兄弟义气，全在酒里了', '今日痛饮三百碗']
    }
  },
  elegant: {
    id: 'elegant',
    name: '才子佳人',
    sub: '婉约风',
    tagline: '花间一壶酒 独酌无相亲',
    desc: '月下独酌，微醺即止',
    emoji: '🌙',
    theme: {
      bgGradient: 'linear-gradient(180deg, #0f1419 0%, #1a2330 40%, #0f1419 100%)',
      bgCard: 'rgba(180, 200, 220, 0.06)',
      bgCardActive: 'rgba(180, 200, 220, 0.14)',
      borderActive: '#7eb8c9',
      accent: '#7eb8c9',
      accentLight: 'rgba(126, 184, 201, 0.15)',
      text: '#d4dce4',
      textSub: '#8a9aaa',
      textMuted: '#5a6878',
      glow: 'rgba(126, 184, 201, 0.35)',
      navBar: '#0f1419',
      navTitle: '#7eb8c9'
    },
    quotes: {
      enter: ['夜色如水，小酌一杯', '花好月圆，正当饮时', '独酌亦风流', '浅浅一杯，不醉不归'],
      glassEmpty: ['杯空了，再斟一杯', '酒阑人散，再续一壶', '空杯亦有余香'],
      chug: ['一饮而尽，痛快', '豪饮亦是雅事', '醉里乾坤大'],
      result: ['微醺即风流', '酒不醉人人自醉', '今宵酒醒何处', '小酌怡情，大饮伤身']
    }
  }
}

// ============================================================
// 调酒步骤系统（鸡尾酒专用）
// ============================================================
const BARTENDING_STEPS = [
  {
    id: 0,
    name: '选基酒',
    desc: '先选一款基酒倒入调酒壶',
    emoji: '🍾',
    animation: 'pour_base',
    hint: '点击选择基酒'
  },
  {
    id: 1,
    name: '加冰块',
    desc: '放入冰块冰镇',
    emoji: '🧊',
    animation: 'add_ice',
    hint: '点击放入冰块'
  },
  {
    id: 2,
    name: '倒辅料',
    desc: '加入果汁和糖浆',
    emoji: '🍊',
    animation: 'add_mixer',
    hint: '点击加入辅料'
  },
  {
    id: 3,
    name: '摇匀',
    desc: '用力摇晃调酒壶',
    emoji: '🍸',
    animation: 'shake',
    hint: '左右摇晃手机'
  },
  {
    id: 4,
    name: '出酒',
    desc: '将调好的酒倒入杯中',
    emoji: '✨',
    animation: 'pour_out',
    hint: '点击倒酒入杯'
  },
  {
    id: 5,
    name: '装饰',
    desc: '加上樱桃和薄荷叶',
    emoji: '🍒',
    animation: 'garnish',
    hint: '点击加装饰'
  }
]

// 调酒配方可选基酒
const BASE_LIQUORS = [
  { id: 'gin', name: '金酒', emoji: '🥃', color: 'rgba(220, 230, 240, 0.7)' },
  { id: 'rum', name: '朗姆', emoji: '🥃', color: 'rgba(200, 160, 80, 0.7)' },
  { id: 'vodka', name: '伏特加', emoji: '🥃', color: 'rgba(240, 240, 245, 0.7)' },
  { id: 'tequila', name: '龙舌兰', emoji: '🥃', color: 'rgba(220, 200, 100, 0.7)' }
]

// 辅料列表
const MIXERS = [
  { id: 'orange', name: '橙汁', emoji: '🍊', color: '#F4A460' },
  { id: 'cranberry', name: '蔓越莓汁', emoji: '🔴', color: '#C0392B' },
  { id: 'lime', name: '青柠汁', emoji: '🟢', color: '#A3CB38' },
  { id: 'soda', name: '苏打水', emoji: '🫧', color: 'rgba(200,220,230,0.5)' }
]

module.exports = {
  DRINKS,
  DRUNK_LEVELS,
  ACHIEVEMENTS,
  STYLE_MODES,
  BARTENDING_STEPS,
  BASE_LIQUORS,
  MIXERS,
  getDrunkLevel,
  getRandomQuote,
  checkAchievements,
  unlockFlag
}
