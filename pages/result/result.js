// pages/result/result.js - 结算页面逻辑
const app = getApp()
const { getDrunkLevel, STYLE_MODES } = require('../../utils/drinks.js')
const audio = require('../../utils/audio.js')

Page({
  data: {
    drink: null,
    sips: 0,
    glasses: 0,
    drunkValue: 0,
    resultEmoji: '🥴',
    resultTitle: '',
    resultSubtitle: '',
    verdictText: '',
    newAchievements: [],
    totalStats: {},
    themeStyle: ''
  },

  onLoad() {
    const data = app.globalData.finishData
    if (!data) {
      wx.redirectTo({ url: '/pages/index/index' })
      return
    }

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

    const level = getDrunkLevel(data.drunkValue)

    // 根据醉酒度生成结果文案
    const resultMap = {
      '清醒': { emoji: '😎', title: '清醒退场', subtitle: '你就喝了寂寞？', verdict: '这酒量...要不改喝茶吧' },
      '微醺': { emoji: '😌', title: '微醺收工', subtitle: '恰到好处的状态', verdict: '懂得适可而止，是个有品位的人' },
      '上头了': { emoji: '🤪', title: '上头了！', subtitle: '话开始多了是吧', verdict: '再喝下去要出事了，还好停了' },
      '醉了': { emoji: '🥴', title: '喝醉了', subtitle: '我没醉！真的没醉！', verdict: '嘴上说着没醉，身体很诚实' },
      '断片边缘': { emoji: '😵', title: '断片边缘', subtitle: '差一点就...记得住', verdict: '你在悬崖边勒马了，运气不错' },
      '已断片': { emoji: '💀', title: '已断片', subtitle: '次日醒来：昨晚干了啥？', verdict: '断片选手，你的手机会替你记住一切' }
    }

    const result = resultMap[level.status] || resultMap['醉了']

    this.setData({
      drink: data.drink,
      sips: data.sips,
      glasses: data.glasses,
      drunkValue: data.drunkValue,
      resultEmoji: result.emoji,
      resultTitle: result.title,
      resultSubtitle: result.subtitle,
      verdictText: result.verdict,
      newAchievements: data.newAchievements || [],
      totalStats: app.globalData.stats
    })

    // 有新成就播放成就音效，否则播放点击音效
    if (data.newAchievements && data.newAchievements.length > 0) {
      audio.playSfx('achievement')
    } else {
      audio.playSfx('click')
    }
  },

  onShow() {
    audio.resumeMusic()
  },

  onHide() {
    audio.pauseMusic()
  },

  // 再来一轮
  drinkAgain() {
    audio.playSfx('click')
    wx.redirectTo({ url: '/pages/index/index' })
  },

  // 回首页
  goHome() {
    audio.playSfx('click')
    wx.redirectTo({ url: '/pages/index/index' })
  },

  // 分享
  onShareAppMessage() {
    const drunkStatus = getDrunkLevel(this.data.drunkValue).status
    return {
      title: `我赛博喝了${this.data.sips}口${this.data.drink.name}，${drunkStatus}！你敢来挑战吗？`,
      path: '/pages/index/index',
      imageUrl: ''
    }
  }
})
