// pages/bartend/bartend.js - 调酒交互逻辑
const app = getApp()
const { BARTENDING_STEPS, BASE_LIQUORS, MIXERS } = require('../../utils/drinks.js')
const audio = require('../../utils/audio.js')

Page({
  data: {
    steps: BARTENDING_STEPS,
    baseLiquors: BASE_LIQUORS,
    mixers: MIXERS,
    currentStep: 0,
    selectedBase: -1,
    selectedMixer: -1,
    hasIce: false,
    shakeCount: 0,
    shaking: false,
    poured: false,
    garnished: false,
    finished: false,
    liquidLevel: 0,
    liquidColor: 'rgba(220, 220, 230, 0.3)',
    cocktailName: '特调鸡尾酒',
    cocktailDesc: '你自己调的酒，味道怎样只有喝了才知道'
  },

  // 选基酒
  selectBase(e) {
    const index = e.currentTarget.dataset.index
    const liquor = BASE_LIQUORS[index]
    this.setData({
      selectedBase: index,
      liquidLevel: 30,
      liquidColor: liquor.color
    })
    wx.vibrateShort({ type: 'light' })
    audio.playSfx('pour')
  },

  // 加冰
  addIce() {
    if (!this.data.hasIce) {
      this.setData({ hasIce: true })
      wx.vibrateShort({ type: 'light' })
      audio.playSfx('click')
    }
  },

  // 选辅料
  selectMixer(e) {
    const index = e.currentTarget.dataset.index
    const mixer = MIXERS[index]
    // 混合颜色
    const baseColor = this.data.liquidColor
    const mixedColor = this.mixColors(baseColor, mixer.color)
    this.setData({
      selectedMixer: index,
      liquidLevel: 60,
      liquidColor: mixedColor
    })
    wx.vibrateShort({ type: 'light' })
    audio.playSfx('pour')
  },

  // 简单颜色混合（近似）
  mixColors(c1, c2) {
    // 如果 c2 是具体颜色，直接偏移向它
    if (c2.startsWith('#')) {
      // 提取 mixer 颜色做近似
      return c2.replace(')', ', 0.6)').replace('rgb', 'rgba')
    }
    return c2
  },

  // 点击兜底（模拟器里用）
  onShakeTap() {
    if (this.data.shakeCount >= 5) return
    const newCount = Math.min(this.data.shakeCount + 1, 5)
    this.setData({ shakeCount: newCount, shaking: true })
    wx.vibrateShort({ type: 'light' })
    audio.playSfx('shake')
    if (this._shakeTimer) clearTimeout(this._shakeTimer)
    this._shakeTimer = setTimeout(() => { this.setData({ shaking: false }) }, 500)
    if (newCount >= 5) this.stopShakeDetection()
  },

  // 启动加速度计检测真实摇晃
  startShakeDetection() {
    this._lastMag = 0
    this._shakeDebounce = false
    wx.startAccelerometer({ interval: 'game' })
    this._accListener = (res) => {
      // 计算加速度总幅度
      const mag = Math.sqrt(res.x * res.x + res.y * res.y + res.z * res.z)
      // 超过阈值 + 防抖
      if (mag > 1.8 && !this._shakeDebounce && this.data.shakeCount < 5) {
        this._shakeDebounce = true
        const newCount = Math.min(this.data.shakeCount + 1, 5)
        this.setData({ shakeCount: newCount, shaking: true })
        wx.vibrateShort({ type: 'medium' })
        audio.playSfx('shake')
        if (this._shakeTimer) clearTimeout(this._shakeTimer)
        this._shakeTimer = setTimeout(() => { this.setData({ shaking: false }) }, 500)
        if (newCount >= 5) this.stopShakeDetection()
        // 300ms 防抖，避免一次摇晃算多次
        setTimeout(() => { this._shakeDebounce = false }, 300)
      }
      this._lastMag = mag
    }
    wx.onAccelerometerChange(this._accListener)
  },

  // 停止加速度计
  stopShakeDetection() {
    if (this._accListener) {
      wx.stopAccelerometer()
      wx.offAccelerometerChange(this._accListener)
      this._accListener = null
    }
  },

  // 出酒
  pourOut() {
    if (!this.data.poured) {
      this.setData({
        poured: true,
        pouring: true,
        liquidLevel: 80
      })
      wx.vibrateShort({ type: 'medium' })
      audio.playSfx('pour')
      setTimeout(() => {
        this.setData({ pouring: false })
      }, 1000)
    }
  },

  // 加装饰
  addGarnish() {
    if (!this.data.garnished) {
      this.setData({ garnished: true })
      wx.vibrateShort({ type: 'light' })
      audio.playSfx('click')
    }
  },

  // 确认当前步骤
  confirmStep() {
    const next = this.data.currentStep + 1
    if (next < this.data.steps.length) {
      this.setData({ currentStep: next })
      audio.playSfx('click')
      // 进入摇匀步骤，启动加速度计
      if (next === 3) {
        this.startShakeDetection()
      }
      // 离开摇匀步骤，停止加速度计
      if (this.data.currentStep === 3 && next !== 3) {
        this.stopShakeDetection()
      }
    }
  },

  // 页面隐藏/卸载时清理
  onHide() {
    this.stopShakeDetection()
    audio.pauseMusic()
  },

  onShow() {
    audio.resumeMusic()
  },

  onUnload() {
    this.stopShakeDetection()
    if (this._shakeTimer) clearTimeout(this._shakeTimer)
    audio.pauseMusic()
  },

  // 完成调酒
  finishBartending() {
    // 根据基酒+辅料生成鸡尾酒名
    const base = BASE_LIQUORS[this.data.selectedBase]
    const mixer = MIXERS[this.data.selectedMixer]
    const names = [
      `${base.name}${mixer.name}特调`,
      '午夜迷情',
      '月光曲',
      '微醺夏夜'
    ]
    const name = names[Math.floor(Math.random() * names.length)]

    this.setData({
      finished: true,
      cocktailName: name,
      cocktailDesc: `${base.name}配${mixer.name}，你自己调的酒，味道怎样只有喝了才知道`
    })
    wx.vibrateShort({ type: 'heavy' })
    audio.playSfx('achievement')
  },

  // 去喝酒
  goDrink() {
    const drink = app.globalData.currentDrink
    if (drink) {
      wx.redirectTo({
        url: `/pages/drink/drink?id=${drink.id}`
      })
    }
  },

  onShareAppMessage() {
    return {
      title: `我调了一杯${this.data.cocktailName}！来赛博调酒台试试`,
      path: '/pages/index/index'
    }
  }
})
