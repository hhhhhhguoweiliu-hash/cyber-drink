/**
 * utils/facefx.js - 脸部搞怪形变引擎
 *
 * 原理：把照片切成 GRID×GRID 的三角网格，每个顶点按"高斯衰减场"围绕
 * 脸部关键点（眼睛/嘴巴）做局部位移，再逐三角形仿射绘制，
 * 实现只动五官、不动背景的局部形变（类似滤镜的瘦脸/大眼，但用于搞怪）。
 *
 * 效果：
 *  - glare  急眼瞪眼：双眼区域向外凸 + 眉毛上挑
 *  - laugh  大笑：下巴下拉开合 + 全脸抖
 *  - wink   挤眉弄眼：左右眼交替挤压 + 歪头
 *  - daddy  叫爸爸：嘴巴快速开合 + 腮帮鼓起（配合文字气泡）
 */

const GRID = 8 // 网格密度（8x8 格 = 128 三角形）

// ---------- 关键点检测 ----------

/**
 * 估计/检测人脸关键点，返回归一化到"正方形裁剪区"的坐标
 * 优先 wx.faceDetect（用真实脸框反推五官），失败则用自拍典型位置兜底
 * cb(landmarks) landmarks = { leftEye, rightEye, nose, mouth } 各 {x:0~1, y:0~1}
 */
function detectLandmarks(tempFilePath, cb) {
  wx.getImageInfo({
    src: tempFilePath,
    success: (info) => {
      const w = info.width
      const h = info.height
      const s = Math.min(w, h)
      const crop = { x: (w - s) / 2, y: (h - s) / 2, s: s }

      // 兜底：假设脸在画面中央（自拍/头像典型构图）
      const fallback = () => cb(boxToLandmarks({ x: 0.2, y: 0.14, w: 0.6, h: 0.72 }))

      // 环境不支持就直接兜底
      if (typeof wx.initFaceDetect !== 'function' || typeof wx.faceDetect !== 'function' ||
          typeof wx.createOffscreenCanvas !== 'function') {
        fallback()
        return
      }

      // 把图片画到离屏 canvas 拿 RGBA 像素（缩到最长边 480 加速）
      const scale = Math.min(1, 480 / Math.max(w, h))
      const dw = Math.round(w * scale)
      const dh = Math.round(h * scale)
      let off
      try {
        off = wx.createOffscreenCanvas({ type: '2d', width: dw, height: dh })
      } catch (e) {
        fallback()
        return
      }
      const octx = off.getContext('2d')
      const img = off.createImage ? off.createImage() : null
      if (!img) { fallback(); return }

      img.onload = () => {
        try {
          octx.drawImage(img, 0, 0, dw, dh)
          const imgData = octx.getImageData(0, 0, dw, dh)
          wx.initFaceDetect({
            success: () => {
              wx.faceDetect({
                frameBuffer: imgData.data.buffer,
                width: dw,
                height: dh,
                success: (res) => {
                  const r = res && res.detectRect
                  // x=-1 表示没检测到人脸；脸框太小也不可信
                  if (!r || res.x === -1 || r.width < dw * 0.12) {
                    fallback()
                    return
                  }
                  // 脸框从缩放图坐标 → 原图坐标 → 裁剪区归一化坐标
                  const box = {
                    x: (r.originX / scale - crop.x) / crop.s,
                    y: (r.originY / scale - crop.y) / crop.s,
                    w: (r.width / scale) / crop.s,
                    h: (r.height / scale) / crop.s
                  }
                  // 框大部分要在裁剪区内，否则构图太偏，用兜底更稳
                  if (box.x < -0.2 || box.y < -0.2 || box.x + box.w > 1.2 || box.y + box.h > 1.2) {
                    fallback()
                    return
                  }
                  cb(boxToLandmarks(box))
                },
                fail: fallback
              })
            },
            fail: fallback
          })
        } catch (e) {
          fallback()
        }
      }
      img.onerror = fallback
      img.src = tempFilePath
    },
    fail: () => cb(boxToLandmarks({ x: 0.2, y: 0.14, w: 0.6, h: 0.72 }))
  })
}

/** 由脸框（裁剪区归一化坐标）按人脸比例反推五官位置 */
function boxToLandmarks(box) {
  return {
    leftEye:  { x: box.x + box.w * 0.33, y: box.y + box.h * 0.40 },
    rightEye: { x: box.x + box.w * 0.67, y: box.y + box.h * 0.40 },
    nose:     { x: box.x + box.w * 0.50, y: box.y + box.h * 0.58 },
    mouth:    { x: box.x + box.w * 0.50, y: box.y + box.h * 0.76 }
  }
}

/** 典型自拍构图的默认关键点（检测失败时的兜底） */
const defaultLandmarks = boxToLandmarks({ x: 0.2, y: 0.14, w: 0.6, h: 0.72 })

// ---------- 形变引擎 ----------

class FaceFX {
  constructor() {
    this.canvas = null
    this.ctx = null
    this.img = null
    this.W = 0
    this.H = 0
    this.crop = { x: 0, y: 0, s: 1 }
    this.landmarks = null
    this.playing = false
    this._raf = null
    // 预分配网格
    const n = GRID + 1
    this.px = new Float32Array(n * n)
    this.py = new Float32Array(n * n)
  }

  /**
   * canvas: 通过 SelectorQuery 拿到的 canvas node
   * img: canvas.createImage() 加载完成的图片
   * imgW/imgH: 图片原始像素尺寸
   * landmarks: detectLandmarks 的结果
   */
  init(canvas, img, imgW, imgH, landmarks) {
    this.stop()
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.img = img
    this.W = canvas.width
    this.H = canvas.height
    const s = Math.min(imgW, imgH)
    this.crop = { x: (imgW - s) / 2, y: (imgH - s) / 2, s: s }
    this.landmarks = landmarks
    this.drawStatic()
  }

  /** 静止绘制（aspectFill 居中裁剪） */
  drawStatic() {
    if (!this.ctx || !this.img) return
    const c = this.crop
    this.ctx.clearRect(0, 0, this.W, this.H)
    this.ctx.drawImage(this.img, c.x, c.y, c.s, c.s, 0, 0, this.W, this.H)
  }

  /** 播放一个效果，duration 毫秒 */
  play(effect, duration, onDone) {
    if (!this.ctx || !this.img || !this.landmarks) return
    this.stop()
    this.playing = true
    const start = Date.now()
    const dur = duration || 2400
    const step = () => {
      if (!this.playing) return
      const t = (Date.now() - start) / dur
      if (t >= 1) {
        this.playing = false
        this.drawStatic()
        if (onDone) onDone()
        return
      }
      this._renderFrame(effect, t)
      if (this.canvas.requestAnimationFrame) {
        this._raf = this.canvas.requestAnimationFrame(step)
      } else {
        this._raf = setTimeout(step, 16)
      }
    }
    step()
  }

  stop() {
    this.playing = false
    if (this._raf !== null) {
      if (this.canvas && this.canvas.cancelAnimationFrame) {
        this.canvas.cancelAnimationFrame(this._raf)
      } else {
        clearTimeout(this._raf)
      }
      this._raf = null
    }
  }

  // 时间包络：快进 15% → 保持 → 慢出 25%
  _env(t) {
    if (t < 0.15) return t / 0.15
    if (t > 0.75) return Math.max(0, 1 - (t - 0.75) / 0.25)
    return 1
  }

  /** 单个顶点的位移（归一化单位），返回 [du, dv] */
  _disp(effect, u, v, t) {
    const lm = this.landmarks
    let du = 0, dv = 0
    const I = this._env(t)

    if (effect === 'glare') {
      // 急眼瞪眼：双眼外凸 + 眉上挑
      const eyes = [lm.leftEye, lm.rightEye]
      for (let k = 0; k < 2; k++) {
        const c = eyes[k]
        const dx = u - c.x, dy = v - c.y
        const d = Math.sqrt(dx * dx + dy * dy) + 1e-6
        const g = Math.exp(-(dx * dx + dy * dy) / (2 * 0.09 * 0.09))
        du += (dx / d) * 0.055 * g * I
        dv += (dy / d) * 0.055 * g * I
        // 眉毛（眼睛上方）上挑
        const bx = u - c.x, by = v - (c.y - 0.07)
        const gb = Math.exp(-(bx * bx + by * by) / (2 * 0.07 * 0.07))
        dv -= 0.028 * gb * I
      }
    } else if (effect === 'laugh') {
      // 大笑：下巴下拉（两次"哈哈"起伏）+ 全脸笑到发抖
      const m = lm.mouth
      const bounce = I * (0.72 + 0.28 * Math.sin(t * Math.PI * 4))
      const dx = u - m.x, dy = v - m.y
      const g = Math.exp(-(dx * dx + dy * dy) / (2 * 0.12 * 0.12))
      if (v > m.y) {
        dv += 0.16 * g * Math.min((v - m.y) / 0.22, 1) * bounce
      } else {
        dv -= 0.04 * g * bounce // 上唇微提
      }
      du += 0.014 * Math.sin(t * Math.PI * 6) * I
    } else if (effect === 'wink') {
      // 挤眉弄眼：左右眼交替挤压 + 歪头贱笑
      const idx = Math.floor(t * 4) % 2
      const phase = (t * 4) % 1
      const w = Math.sin(Math.PI * phase) * I
      const c = idx === 0 ? lm.leftEye : lm.rightEye
      const dx = u - c.x, dy = v - c.y
      const g = Math.exp(-(dx * dx + dy * dy) / (2 * 0.085 * 0.085))
      dv += -dy * 0.8 * g * w   // 垂直挤压 = 挤眼
      du += -dx * 0.3 * g * w
      // 嘴角上扬：嘴两侧向上拽
      const m = lm.mouth
      const side = idx === 0 ? -1 : 1
      const mx = u - (m.x + side * 0.1), my = v - (m.y - 0.02)
      const gm = Math.exp(-(mx * mx + my * my) / (2 * 0.07 * 0.07))
      dv -= 0.03 * gm * w
      // 歪头
      const ang = 0.055 * Math.sin(t * Math.PI * 4) * I
      du += -(v - 0.5) * ang
      dv += (u - 0.5) * ang
    } else if (effect === 'daddy') {
      // 叫爸爸：嘴快速开合 + 腮帮鼓起
      const m = lm.mouth
      const open = Math.abs(Math.sin(t * Math.PI * 6)) * I
      const dx = u - m.x, dy = v - m.y
      const g = Math.exp(-(dx * dx + dy * dy) / (2 * 0.11 * 0.11))
      if (v > m.y) {
        dv += 0.11 * g * Math.min((v - m.y) / 0.2, 1) * open
      }
      const cheeks = [
        { x: m.x - 0.13, y: m.y - 0.04 },
        { x: m.x + 0.13, y: m.y - 0.04 }
      ]
      for (let k = 0; k < 2; k++) {
        const cx = u - cheeks[k].x, cy = v - cheeks[k].y
        const d = Math.sqrt(cx * cx + cy * cy) + 1e-6
        const gc = Math.exp(-(cx * cx + cy * cy) / (2 * 0.07 * 0.07))
        du += (cx / d) * 0.03 * gc * I
        dv += (cy / d) * 0.03 * gc * I
      }
    }
    return [du, dv]
  }

  _renderFrame(effect, t) {
    const n = GRID + 1
    const { px, py, ctx, W, H } = this
    // 1. 算所有顶点的位移后位置（画布像素坐标）
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const u = j / GRID
        const v = i / GRID
        const d = this._disp(effect, u, v, t)
        const id = i * n + j
        px[id] = (u + d[0]) * W
        py[id] = (v + d[1]) * H
      }
    }
    // 2. 逐三角形仿射绘制
    ctx.clearRect(0, 0, W, H)
    const c = this.crop
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const i0 = i * n + j
        const i1 = i * n + j + 1
        const i2 = (i + 1) * n + j + 1
        const i3 = (i + 1) * n + j
        // 源图坐标（未位移的规则网格 → 裁剪区像素）
        const su0 = c.x + (j / GRID) * c.s,     sv0 = c.y + (i / GRID) * c.s
        const su1 = c.x + ((j + 1) / GRID) * c.s, sv1 = sv0
        const su2 = su1,                         sv2 = c.y + ((i + 1) / GRID) * c.s
        const su3 = su0,                         sv3 = sv2
        this._drawTri(su0, sv0, su1, sv1, su2, sv2, px[i0], py[i0], px[i1], py[i1], px[i2], py[i2])
        this._drawTri(su0, sv0, su2, sv2, su3, sv3, px[i0], py[i0], px[i2], py[i2], px[i3], py[i3])
      }
    }
  }

  /** 画一个形变三角形：源三角 → 目标三角 的仿射变换 + 裁剪 */
  _drawTri(sx0, sy0, sx1, sy1, sx2, sy2, dx0, dy0, dx1, dy1, dx2, dy2) {
    const ctx = this.ctx
    const den = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1)
    if (Math.abs(den) < 1e-6) return
    const a = (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / den
    const b = (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / den
    const c = (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / den
    const d = (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / den
    const e = (dx0 * (sx1 * sy2 - sx2 * sy1) + dx1 * (sx2 * sy0 - sx0 * sy2) + dx2 * (sx0 * sy1 - sx1 * sy0)) / den
    const f = (dy0 * (sx1 * sy2 - sx2 * sy1) + dy1 * (sx2 * sy0 - sx0 * sy2) + dy2 * (sx0 * sy1 - sx1 * sy0)) / den

    // 目标三角形向外扩 0.9px，消除接缝
    const cx = (dx0 + dx1 + dx2) / 3
    const cy = (dy0 + dy1 + dy2) / 3
    const expand = (x, y) => {
      const vx = x - cx, vy = y - cy
      const l = Math.sqrt(vx * vx + vy * vy) || 1
      const k = (l + 0.9) / l
      return [cx + vx * k, cy + vy * k]
    }
    const p0 = expand(dx0, dy0)
    const p1 = expand(dx1, dy1)
    const p2 = expand(dx2, dy2)

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(p0[0], p0[1])
    ctx.lineTo(p1[0], p1[1])
    ctx.lineTo(p2[0], p2[1])
    ctx.closePath()
    ctx.clip()
    ctx.transform(a, b, c, d, e, f)
    ctx.drawImage(this.img, 0, 0)
    ctx.restore()
  }
}

module.exports = {
  FaceFX,
  detectLandmarks,
  defaultLandmarks
}
