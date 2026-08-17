// pages/drink-v7/drink-v7.js - V7 沉浸式酒桌
const app = getApp()
const { DRINKS, STYLE_MODES, getDrunkLevel, getRandomQuote, checkAchievements } = require('../../utils/drinks.js')
const { getV7Profile } = require('../../utils/v7DrinkProfiles.js')
const audio = require('../../utils/audio.js')

Page({
  data: {
    drinks: DRINKS,
    drink: DRINKS[0],
    profile: getV7Profile('beer'),
    activeIndex: 0,
    phase: 'empty', // empty | pouring | ready | drinking
    isPouring: false,
    isDrinking: false,
    streamVisible: false,
    cocktailCrafted: false,
    sips: 0,
    glasses: 0,
    drunkValue: 0,
    drunkStatus: '清醒',
    drunkLevelColor: '#5DCAA5',
    drunkEffect: '',
    currentQuote: '今晚喝点什么？',
    quoteVisible: true,
    themeStyle: ''
  },

  canvas: null,
  ctx: null,
  animFrame: null,
  canvasW: 0,
  canvasH: 0,
  liquidLevel: 0,
  targetLiquidLevel: 0,
  waveOffset: 0,
  bubbles: [],
  glassConfig: null,
  sessionDrinkIds: [],
  drinkBreakdown: {},
  _quoteTimer: null,
  _pourTimer: null,
  _drinkTimer: null,

  onLoad(options) {
    const drinkId = options.id || 'beer'
    const index = Math.max(0, DRINKS.findIndex(d => d.id === drinkId))
    const drink = DRINKS[index]
    const profile = getV7Profile(drink.id)
    const cocktailCrafted = options.crafted === '1'
    this.sessionDrinkIds = [drink.id]
    this.drinkBreakdown[drink.id] = { sips: 0, glasses: 0 }

    this.setData({ drink, profile, activeIndex: index, cocktailCrafted })
    this.applyTheme()
    this.initCanvas()
  },

  onShow() { audio.resumeMusic() },
  onHide() { audio.pauseMusic() },
  onUnload() {
    if (this.animFrame && this.canvas) this.canvas.cancelAnimationFrame(this.animFrame)
    clearTimeout(this._quoteTimer)
    clearTimeout(this._pourTimer)
    clearTimeout(this._drinkTimer)
    audio.pauseMusic()
  },

  applyTheme() {
    const styleId = app.globalData.styleMode || 'heroic'
    const mode = STYLE_MODES[styleId]
    if (!mode) return
    const t = mode.theme
    this.setData({
      themeStyle: [
        `--accent:${t.accent}`,
        `--accent-light:${t.accentLight}`,
        `--text-main:${t.text}`,
        `--text-sub:${t.textSub}`,
        `--text-muted:${t.textMuted}`,
        `--glow:${t.glow}`
      ].join(';')
    })
    wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: t.navBar })
  },

  initCanvas() {
    wx.nextTick(() => {
      wx.createSelectorQuery().select('#v7GlassCanvas').fields({ node: true, size: true }).exec(res => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getSystemInfoSync().pixelRatio
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        ctx.scale(dpr, dpr)
        this.canvas = canvas
        this.ctx = ctx
        this.canvasW = res[0].width
        this.canvasH = res[0].height
        this.glassConfig = this.getGlassConfig(this.data.drink.glassType)
        this.startAnimation()
        setTimeout(() => this.startPour(), 280)
      })
    })
  },

  getGlassConfig(type) {
    const w = this.canvasW, h = this.canvasH, cx = w / 2
    const base = { cx, topY: h * .16, bodyH: h * .58, topW: w * .42, botW: w * .34, stemH: 0, stemW: 0, baseW: 0, foam: false }
    if (type === 'beer_mug') return { ...base, topY: h * .08, bodyH: h * .70, topW: w * .48, botW: w * .42, handle: true, foam: true }
    if (type === 'shot_glass') return { ...base, topY: h * .36, bodyH: h * .34, topW: w * .28, botW: w * .22 }
    if (type === 'rocks_glass') return { ...base, topY: h * .30, bodyH: h * .40, topW: w * .46, botW: w * .43, thickBottom: true }
    if (type === 'cocktail_glass') return { ...base, topY: h * .10, bodyH: h * .38, topW: w * .52, botW: w * .04, stemH: h * .29, stemW: 4, baseW: w * .22, vShape: true }
    if (type === 'erguotou_glass') return { ...base, topY: h * .38, bodyH: h * .30, topW: w * .25, botW: w * .18 }
    if (type === 'wine_glass') return { ...base, topY: h * .08, bodyH: h * .46, topW: w * .39, botW: w * .05, stemH: h * .28, stemW: 4, baseW: w * .23, bowl: true }
    return base
  },

  startAnimation() {
    const frame = () => {
      this.drawScene()
      this.animFrame = this.canvas.requestAnimationFrame(frame)
    }
    frame()
  },

  drawScene() {
    const ctx = this.ctx, cfg = this.glassConfig
    if (!ctx || !cfg) return
    ctx.clearRect(0, 0, this.canvasW, this.canvasH)
    this.waveOffset += this.data.isPouring ? .12 : .035
    const ease = this.data.isPouring ? .055 : .12
    this.liquidLevel += (this.targetLiquidLevel - this.liquidLevel) * ease

    if (cfg.handle) this.drawHandle(ctx, cfg)
    this.drawLiquid(ctx, cfg)
    this.traceGlass(ctx, cfg)
    ctx.strokeStyle = 'rgba(225,235,242,.72)'
    ctx.lineWidth = 2.6
    ctx.lineJoin = 'round'
    ctx.stroke()
    this.drawRim(ctx, cfg)
    if (cfg.stemH) this.drawStem(ctx, cfg)
    if (cfg.thickBottom) this.drawThickBottom(ctx, cfg)
  },

  traceGlass(ctx, cfg) {
    const { cx, topY, bodyH, topW, botW } = cfg
    const bottom = topY + bodyH
    ctx.beginPath()
    if (cfg.vShape) {
      ctx.moveTo(cx - topW / 2, topY)
      ctx.lineTo(cx, bottom)
      ctx.lineTo(cx + topW / 2, topY)
    } else if (cfg.bowl) {
      ctx.moveTo(cx - topW / 2, topY)
      ctx.bezierCurveTo(cx - topW * .48, topY + bodyH * .58, cx - botW, bottom - 8, cx, bottom)
      ctx.bezierCurveTo(cx + botW, bottom - 8, cx + topW * .48, topY + bodyH * .58, cx + topW / 2, topY)
    } else {
      ctx.moveTo(cx - topW / 2, topY)
      ctx.lineTo(cx - botW / 2, bottom)
      ctx.lineTo(cx + botW / 2, bottom)
      ctx.lineTo(cx + topW / 2, topY)
    }
    ctx.closePath()
  },

  drawLiquid(ctx, cfg) {
    if (this.liquidLevel < .01) return
    const { cx, topY, bodyH, topW } = cfg
    const bottom = topY + bodyH
    const y = bottom - bodyH * this.liquidLevel
    ctx.save()
    this.traceGlass(ctx, cfg)
    ctx.clip()
    const grad = ctx.createLinearGradient(0, y, 0, bottom)
    grad.addColorStop(0, this.data.drink.liquidColor)
    grad.addColorStop(1, this.data.drink.strokeColor)
    ctx.globalAlpha = .86
    ctx.fillStyle = grad
    ctx.fillRect(cx - topW, y, topW * 2, bottom - y + 20)
    ctx.globalAlpha = 1

    const amp = this.data.isPouring ? 5 : 2.4
    ctx.beginPath()
    for (let x = cx - topW; x <= cx + topW; x += 3) {
      const yy = y + Math.sin(x * .075 + this.waveOffset) * amp
      if (x === cx - topW) ctx.moveTo(x, yy)
      else ctx.lineTo(x, yy)
    }
    ctx.strokeStyle = 'rgba(255,255,255,.36)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.restore()

    if (cfg.foam && this.liquidLevel > .08) this.drawFoam(ctx, cfg, y)
  },

  drawFoam(ctx, cfg, y) {
    for (let i = 0; i < 9; i++) {
      const x = cfg.cx - cfg.topW * .34 + i * cfg.topW * .085
      const r = 4 + Math.sin(this.waveOffset + i) * 1.4
      ctx.beginPath()
      ctx.arc(x, y - 2 + Math.sin(i) * 2, r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(253,244,218,.86)'
      ctx.fill()
    }
  },

  drawRim(ctx, cfg) {
    ctx.beginPath()
    ctx.ellipse(cfg.cx, cfg.topY, cfg.topW / 2, 7, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(235,242,246,.62)'
    ctx.lineWidth = 1.4
    ctx.stroke()
  },

  drawStem(ctx, cfg) {
    const y = cfg.topY + cfg.bodyH
    ctx.beginPath()
    ctx.moveTo(cfg.cx, y)
    ctx.lineTo(cfg.cx, y + cfg.stemH)
    ctx.strokeStyle = 'rgba(225,235,242,.7)'
    ctx.lineWidth = cfg.stemW
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(cfg.cx, y + cfg.stemH + 4, cfg.baseW / 2, 5, 0, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(225,235,242,.65)'
    ctx.lineWidth = 2
    ctx.stroke()
  },

  drawHandle(ctx, cfg) {
    ctx.beginPath()
    ctx.ellipse(cfg.cx + cfg.topW * .55, cfg.topY + cfg.bodyH * .48, cfg.topW * .19, cfg.bodyH * .22, 0, -.9, .9)
    ctx.strokeStyle = 'rgba(225,235,242,.65)'
    ctx.lineWidth = 4
    ctx.stroke()
  },

  drawThickBottom(ctx, cfg) {
    const y = cfg.topY + cfg.bodyH - 5
    ctx.beginPath()
    ctx.ellipse(cfg.cx, y, cfg.botW * .47, 7, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(230,240,246,.14)'
    ctx.fill()
  },

  switchDrink(e) {
    if (this.data.isPouring || this.data.isDrinking) return
    const index = Number(e.currentTarget.dataset.index)
    const drink = DRINKS[index]
    if (!drink || drink.id === this.data.drink.id) return
    const profile = getV7Profile(drink.id)
    if (!this.sessionDrinkIds.includes(drink.id)) this.sessionDrinkIds.push(drink.id)
    if (!this.drinkBreakdown[drink.id]) this.drinkBreakdown[drink.id] = { sips: 0, glasses: 0 }

    this.liquidLevel = 0
    this.targetLiquidLevel = 0
    this.bubbles = []
    this.setData({ drink, profile, activeIndex: index, phase: 'empty', currentQuote: profile.serving })
    this.glassConfig = this.getGlassConfig(drink.glassType)
    app.globalData.currentDrink = drink
    audio.playSfx('click')
    setTimeout(() => (profile.requiresBartending && !this.data.cocktailCrafted) ? this.showQuote('这杯建议现调，去调酒台？') : this.startPour(), 220)
  },

  startPour() {
    if (this.data.isPouring || this.data.isDrinking) return
    const profile = this.data.profile
    if (profile.requiresBartending && !this.data.cocktailCrafted) {
      wx.showModal({
        title: '现调更有味道',
        content: '鸡尾酒不从瓶里直接倒。去赛博调酒台按真实步骤现做一杯？',
        confirmText: '去调酒',
        cancelText: '先不去',
        success: res => { if (res.confirm) this.goBartend() }
      })
      return
    }
    this.liquidLevel = 0
    this.targetLiquidLevel = 0
    this.setData({ phase: 'pouring', isPouring: true, streamVisible: true })
    audio.playSfx('pour')
    wx.vibrateShort({ type: 'light' })
    setTimeout(() => { this.targetLiquidLevel = profile.pour.fillRatio }, 180)
    clearTimeout(this._pourTimer)
    this._pourTimer = setTimeout(() => {
      this.targetLiquidLevel = profile.pour.fillRatio
      this.setData({ phase: 'ready', isPouring: false, streamVisible: false })
      this.showQuote(profile.serving)
    }, profile.pour.duration)
  },

  takeSip() {
    if (this.data.phase !== 'ready' || this.data.drunkValue >= 100) return
    const drink = this.data.drink
    const profile = this.data.profile
    this.setData({ phase: 'drinking', isDrinking: true })
    audio.playSfx('drink')
    wx.vibrateShort({ type: 'light' })

    clearTimeout(this._drinkTimer)
    this._drinkTimer = setTimeout(() => {
      const sipDecrease = profile.pour.fillRatio / drink.sipsPerGlass
      this.targetLiquidLevel = Math.max(0, this.targetLiquidLevel - sipDecrease)
      const drunkInc = (100 / drink.sipsPerGlass) * drink.drunkSpeed * .35
      const newDrunk = Math.min(100, this.data.drunkValue + drunkInc)
      const level = getDrunkLevel(newDrunk)
      const record = this.drinkBreakdown[drink.id]
      record.sips += 1

      const empty = this.targetLiquidLevel <= .035
      if (empty) {
        record.glasses += 1
        this.targetLiquidLevel = 0
      }

      this.setData({
        sips: this.data.sips + 1,
        glasses: this.data.glasses + (empty ? 1 : 0),
        drunkValue: Math.round(newDrunk),
        drunkStatus: level.status,
        drunkLevelColor: level.color,
        drunkEffect: level.effect,
        phase: empty ? 'empty' : 'ready',
        isDrinking: false
      })

      this.showQuote(Math.random() > .52 ? profile.motion.finish : getRandomQuote(newDrunk, drink.id))
      if (newDrunk >= 100) setTimeout(() => this.onBlackout(), 850)
    }, Math.max(460, profile.motion.duration * .68))
  },

  goBartend() {
    app.globalData.currentDrink = this.data.drink
    wx.navigateTo({ url: '/pages/bartend/bartend' })
  },

  showQuote(text) {
    clearTimeout(this._quoteTimer)
    this.setData({ currentQuote: text, quoteVisible: true })
    this._quoteTimer = setTimeout(() => this.setData({ quoteVisible: false }), 2800)
  },

  onBlackout() {
    wx.showModal({
      title: '今晚到这儿',
      content: '醉酒度已经拉满。去看看这场赛博酒局的战绩？',
      confirmText: '看战绩',
      cancelText: '我还能喝',
      success: res => { if (res.confirm) this.finishDrinking() }
    })
  },

  finishDrinking() {
    const stats = app.globalData.stats
    stats.totalSips += this.data.sips
    stats.totalDrinks += this.data.glasses
    stats.maxDrunkLevel = Math.max(stats.maxDrunkLevel, this.data.drunkValue)
    stats.drinkRecords = stats.drinkRecords || []
    Object.keys(this.drinkBreakdown).forEach(id => {
      const r = this.drinkBreakdown[id]
      if (!r.sips && !r.glasses) return
      stats.drinkRecords.push({ drinkId: id, sips: r.sips, glasses: r.glasses, drunkLevel: this.data.drunkValue, time: Date.now() })
    })
    const newAchievements = checkAchievements(stats)
    app.saveStats()
    app.globalData.finishData = {
      drink: this.data.drink,
      sips: this.data.sips,
      glasses: this.data.glasses,
      drunkValue: this.data.drunkValue,
      drinkBreakdown: this.drinkBreakdown,
      newAchievements
    }
    wx.redirectTo({ url: '/pages/result/result' })
  },

  onShareAppMessage() {
    return {
      title: `我在赛博酒桌喝到${this.data.drunkStatus}，敢来碰一杯吗？`,
      path: `/pages/drink-v7/drink-v7?id=${this.data.drink.id}`
    }
  }
})
