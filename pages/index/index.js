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
    // 恢复音频开关状态
    this.setData({
      musicOn: audio.getMusicEnabled(),
      sfxOn: audio.getSfxEnabled()
    })
    // 如果之前选过风格，从全局恢复
    if (app.globalData.styleMode) {
      this.applyStyle(app.globalData.styleMode)
    }
  },

  onShow() {
    const stats = app.globalData.stats || this.data.stats
    this.setData({ stats })

    // 如果之前选过风格，恢复
    if (app.globalData.styleMode && !this.data.styleSelected) {
      this.applyStyle(app.globalData.styleMode)
    } else if (this.data.styleSelected) {
      // 已选风格，恢复音乐
      audio.resumeMusic()
    }
  },

  onHide() {
    audio.pauseMusic()
  },

  // 选择风格
  selectStyle(e) {
    const styleId = e.currentTarget.dataset.style
    this.applyStyle(styleId)
  },

  // 应用风格
  applyStyle(styleId) {
    const mode = STYLE_MODES[styleId]
    if (!mode) return

    app.globalData.styleMode = styleId
    wx.setStorageSync('styleMode', styleId)

    // 随机选一条入场文案
    const enterQuotes = mode.quotes.enter
    const quote = enterQuotes[Math.floor(Math.random() * enterQuotes.length)]

    // 构建 CSS 变量
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

    this.setData({
      styleSelected: true,
      styleMode: mode,
      styleEnterQuote: quote,
      themeStyle: themeStyle
    })

    // 设置导航栏颜色
    wx.setNavigationBarColor({
      frontColor: '#ffffff',
      backgroundColor: t.navBar,
      animation: { duration: 300 }
    })

    // 播放对应风格背景音乐
    audio.playMusic(styleId)
    audio.playSfx('click')
  },

  // 切换风格
  changeStyle() {
    audio.playSfx('click')
    this.setData({ styleSelected: false })
  },

  // 切换音乐开关
  toggleMusic() {
    const on = audio.toggleMusic()
    this.setData({ musicOn: on })
  },

  // 切换音效开关
  toggleSfx() {
    const on = audio.toggleSfx()
    this.setData({ sfxOn: on })
    if (on) audio.playSfx('click')
  },

  // 选择酒
  selectDrink(e) {
    audio.playSfx('click')
    const index = e.currentTarget.dataset.index
    this.setData({
      selectedDrink: this.data.selectedDrink === index ? -1 : index
    })
  },

  // 开始喝酒（V7 沉浸式酒桌；旧 drink 页保留作回退）
  startDrinking() {
    if (this.data.selectedDrink === -1) return

    const drink = this.data.drinks[this.data.selectedDrink]
    app.globalData.currentDrink = drink
    audio.playSfx('click')

    wx.navigateTo({
      url: `/pages/drink-v7/drink-v7?id=${drink.id}`
    })
  },

  // 去调酒台
  goBartend() {
    if (this.data.selectedDrink < 0) return
    const drink = this.data.drinks[this.data.selectedDrink]
    if (drink.id !== 'cocktail') return

    app.globalData.currentDrink = drink
    audio.playSfx('click')
    wx.navigateTo({
      url: '/pages/bartend/bartend'
    })
  },

  // 去面基喝酒
  goFaceDrink() {
    audio.playSfx('click')
    wx.navigateTo({
      url: '/pages/face-drink/face-drink'
    })
  },

  // 分享
  onShareAppMessage() {
    const styleName = this.data.styleMode ? this.data.styleMode.sub : '豪迈风'
    return {
      title: `赛博喝酒 - ${styleName}上线，来喝一杯！`,
      path: '/pages/index/index'
    }
  },

  // 查看成就
  goAchievements() {
    const { ACHIEVEMENTS } = require('../../utils/drinks.js')
    const unlocked = new Set(this.data.stats.unlockedAchievements || [])
    const list = ACHIEVEMENTS.map(a => ({
      name: a.name,
      desc: a.desc,
      unlocked: unlocked.has(a.id)
    }))

    const unlockedText = list.filter(l => l.unlocked).map(l => `${l.name}：${l.desc}`).join('\n')
    const lockedText = list.filter(l => !l.unlocked).map(l => `${l.name}：${l.desc}`).join('\n')

    wx.showModal({
      title: '成就列表',
      content: `已解锁：\n${unlockedText || '无'}\n\n未解锁：\n${lockedText}`,
      showCancel: false,
      confirmText: '知道了'
    })
  }
})
