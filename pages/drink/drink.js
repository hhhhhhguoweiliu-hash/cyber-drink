// pages/drink/drink.js - 喝酒页面核心逻辑（6杯型 + 长按豪饮 + 专属文案）
const app = getApp()
const { DRINKS, STYLE_MODES, getDrunkLevel, getRandomQuote, checkAchievements, unlockFlag } = require('../../utils/drinks.js')
const audio = require('../../utils/audio.js')

Page({
  data: {
    drink: null,
    sips: 0,
    glasses: 0,
    drunkValue: 0,
    drunkStatus: '清醒',
    drunkLevelColor: '#5DCAA5',
    drunkEffect: '',
    currentQuote: '',
    quoteVisible: false,
    isDrinking: false,
    isChugging: false,
    chugFlash: false,
    themeStyle: ''
  },

  // Canvas 内部变量
  canvas: null,
  ctx: null,
  dpr: 1,
  animFrame: null,
  liquidLevel: 1.0,
  targetLiquidLevel: 1.0,
  bubbles: [],
  waveOffset: 0,
  canvasW: 0,
  canvasH: 0,
  glassConfig: null,
  liquidColor: 'rgba(250,199,117,0.75)',
  strokeColor: '#EF9F27',
  foamColor: '#FAEEDA',
  sessionDrinkIds: [],
  touchStartTime: 0,

  onLoad(options) {
    const drinkId = options.id
    const drink = DRINKS.find(d => d.id === drinkId) || DRINKS[0]
    this.liquidColor = drink.liquidColor
    this.strokeColor = drink.strokeColor
    this.foamColor = drink.foamColor
    this.sessionDrinkIds = [drink.id]

    // 早酒鬼检测（0~6点喝酒）
    const hour = new Date().getHours()
    if (hour >= 0 && hour < 6) {
      const stats = app.globalData.stats
      unlockFlag(stats, 'early_bird')
      app.saveStats()
    }

    this.setData({
      drink,
      liquidColor: drink.liquidColor,
      strokeColor: drink.strokeColor,
      foamColor: drink.foamColor
    })

    // 应用风格主题
    const styleId = app.globalData.styleMode || 'heroic'
    const mode = STYLE_MODES[styleId]
    if (mode) {
      const t = mode.theme
      const themeStyle = [
        `--bg-gradient: ${t.bgGradient}`,
        `--bg-card: ${t.bgCard}`,
        `--accent: ${t.accent}`,
        `--accent-light: ${t.accentLight}`,
        `--text-main: ${t.text}`,
        `--text-sub: ${t.textSub}`,
        `--text-muted: ${t.textMuted}`,
        `--glow: ${t.glow}`
      ].join('; ')
      this.setData({ themeStyle })
      wx.setNavigationBarColor({
        frontColor: '#ffffff',
        backgroundColor: t.navBar
      })
    }

    this.initCanvas()
    this.showQuote('开整！')
    audio.playSfx('pour')
  },

  onShow() {
    audio.resumeMusic()
  },

  onHide() {
    audio.pauseMusic()
  },

  onUnload() {
    if (this.animFrame && this.canvas) {
      this.canvas.cancelAnimationFrame(this.animFrame)
    }
    audio.pauseMusic()
  },

  // ====== 杯型配置（6种） ======
  getGlassConfig(glassType) {
    const cw = this.canvasW
    const ch = this.canvasH
    const cx = cw / 2

    switch (glassType) {
      case 'beer_mug': // 啤酒杯 - 高柱+把手
        return {
          cx, topY: ch * 0.08, bodyH: ch * 0.68,
          topW: cw * 0.42, botW: cw * 0.36,
          stemH: 0, stemW: 0, baseW: 0, baseH: 0,
          hasHandle: true, hasFoam: true,
          wallThick: 5, cornerR: 10, bubbleType: 'large'
        }
      case 'shot_glass': // 白酒杯 - 矮小
        return {
          cx, topY: ch * 0.30, bodyH: ch * 0.42,
          topW: cw * 0.26, botW: cw * 0.20,
          stemH: 0, stemW: 0, baseW: 0, baseH: 0,
          hasHandle: false, hasFoam: false,
          wallThick: 4, cornerR: 5, bubbleType: 'small'
        }
      case 'rocks_glass': // 威士忌杯 - 矮宽+厚底
        return {
          cx, topY: ch * 0.28, bodyH: ch * 0.42,
          topW: cw * 0.40, botW: cw * 0.38,
          stemH: 0, stemW: 0, baseW: 0, baseH: 0,
          hasHandle: false, hasFoam: false,
          wallThick: 6, cornerR: 6, bubbleType: 'none', thickBottom: true
        }
      case 'cocktail_glass': // 鸡尾酒杯 - V碗+高脚
        return {
          cx, topY: ch * 0.08, bodyH: ch * 0.40,
          topW: cw * 0.46, botW: cw * 0.03,
          stemH: ch * 0.30, stemW: 4, baseW: cw * 0.18, baseH: 5,
          hasHandle: false, hasFoam: false,
          wallThick: 3, cornerR: 0, bubbleType: 'medium', vShape: true
        }
      case 'erguotou_glass': // 二锅头杯 - 小锥
        return {
          cx, topY: ch * 0.35, bodyH: ch * 0.32,
          topW: cw * 0.22, botW: cw * 0.16,
          stemH: 0, stemW: 0, baseW: 0, baseH: 0,
          hasHandle: false, hasFoam: false,
          wallThick: 3, cornerR: 4, bubbleType: 'none'
        }
      case 'wine_glass': // 红酒杯 - 大碗+高脚
        return {
          cx, topY: ch * 0.06, bodyH: ch * 0.48,
          topW: cw * 0.34, botW: cw * 0.04,
          stemH: ch * 0.28, stemW: 4, baseW: cw * 0.20, baseH: 5,
          hasHandle: false, hasFoam: false,
          wallThick: 3, cornerR: 14, bubbleType: 'none', bowlShape: true
        }
      default:
        return this.getGlassConfig('beer_mug')
    }
  },

  // ====== Canvas 初始化 ======
  initCanvas() {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery()
      query.select('#glassCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getSystemInfoSync().pixelRatio
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)
          this.canvas = canvas
          this.ctx = ctx
          this.dpr = dpr
          this.canvasW = res[0].width
          this.canvasH = res[0].height
          this.glassConfig = this.getGlassConfig(this.data.drink.glassType)
          this.startAnimation()
        })
    })
  },

  startAnimation() {
    const render = () => {
      this.drawScene()
      this.animFrame = this.canvas.requestAnimationFrame(render)
    }
    render()
  },

  // ====== 主绘制 ======
  drawScene() {
    const ctx = this.ctx
    if (!ctx || !this.glassConfig) return
    ctx.clearRect(0, 0, this.canvasW, this.canvasH)

    this.liquidLevel += (this.targetLiquidLevel - this.liquidLevel) * 0.08
    this.waveOffset += 0.03

    const cfg = this.glassConfig

    // 1. 把手后半段（在杯身后方）
    if (cfg.hasHandle) this.drawHandle(ctx, cfg, true)

    // 2. 液体（clip 在杯身内）
    this.drawLiquid(ctx, cfg)

    // 3. 杯身轮廓
    this.traceBodyPath(ctx, cfg)
    ctx.strokeStyle = 'rgba(190,188,175,0.65)'
    ctx.lineWidth = cfg.wallThick * 0.8
    ctx.lineJoin = 'round'
    ctx.stroke()

    // 4. 杯口椭圆
    ctx.beginPath()
    ctx.ellipse(cfg.cx, cfg.topY, cfg.topW / 2, 7, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(190,188,175,0.5)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 5. 把手前半段
    if (cfg.hasHandle) this.drawHandle(ctx, cfg, false)

    // 6. 杯脚+底座（高脚杯）
    if (cfg.stemH > 0) this.drawStem(ctx, cfg)

    // 7. 厚底（威士忌杯）
    if (cfg.thickBottom) this.drawThickBottom(ctx, cfg)
  },

  // 描绘杯身路径（梯形/V碗/弧形碗）
  traceBodyPath(ctx, cfg) {
    const { cx, topY, bodyH, topW, botW, cornerR } = cfg
    const botY = topY + bodyH
    const tL = cx - topW / 2, tR = cx + topW / 2
    const bL = cx - botW / 2, bR = cx + botW / 2
    const r = cornerR || 0

    ctx.beginPath()
    if (cfg.vShape) {
      // V碗（鸡尾酒杯）
      ctx.moveTo(tL, topY)
      ctx.lineTo(cx, botY)
      ctx.lineTo(tR, topY)
    } else if (cfg.bowlShape) {
      // 弧形碗（红酒杯）
      ctx.moveTo(tL, topY)
      ctx.bezierCurveTo(tL, topY + bodyH * 0.5, cx - botW * 0.8, botY - bodyH * 0.05, cx, botY)
      ctx.bezierCurveTo(cx + botW * 0.8, botY - bodyH * 0.05, tR, topY + bodyH * 0.5, tR, topY)
    } else {
      // 梯形（啤酒/白酒/威士忌/二锅头）
      ctx.moveTo(tL, topY)
      ctx.lineTo(bL, botY - r)
      ctx.quadraticCurveTo(bL, botY, bL + r, botY)
      ctx.lineTo(bR - r, botY)
      ctx.quadraticCurveTo(bR, botY, bR, botY - r)
      ctx.lineTo(tR, topY)
    }
    ctx.closePath()
  },

  // 画液体（clip 到杯身路径内）
  drawLiquid(ctx, cfg) {
    if (this.liquidLevel < 0.02) return
    const { cx, topY, bodyH, topW } = cfg
    const botY = topY + bodyH
    const liquidH = bodyH * this.liquidLevel
    const liquidY = botY - liquidH

    ctx.save()
    this.traceBodyPath(ctx, cfg)
    ctx.clip()

    // 液体填充
    ctx.fillStyle = this.liquidColor
    ctx.fillRect(cx - topW, liquidY, topW * 2, liquidH + 20)

    // 液面波浪
    const waveAmp = 3
    const waveLen = topW / 2.5
    ctx.beginPath()
    ctx.moveTo(cx - topW, liquidY)
    for (let x = 0; x <= topW * 2; x += 2) {
      const y = liquidY + Math.sin((x + this.waveOffset * waveLen) / waveLen * Math.PI * 2) * waveAmp
      ctx.lineTo(cx - topW + x, y)
    }
    ctx.lineTo(cx + topW, liquidY + 30)
    ctx.lineTo(cx - topW, liquidY + 30)
    ctx.closePath()
    ctx.fill()

    // 液面高光
    ctx.beginPath()
    ctx.moveTo(cx - topW, liquidY)
    for (let x = 0; x <= topW * 2; x += 2) {
      const y = liquidY + Math.sin((x + this.waveOffset * waveLen) / waveLen * Math.PI * 2) * waveAmp
      ctx.lineTo(cx - topW + x, y)
    }
    ctx.strokeStyle = this.strokeColor
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.4
    ctx.stroke()
    ctx.globalAlpha = 1

    // 气泡
    this.updateBubbles(cfg)
    for (const b of this.bubbles) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fillStyle = this.foamColor
      ctx.globalAlpha = b.alpha
      ctx.fill()
      ctx.globalAlpha = 1
    }
    ctx.restore()

    // 泡沫（仅低度酒）
    if (cfg.hasFoam && this.liquidLevel > 0.08) {
      this.drawFoam(ctx, cfg, liquidY)
    }
  },

  // 泡沫
  drawFoam(ctx, cfg, liquidY) {
    const { cx, topW } = cfg
    const count = 6
    for (let i = 0; i < count; i++) {
      const fx = cx - topW * 0.35 + (topW * 0.7 / (count - 1)) * i
      const fr = 5 + Math.sin(this.waveOffset + i * 0.8) * 2
      ctx.beginPath()
      ctx.arc(fx, liquidY, fr, 0, Math.PI * 2)
      ctx.fillStyle = this.foamColor
      ctx.globalAlpha = 0.88
      ctx.fill()
      ctx.globalAlpha = 1
    }
    // 泡沫白线
    ctx.beginPath()
    ctx.moveTo(cx - topW * 0.4, liquidY - 2)
    ctx.lineTo(cx + topW * 0.4, liquidY - 2)
    ctx.strokeStyle = this.foamColor
    ctx.globalAlpha = 0.5
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.globalAlpha = 1
  },

  // 把手（啤酒杯）
  drawHandle(ctx, cfg, behind) {
    const { cx, topY, bodyH, topW } = cfg
    const midY = topY + bodyH * 0.5
    const hx = cx + topW / 2
    const r = topW * 0.18
    ctx.beginPath()
    if (behind) {
      ctx.arc(hx + r * 0.3, midY, r, Math.PI * 0.35, Math.PI * 1.0, false)
    } else {
      ctx.arc(hx + r * 0.3, midY, r, 0, Math.PI * 0.35, false)
      ctx.arc(hx + r * 0.3, midY, r, Math.PI * 1.0, Math.PI * 1.35, false)
    }
    ctx.strokeStyle = 'rgba(190,188,175,0.6)'
    ctx.lineWidth = cfg.wallThick * 0.8
    ctx.lineCap = 'round'
    ctx.stroke()
  },

  // 杯脚+底座（高脚杯）
  drawStem(ctx, cfg) {
    const { cx, topY, bodyH, stemH, stemW, baseW, baseH } = cfg
    const stemTop = topY + bodyH
    const stemBot = stemTop + stemH
    ctx.beginPath()
    ctx.moveTo(cx - stemW / 2, stemTop)
    ctx.lineTo(cx - stemW / 2, stemBot)
    ctx.moveTo(cx + stemW / 2, stemTop)
    ctx.lineTo(cx + stemW / 2, stemBot)
    ctx.strokeStyle = 'rgba(190,188,175,0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(cx, stemBot + baseH, baseW / 2, baseH, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(190,188,175,0.5)'
    ctx.lineWidth = 2
    ctx.stroke()
  },

  // 厚底（威士忌杯）
  drawThickBottom(ctx, cfg) {
    const { cx, topY, bodyH, botW } = cfg
    const botY = topY + bodyH
    ctx.beginPath()
    ctx.ellipse(cx, botY - 3, botW / 2, 4, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(190,188,175,0.15)'
    ctx.fill()
  },

  // 气泡更新
  updateBubbles(cfg) {
    const { cx, topY, bodyH, botW, bubbleType } = cfg
    if (bubbleType === 'none' || this.liquidLevel < 0.1) return
    const spawnRate = bubbleType === 'large' ? 0.18 : 0.08
    if (Math.random() < spawnRate) {
      const botY = topY + bodyH
      const liquidH = bodyH * this.liquidLevel
      const liquidY = botY - liquidH
      const w = botW * 0.8
      this.bubbles.push({
        x: cx - w / 2 + Math.random() * w,
        y: botY - 5,
        r: bubbleType === 'large' ? (1.5 + Math.random() * 3) : (1 + Math.random() * 2),
        vy: 0.4 + Math.random() * 1.0,
        alpha: 0.5 + Math.random() * 0.4,
        targetY: liquidY + 5
      })
    }
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]
      b.y -= b.vy
      b.x += Math.sin(b.y * 0.02) * 0.3
      if (b.y < b.targetY) this.bubbles.splice(i, 1)
    }
  },

  // ====== 喝一口 ======
  takeSip() {
    if (this.data.isDrinking || this.data.isChugging || this.data.drunkValue >= 100) return
    this.setData({ isDrinking: true })
    const drink = this.data.drink
    const sipDecrease = 1.0 / drink.sipsPerGlass
    this.targetLiquidLevel = Math.max(0, this.targetLiquidLevel - sipDecrease)
    const drunkInc = (100 / drink.sipsPerGlass) * drink.drunkSpeed * 0.35
    const newDrunk = Math.min(100, this.data.drunkValue + drunkInc)
    const level = getDrunkLevel(newDrunk)
    const quote = getRandomQuote(newDrunk, drink.id)
    this.setData({
      sips: this.data.sips + 1,
      drunkValue: Math.round(newDrunk),
      drunkStatus: level.status,
      drunkLevelColor: level.color,
      drunkEffect: level.effect
    })
    this.showQuote(quote)
    audio.playSfx('drink')
    if (this.targetLiquidLevel <= 0.02) {
      setTimeout(() => this.refillGlass(), 800)
    }
    setTimeout(() => this.setData({ isDrinking: false }), 300)
    wx.vibrateShort({ type: 'light' })
    if (newDrunk >= 100) {
      setTimeout(() => this.onBlackout(), 1500)
    }
  },

  // ====== 长按豪饮 ======
  onDrinkTouchStart() {
    this.touchStartTime = Date.now()
  },
  onDrinkTouchEnd() {},

  chugGlass() {
    if (this.data.isChugging || this.data.drunkValue >= 100) return
    if (this.targetLiquidLevel < 0.05) return

    const drink = this.data.drink
    const wasFull = this.targetLiquidLevel >= 0.9

    this.setData({ isChugging: true, chugFlash: true })
    setTimeout(() => this.setData({ chugFlash: false }), 600)

    const remainingSips = Math.ceil(this.targetLiquidLevel * drink.sipsPerGlass)
    const totalDrunkInc = remainingSips * (100 / drink.sipsPerGlass) * drink.drunkSpeed * 0.35
    const newDrunk = Math.min(100, this.data.drunkValue + totalDrunkInc)
    const level = getDrunkLevel(newDrunk)

    this.targetLiquidLevel = 0
    this.setData({
      sips: this.data.sips + remainingSips,
      drunkValue: Math.round(newDrunk),
      drunkStatus: level.status,
      drunkLevelColor: level.color,
      drunkEffect: level.effect
    })

    // 一口闷成就（满杯豪饮）
    if (wasFull) {
      const stats = app.globalData.stats
      const wasNew = unlockFlag(stats, 'shot_master')
      app.saveStats()
      if (wasNew) audio.playSfx('achievement')
    }

    const quote = getRandomQuote(newDrunk, drink.id)
    this.showQuote('咕咚咕咚咕咚！' + quote)
    audio.playSfx('drink')
    wx.vibrateShort({ type: 'medium' })
    setTimeout(() => wx.vibrateShort({ type: 'medium' }), 200)

    setTimeout(() => {
      this.setData({ isChugging: false })
      this.refillGlass()
    }, 1000)

    if (newDrunk >= 100) {
      setTimeout(() => this.onBlackout(), 1800)
    }
  },

  // ====== 续杯 ======
  refillGlass() {
    this.targetLiquidLevel = 1.0
    this.bubbles = []
    this.setData({ glasses: this.data.glasses + 1 })
    // 混喝检测
    if (!this.sessionDrinkIds.includes(this.data.drink.id)) {
      this.sessionDrinkIds.push(this.data.drink.id)
    }
    if (this.sessionDrinkIds.length >= 3) {
      const stats = app.globalData.stats
      const wasNew = unlockFlag(stats, 'mix_master')
      app.saveStats()
      if (wasNew) audio.playSfx('achievement')
    }
    this.showQuote('满上！')
    audio.playSfx('pour')
  },

  // ====== 骚话气泡 ======
  showQuote(text) {
    this.setData({ currentQuote: text, quoteVisible: false })
    setTimeout(() => this.setData({ quoteVisible: true }), 50)
    setTimeout(() => this.setData({ quoteVisible: false }), 3000)
  },

  // ====== 断片 ======
  onBlackout() {
    wx.showModal({
      title: '已断片',
      content: '你喝太多了，直接断片了...\n要查看今晚战绩吗？',
      showCancel: true,
      cancelText: '再喝',
      confirmText: '看战绩',
      success: (res) => {
        if (res.confirm) this.finishDrinking()
      }
    })
  },

  // ====== 结束本轮 ======
  finishDrinking() {
    const stats = app.globalData.stats
    stats.totalSips += this.data.sips
    stats.totalDrinks += this.data.glasses + (this.targetLiquidLevel < 1.0 ? 1 : 0)
    stats.maxDrunkLevel = Math.max(stats.maxDrunkLevel, Math.round(this.data.drunkValue))
    stats.drinkRecords = stats.drinkRecords || []
    stats.drinkRecords.push({
      drinkId: this.data.drink.id,
      sips: this.data.sips,
      glasses: this.data.glasses,
      drunkLevel: Math.round(this.data.drunkValue),
      time: Date.now()
    })
    const newAch = checkAchievements(stats)
    app.saveStats()
    app.globalData.finishData = {
      drink: this.data.drink,
      sips: this.data.sips,
      glasses: this.data.glasses,
      drunkValue: Math.round(this.data.drunkValue),
      newAchievements: newAch
    }
    wx.redirectTo({ url: '/pages/result/result' })
  },

  // ====== 分享 ======
  onShareAppMessage() {
    const drink = this.data.drink
    return {
      title: '我在赛博喝酒喝了' + this.data.glasses + '杯' + drink.name + '，' + this.data.drunkStatus + '了！',
      path: '/pages/drink/drink?id=' + drink.id
    }
  }
})