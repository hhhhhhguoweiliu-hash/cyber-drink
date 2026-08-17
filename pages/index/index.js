// pages/index/index.js - 选酒页面逻辑（含风格选择）
const app = getApp()
const { DRINKS, STYLE_MODES, getRandomQuote } = require('../../utils/drinks.js')
const audio = require('../../utils/audio.js')

Page({
  data: {
    drinks: DRINKS,
    selectedDrink: -1,
    styleSelected: false,
    styleMode: null,
    styleEnterQuote: '',
    themeStyle: '',
    musicOn: true,
    sfxOn: true,
    stats: {
      totalDrinks: 0,
      totalSips: 0,
      maxDrunkLevel: 0,
      unlockedAchievements: []
    }
  },

  onLoad() {
    this.setData({ musicOn: audio.getMusicEnabled(), sfxOn: audio.getSfxEnabled() })
    if (app.globalData.styleMode) this.applyStyle(app.globalData.styleMode)
  },

  onShow() {
    const stats = app.globalData.stats || this.data.stats
    this.setData({ stats })
    if (app.globalData.styleMode && !this.data.styleSelected) this.applyStyle(app.globalData.styleMode)
    else if (this.data.styleSelected) audio.resumeMusic()
  },

  onHide() { audio.pauseMusic() },

  selectStyle(e) { this.applyStyle(e.currentTarget.dataset.style) },

  applyStyle(styleId) {
    const mode = STYLE_MODES[styleId]
    if (!mode) return
    app.globalData.styleMode = styleId
    wx.setStorageSync('styleMode', styleId)
    const enterQuotes = mode.quotes.enter
    const quote = enterQuotes[Math.floor(Math.random() * enterQuotes.length)]
    const t = mode.theme
    const themeStyle = [
      `--bg-gradient: ${t.bgGradient}`,
      `--bg-card: ${t.bgCard}`,
      `--bg-card-active: ${t.bgCardActive}`,
      `--border-active: ${t.borderActive}`,
      `--accent: ${t.accent}`,
      `--accent-light: ${t.accentLight}`,
      `--text-main: ${t.text}`,
      `--text-sub: ${t.textSub}`,
      `--text-muted: ${t.textMuted}`,
      `--glow: ${t.glow}`
    ].join('; ')
    this.setData({ styleSelected: true, styleMode: mode, styleEnterQuote: quote, themeStyle })
    wx.setNavigationBarColor({ frontColor: '#ffffff', backgroundColor: t.navBar, animation: { duration: 300 } })
    audio.playMusic(styleId)
    audio.playSfx('click')
  },

  changeStyle() { audio.playSfx('click'); this.setData({ styleSelected: false }) },
  toggleMusic() { this.setData({ musicOn: audio.toggleMusic() }) },
  toggleSfx() { const on = audio.toggleSfx(); this.setData({ sfxOn: on }); if (on) audio.playSfx('click') },

  selectDrink(e) {
    audio.playSfx('click')
    const index = e.currentTarget.dataset.index
    this.setData({ selectedDrink: this.data.selectedDrink === index ? -1 : index })
  },

  // V7 默认进入真实 WebGL 3D 酒桌；V6/V7-2D 页面仍保留作回退。
  startDrinking() {
    if (this.data.selectedDrink === -1) return
    const drink = this.data.drinks[this.data.selectedDrink]
    app.globalData.currentDrink = drink
    audio.playSfx('click')
    wx.navigateTo({ url: `/pages/drink-3d/drink-3d?id=${drink.id}` })
  },

  goBartend() {
    if (this.data.selectedDrink < 0) return
    const drink = this.data.drinks[this.data.selectedDrink]
    if (drink.id !== 'cocktail') return
    app.globalData.currentDrink = drink
    audio.playSfx('click')
    wx.navigateTo({ url: '/pages/bartend-3d/bartend-3d' })
  },

  goFaceDrink() { audio.playSfx('click'); wx.navigateTo({ url: '/pages/face-drink/face-drink' }) },

  onShareAppMessage() {
    const styleName = this.data.styleMode ? this.data.styleMode.sub : '豪迈风'
    return { title: `赛博喝酒 - ${styleName}上线，来喝一杯！`, path: '/pages/index/index' }
  },

  goAchievements() {
    const { ACHIEVEMENTS } = require('../../utils/drinks.js')
    const unlocked = new Set(this.data.stats.unlockedAchievements || [])
    const list = ACHIEVEMENTS.map(a => ({ name: a.name, desc: a.desc, unlocked: unlocked.has(a.id) }))
    const unlockedText = list.filter(l => l.unlocked).map(l => `${l.name}：${l.desc}`).join('\n')
    const lockedText = list.filter(l => !l.unlocked).map(l => `${l.name}：${l.desc}`).join('\n')
    wx.showModal({ title: '成就列表', content: `已解锁：\n${unlockedText || '无'}\n\n未解锁：\n${lockedText}`, showCancel: false, confirmText: '知道了' })
  }
})
