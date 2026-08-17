// app.js
const audio = require('./utils/audio.js')

App({
  onLaunch() {
    // 从本地缓存恢复统计数据
    const stats = wx.getStorageSync('drinkStats') || {
      totalDrinks: 0,
      totalSips: 0,
      maxDrunkLevel: 0,
      unlockedAchievements: [],
      drinkRecords: []
    }
    this.globalData.stats = stats
    // 恢复上次选的风格
    this.globalData.styleMode = wx.getStorageSync('styleMode') || ''
    // 初始化音频设置
    audio.init()
  },

  saveStats() {
    wx.setStorageSync('drinkStats', this.globalData.stats)
  },

  globalData: {
    stats: null,
    currentDrink: null,
    styleMode: ''
  }
})
