// V7 沉浸式喝酒配置：把“酒名”升级为“酒瓶 + 酒杯 + 倒酒 + 饮用动作”
// 不修改 V6 DRINKS 数据，V7 页面按 id 叠加这些表现参数。

const V7_DRINK_PROFILES = {
  beer: {
    bottle: { kind: 'beer', label: 'LAGER', cap: '#d7b56d', body: '#5b3a17', glass: 'amber' },
    pour: { duration: 1500, streamWidth: 12, fillRatio: 0.88, foam: true, tilt: 68 },
    motion: { lift: 110, rotate: -18, duration: 900, finish: '哈——爽！' },
    serving: '冰镇啤酒杯 · 沿杯壁倒入'
  },
  baijiu: {
    bottle: { kind: 'baijiu', label: '白酒', cap: '#c22f2f', body: '#e9e2d4', glass: 'clear' },
    pour: { duration: 850, streamWidth: 6, fillRatio: 0.96, foam: false, tilt: 58 },
    motion: { lift: 130, rotate: -38, duration: 650, finish: '嘶——够劲。' },
    serving: '小酒盅 · 倒满 · 一口闷'
  },
  whiskey: {
    bottle: { kind: 'whiskey', label: 'WHISKY', cap: '#1e1d1b', body: '#8b5526', glass: 'amber' },
    pour: { duration: 1250, streamWidth: 7, fillRatio: 0.52, foam: false, tilt: 62 },
    motion: { lift: 100, rotate: -24, duration: 1000, finish: '慢点，后劲来了。' },
    serving: '厚底杯 · 少量倒入 · 慢品'
  },
  cocktail: {
    bottle: { kind: 'cocktail', label: 'BAR', cap: '#da5f8e', body: '#e89fc0', glass: 'pink' },
    pour: { duration: 1350, streamWidth: 8, fillRatio: 0.70, foam: false, tilt: 60 },
    motion: { lift: 95, rotate: -20, duration: 1050, finish: '这一杯有点危险。' },
    serving: '鸡尾酒杯 · 建议去调酒台现做',
    requiresBartending: true
  },
  erguotou: {
    bottle: { kind: 'erguotou', label: '二锅头', cap: '#d33c33', body: '#eef0e8', glass: 'clear' },
    pour: { duration: 760, streamWidth: 6, fillRatio: 0.98, foam: false, tilt: 60 },
    motion: { lift: 135, rotate: -42, duration: 620, finish: '这一口，真顶。' },
    serving: '小锥杯 · 快倒快喝'
  },
  wine: {
    bottle: { kind: 'wine', label: 'BORDEAUX', cap: '#6c1e2d', body: '#1d3c2c', glass: 'red' },
    pour: { duration: 1750, streamWidth: 8, fillRatio: 0.34, foam: false, tilt: 64 },
    motion: { lift: 90, rotate: -16, duration: 1250, finish: '别急，慢慢品。' },
    serving: '高脚杯 · 只倒约三分之一'
  }
}

function getV7Profile(id) {
  return V7_DRINK_PROFILES[id] || V7_DRINK_PROFILES.beer
}

module.exports = { V7_DRINK_PROFILES, getV7Profile }
