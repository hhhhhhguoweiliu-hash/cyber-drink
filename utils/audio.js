/**
 * utils/audio.js - 音频管理系统
 * 统一管理所有音效和背景音乐播放
 */

// 音效文件路径
const SFX = {
  drink: '/assets/audio/drink.mp3',
  pour: '/assets/audio/pour.mp3',
  shake: '/assets/audio/shake.mp3',
  cheers: '/assets/audio/cheers.mp3',
  click: '/assets/audio/click.mp3',
  bubble: '/assets/audio/bubble.mp3',
  achievement: '/assets/audio/achievement.mp3',
  // 喝酒人声（喝完一口的临场反应）
  voice_ha: '/assets/audio/voice_ha.mp3',       // 哈气"哈~"
  voice_smack: '/assets/audio/voice_smack.mp3', // 咂嘴"啧啧"
  voice_burp: '/assets/audio/voice_burp.mp3',   // 打嗝"呃~"
  voice_hiccup: '/assets/audio/voice_hiccup.mp3' // 酒嗝"hic!"
}

// 背景音乐路径
const MUSIC = {
  heroic: '/assets/audio/bg_heroic.mp3',
  elegant: '/assets/audio/bg_elegant.mp3'
}

// 缓存的音效上下文
const sfxCache = {}
let bgMusic = null
let musicEnabled = true
let sfxEnabled = true
let currentStyle = 'heroic'

/**
 * 播放音效
 */
function playSfx(name) {
  if (!sfxEnabled) return
  if (!SFX[name]) return

  // 懒加载：首次使用时创建
  if (!sfxCache[name]) {
    const ctx = wx.createInnerAudioContext()
    ctx.src = SFX[name]
    ctx.volume = 0.8
    sfxCache[name] = ctx
  }

  const ctx = sfxCache[name]
  // 停止当前播放再重新播放（避免重叠问题）
  ctx.stop()
  ctx.seek(0)
  ctx.play()
}

/**
 * 播放背景音乐
 */
function playMusic(style) {
  if (!musicEnabled) return
  // 风格没变就不重启
  if (bgMusic && currentStyle === style) return

  stopMusic()
  currentStyle = style || 'heroic'
  const src = MUSIC[currentStyle] || MUSIC.heroic

  bgMusic = wx.createInnerAudioContext()
  bgMusic.src = src
  bgMusic.loop = true
  bgMusic.volume = 0.35
  bgMusic.play()
}

/**
 * 停止背景音乐
 */
function stopMusic() {
  if (bgMusic) {
    bgMusic.stop()
    bgMusic.destroy()
    bgMusic = null
  }
}

/**
 * 暂停背景音乐（页面隐藏时）
 */
function pauseMusic() {
  if (bgMusic) {
    bgMusic.pause()
  }
}

/**
 * 恢复背景音乐（页面显示时）
 */
function resumeMusic() {
  if (bgMusic && musicEnabled) {
    bgMusic.play()
  }
}

/**
 * 切换音乐开关
 */
function toggleMusic() {
  musicEnabled = !musicEnabled
  if (musicEnabled) {
    playMusic(currentStyle)
  } else {
    stopMusic()
  }
  // 持久化
  wx.setStorageSync('musicEnabled', musicEnabled)
  return musicEnabled
}

/**
 * 切换音效开关
 */
function toggleSfx() {
  sfxEnabled = !sfxEnabled
  wx.setStorageSync('sfxEnabled', sfxEnabled)
  return sfxEnabled
}

/**
 * 初始化：从本地存储恢复设置
 */
function init() {
  musicEnabled = wx.getStorageSync('musicEnabled')
  if (musicEnabled === '' || musicEnabled === undefined) musicEnabled = true
  sfxEnabled = wx.getStorageSync('sfxEnabled')
  if (sfxEnabled === '' || sfxEnabled === undefined) sfxEnabled = true
}

/**
 * 销毁所有音频资源
 */
function destroyAll() {
  stopMusic()
  Object.keys(sfxCache).forEach(key => {
    sfxCache[key].destroy()
    delete sfxCache[key]
  })
}

module.exports = {
  SFX,
  MUSIC,
  playSfx,
  playMusic,
  stopMusic,
  pauseMusic,
  resumeMusic,
  toggleMusic,
  toggleSfx,
  init,
  destroyAll,
  getMusicEnabled: () => musicEnabled,
  getSfxEnabled: () => sfxEnabled
}
