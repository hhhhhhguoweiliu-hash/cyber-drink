// pages/face-drink/face-drink.js - 面基喝酒逻辑
const app = getApp()
const { DRINKS, DRUNK_LEVELS, getRandomQuote, getDrunkLevel } = require('../../utils/drinks.js')
const audio = require('../../utils/audio.js')
const { FaceFX, detectLandmarks, defaultLandmarks } = require('../../utils/facefx.js')

// 窘态文案池 - 按醉酒等级 [清醒, 微醺, 上头了, 醉了, 断片边缘, 已断片]
const REACTIONS = [
  [], // 0 清醒 - 无窘态
  ['脸微微泛红', '眼神开始迷离', '嘴角不自觉上扬', '说话声音大了点', '开始傻笑'],
  ['开始说大话', '舌头打结了', '面红耳赤', '开始拍桌子', '声称自己没醉', '眼神对不上焦'],
  ['开始脱外套', '抱着瓶子不撒手', '要给前任发消息', '开始讲人生故事', '眼泪在眼眶打转', '声称自己还能喝'],
  ['开始唱歌', '要跟所有人拜把子', '趴在桌上了', '说胡话了', '试图站起来但没成功', '开始打电话'],
  ['彻底断片', '人事不省', '已无响应', '呼叫转移中']
]

// 窘态 emoji - 按等级
const DRUNK_EMOJIS = ['', '😊', '🥴', '😵', '🤢', '😴']

// 喝酒人声 - 按等级（越醉越埋汰）
const VOICE_BY_LEVEL = [
  ['voice_smack'],                       // 清醒：咂嘴品酒
  ['voice_smack', 'voice_ha'],           // 微醺：咂嘴/哈气
  ['voice_ha', 'voice_smack'],           // 上头：满足哈气
  ['voice_ha', 'voice_burp'],            // 醉了：开始打嗝
  ['voice_burp', 'voice_hiccup'],        // 断片边缘：打嗝/酒嗝
  ['voice_hiccup', 'voice_burp']         // 断片：酒嗝不停
]

// 脸部搞怪动画 - 按等级
const FACE_EFFECTS = [
  [],                                    // 清醒：不整活
  ['laugh'],                             // 微醺：傻笑
  ['laugh', 'wink'],                     // 上头：大笑/挤眉弄眼
  ['glare', 'laugh', 'wink'],            // 醉了：急眼瞪人
  ['daddy', 'glare', 'wink'],            // 断片边缘：开始叫爸爸
  ['daddy', 'wink']                      // 断片：叫爸爸名场面
]

// 叫爸爸气泡文案
const DADDY_TEXTS = ['爸爸！', '爸爸我错了！', '义父在上！', '爹！再满上！']

// 随机取一条
function pickRandom(arr) {
  if (!arr || !arr.length) return ''
  return arr[Math.floor(Math.random() * arr.length)]
}

Page({
  data: {
    drinks: DRINKS,
    selectedDrinkId: null,
    meAvatar: '',
    friendAvatar: '',
    started: false,
    gameOver: false,
    winner: '',
    resultEmoji: '🏆',
    round: 0,
    cheering: false,
    // 隐私提示
    showPrivacyTip: true,
    // 我方状态
    meDrunk: 0,
    meLevelIndex: 0,
    meGlassLevel: 100,
    meStatus: '清醒',
    meLevelColor: '#5DCAA5',
    meQuote: '',
    meReaction: '',
    meEmoji: '',
    meAnimClass: '',
    meDaddy: '',
    // 朋友状态
    friendDrunk: 0,
    friendLevelIndex: 0,
    friendGlassLevel: 100,
    friendStatus: '清醒',
    friendLevelColor: '#5DCAA5',
    friendQuote: '',
    friendReaction: '',
    friendEmoji: '',
    friendAnimClass: '',
    friendDaddy: '',
    // 屏幕特效
    screenShake: false,
    blackoutOverlay: false,
    _currentDrink: null
  },

  // 脸部动画实例与关键点（不进 data，避免 setData 开销）
  _meFX: null,
  _friendFX: null,
  _meLandmarks: null,
  _friendLandmarks: null,

  // 关闭隐私提示
  dismissPrivacyTip() {
    this.setData({ showPrivacyTip: false })
  },

  // 选酒
  pickDrink(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ selectedDrinkId: id })
    wx.vibrateShort({ type: 'light' })
    audio.playSfx('click')
  },

  // 上传照片
  uploadPhoto(e) {
    const player = e.currentTarget.dataset.player
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        if (player === 'me') {
          this.setData({ meAvatar: tempPath })
        } else {
          this.setData({ friendAvatar: tempPath })
        }
        // 异步检测人脸关键点（失败会自动用典型构图兜底）
        detectLandmarks(tempPath, (lm) => {
          if (player === 'me') {
            this._meLandmarks = lm
          } else {
            this._friendLandmarks = lm
          }
        })
        wx.vibrateShort({ type: 'light' })
        audio.playSfx('click')
      }
    })
  },

  // 根据等级获取动画 class
  getAnimClass(levelIndex) {
    switch (levelIndex) {
      case 0: return ''
      case 1: return 'anim-tipsy'
      case 2: return 'anim-buzzed'
      case 3: return 'anim-drunk'
      case 4: return 'anim-blackout-edge'
      case 5: return 'anim-blackout'
      default: return ''
    }
  },

  // 开始游戏
  startGame() {
    const drink = DRINKS.find(d => d.id === this.data.selectedDrinkId)
    if (!drink || !this.data.meAvatar || !this.data.friendAvatar) return

    this.setData({
      started: true,
      _currentDrink: drink,
      round: 0,
      meDrunk: 0,
      meLevelIndex: 0,
      meGlassLevel: 100,
      meStatus: '清醒',
      meLevelColor: '#5DCAA5',
      meQuote: '',
      meReaction: '',
      meEmoji: '',
      meAnimClass: '',
      meDaddy: '',
      friendDrunk: 0,
      friendLevelIndex: 0,
      friendGlassLevel: 100,
      friendStatus: '清醒',
      friendLevelColor: '#5DCAA5',
      friendQuote: '',
      friendReaction: '',
      friendEmoji: '',
      friendAnimClass: '',
      friendDaddy: '',
      gameOver: false,
      winner: '',
      screenShake: false,
      blackoutOverlay: false
    })

    // canvas 渲染出来之后再初始化脸部动画
    setTimeout(() => this.initFaceCanvases(), 60)
  },

  // 初始化双方面部 canvas（wx:if 渲染有延迟，失败重试几次）
  initFaceCanvases(retry) {
    const n = retry || 0
    this._initOneFace('me', '#meFaceCanvas', this.data.meAvatar, this._meLandmarks, n)
    this._initOneFace('friend', '#friendFaceCanvas', this.data.friendAvatar, this._friendLandmarks, n)
  },

  _initOneFace(who, selector, src, landmarks, retry) {
    wx.createSelectorQuery()
      .select(selector)
      .fields({ node: true, size: true })
      .exec((res) => {
        const r = res && res[0]
        if (!r || !r.node) {
          if (retry < 10) {
            setTimeout(() => this._initOneFace(who, selector, src, landmarks, retry + 1), 100)
          }
          return
        }
        const canvas = r.node
        let dpr = 2
        try {
          dpr = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).devicePixelRatio || 2
        } catch (e) {}
        canvas.width = Math.round(r.width * dpr)
        canvas.height = Math.round(r.height * dpr)

        const img = canvas.createImage()
        img.onload = () => {
          wx.getImageInfo({
            src: src,
            success: (info) => {
              const fx = new FaceFX()
              fx.init(canvas, img, info.width, info.height, landmarks || defaultLandmarks)
              if (who === 'me') {
                this._meFX = fx
              } else {
                this._friendFX = fx
              }
            }
          })
        }
        img.src = src
      })
  },

  // 播放某一方的脸部搞怪动画
  _playFaceFx(who, levelIndex) {
    const pool = FACE_EFFECTS[levelIndex]
    if (!pool || !pool.length) return
    const effect = pickRandom(pool)
    const fx = who === 'me' ? this._meFX : this._friendFX
    if (fx) fx.play(effect, 2400)

    // 叫爸爸：配文字气泡
    if (effect === 'daddy') {
      const key = who === 'me' ? 'meDaddy' : 'friendDaddy'
      this.setData({ [key]: pickRandom(DADDY_TEXTS) })
      setTimeout(() => this.setData({ [key]: '' }), 2400)
    }
  },

  // 停止脸部动画（清场用）
  _stopFaceFx() {
    if (this._meFX) { this._meFX.stop(); this._meFX = null }
    if (this._friendFX) { this._friendFX.stop(); this._friendFX = null }
  },

  // 干杯
  cheers() {
    if (this.data.gameOver) return
    const drink = this.data._currentDrink
    if (!drink) return

    // 增加回合
    const newRound = this.data.round + 1

    // 双方各喝一口
    const meSipIncrease = drink.drunkSpeed * (3 + Math.random() * 5)
    const friendSipIncrease = drink.drunkSpeed * (3 + Math.random() * 5)

    // 随机偏差：朋友有时喝得更多
    let meInc = meSipIncrease
    let friendInc = friendSipIncrease
    if (Math.random() < 0.3) {
      friendInc *= 1.5
    } else if (Math.random() < 0.2) {
      meInc *= 1.5
    }

    const newMeDrunk = Math.min(this.data.meDrunk + meInc, 100)
    const newFriendDrunk = Math.min(this.data.friendDrunk + friendInc, 100)

    // 杯中液体下降
    const sipPercent = 100 / drink.sipsPerGlass
    const newMeGlass = Math.max(0, this.data.meGlassLevel - sipPercent)
    const newFriendGlass = Math.max(0, this.data.friendGlassLevel - sipPercent)

    // 自动续杯
    const finalMeGlass = newMeGlass <= 0 ? 100 : newMeGlass
    const finalFriendGlass = newFriendGlass <= 0 ? 100 : newFriendGlass

    // 获取醉酒等级
    const meLevel = getDrunkLevel(newMeDrunk)
    const friendLevel = getDrunkLevel(newFriendDrunk)

    // 获取随机文案
    const meQuote = getRandomQuote(newMeDrunk, drink.id)
    const friendQuote = getRandomQuote(newFriendDrunk, drink.id)

    // 窘态文案 + emoji + 动画
    const meReaction = pickRandom(REACTIONS[meLevel.levelIndex])
    const friendReaction = pickRandom(REACTIONS[friendLevel.levelIndex])
    const meEmoji = DRUNK_EMOJIS[meLevel.levelIndex]
    const friendEmoji = DRUNK_EMOJIS[friendLevel.levelIndex]
    const meAnimClass = this.getAnimClass(meLevel.levelIndex)
    const friendAnimClass = this.getAnimClass(friendLevel.levelIndex)

    // 屏幕特效
    let screenShake = false
    let blackoutOverlay = false
    if (newMeDrunk >= 55 || newFriendDrunk >= 55) {
      screenShake = true
    }
    if (newMeDrunk >= 92 || newFriendDrunk >= 92) {
      blackoutOverlay = true
    }

    // 触觉反馈
    if (newMeDrunk >= 75 || newFriendDrunk >= 75) {
      wx.vibrateShort({ type: 'heavy' })
    } else {
      wx.vibrateShort({ type: 'medium' })
    }

    // 音效：干杯 → 喝酒 → 双方喝完的人声反应（错开才有对话感）
    audio.playSfx('cheers')
    setTimeout(() => audio.playSfx('drink'), 300)
    setTimeout(() => audio.playSfx(pickRandom(VOICE_BY_LEVEL[meLevel.levelIndex])), 900)
    setTimeout(() => audio.playSfx(pickRandom(VOICE_BY_LEVEL[friendLevel.levelIndex])), 1600)

    // 脸部搞怪动画：酒下肚之后开始整活
    setTimeout(() => {
      this._playFaceFx('me', meLevel.levelIndex)
      this._playFaceFx('friend', friendLevel.levelIndex)
    }, 650)

    this.setData({
      round: newRound,
      meDrunk: newMeDrunk,
      meLevelIndex: meLevel.levelIndex,
      meGlassLevel: finalMeGlass,
      meStatus: meLevel.status,
      meLevelColor: meLevel.color,
      meQuote: meQuote,
      meReaction: meReaction,
      meEmoji: meEmoji,
      meAnimClass: meAnimClass,
      friendDrunk: newFriendDrunk,
      friendLevelIndex: friendLevel.levelIndex,
      friendGlassLevel: finalFriendGlass,
      friendStatus: friendLevel.status,
      friendLevelColor: friendLevel.color,
      friendQuote: friendQuote,
      friendReaction: friendReaction,
      friendEmoji: friendEmoji,
      friendAnimClass: friendAnimClass,
      cheering: true,
      screenShake: screenShake,
      blackoutOverlay: blackoutOverlay
    })

    // 停止干杯动画
    setTimeout(() => {
      this.setData({ cheering: false })
    }, 500)

    // 检查游戏结束
    this.checkGameOver(newMeDrunk, newFriendDrunk)
  },

  // 检查游戏结束
  checkGameOver(meDrunk, friendDrunk) {
    const mePassed = meDrunk >= 92
    const friendPassed = friendDrunk >= 92

    if (mePassed || friendPassed) {
      let winner = ''
      let emoji = '🏆'

      if (mePassed && friendPassed) {
        winner = '平局'
        emoji = '🤝'
      } else if (mePassed) {
        winner = '酒友'
        emoji = '🥇'
      } else {
        winner = '我'
        emoji = '👑'
      }

      setTimeout(() => {
        this.setData({
          gameOver: true,
          winner: winner,
          resultEmoji: emoji,
          meDaddy: '',
          friendDaddy: ''
        })
        audio.playSfx('achievement')
      }, 1500)
    }
  },

  // 回到首页
  goHome() {
    // 清除照片临时路径，不保留任何数据
    this._stopFaceFx()
    this._meLandmarks = null
    this._friendLandmarks = null
    this.setData({
      meAvatar: '',
      friendAvatar: '',
      started: false
    })
    wx.redirectTo({
      url: '/pages/index/index'
    })
  },

  // 再来一局（清除照片）
  playAgain() {
    this._stopFaceFx()
    this._meLandmarks = null
    this._friendLandmarks = null
    this.setData({
      meAvatar: '',
      friendAvatar: '',
      started: false,
      gameOver: false,
      selectedDrinkId: null,
      showPrivacyTip: true,
      meDaddy: '',
      friendDaddy: ''
    })
  },

  onShow() {
    audio.resumeMusic()
  },

  onHide() {
    audio.pauseMusic()
  },

  onUnload() {
    // 页面卸载时停止动画并清除照片引用
    this._stopFaceFx()
    this._meLandmarks = null
    this._friendLandmarks = null
    this.setData({
      meAvatar: '',
      friendAvatar: ''
    })
  },

  onShareAppMessage() {
    return {
      title: '我' + (this.data.winner === '我' ? '赢了' : this.data.winner === '酒友' ? '输了' : '平了') + '！来面基干杯！',
      path: '/pages/face-drink/face-drink'
    }
  }
})
