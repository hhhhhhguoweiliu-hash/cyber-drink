const app = getApp()
const { createScopedThreejs } = require('threejs-miniprogram')
const { DRINKS, STYLE_MODES, getDrunkLevel, getRandomQuote, checkAchievements } = require('../../utils/drinks.js')
const { getV7Profile } = require('../../utils/v7DrinkProfiles.js')
const audio = require('../../utils/audio.js')

const hex = (value, fallback) => {
  const n = parseInt(String(value || '').replace('#', '').slice(0, 6), 16)
  return Number.isFinite(n) ? n : fallback
}
const clamp01 = (v) => Math.max(0, Math.min(1, v))
const smooth = (t) => {
  t = clamp01(t)
  return t * t * (3 - 2 * t)
}
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3)

Page({
  data: {
    drinks: DRINKS,
    drink: DRINKS[0],
    profile: getV7Profile('beer'),
    activeIndex: 0,
    ready: false,
    busy: false,
    cocktailCrafted: false,
    sips: 0,
    glasses: 0,
    drunkValue: 0,
    drunkStatus: '清醒',
    drunkLevelColor: '#5DCAA5',
    currentQuote: '拖动场景可以转动视角',
    quoteVisible: true,
    themeStyle: '',
    cabinetOpen: false
  },

  onLoad(options) {
    const id = options.id || 'beer'
    const index = Math.max(0, DRINKS.findIndex(x => x.id === id))
    const drink = DRINKS[index]
    this.session = [drink.id]
    this.breakdown = { [drink.id]: { sips: 0, glasses: 0 } }
    this.setData({
      drink,
      profile: getV7Profile(id),
      activeIndex: index,
      cocktailCrafted: options.crafted === '1'
    })
    const mode = STYLE_MODES[app.globalData.styleMode || 'heroic']
    if (mode) {
      this.setData({
        themeStyle: `--accent:${mode.theme.accent};--text-main:${mode.theme.text};--text-sub:${mode.theme.textSub}`
      })
    }
  },

  onReady() {
    wx.createSelectorQuery().select('#drink3d').fields({ node: true, size: true }).exec(res => {
      if (!res[0]) return
      this.canvas = res[0].node
      const dpr = Math.min(wx.getSystemInfoSync().pixelRatio || 1, 2)
      this.canvas.width = Math.max(1, Math.floor(res[0].width * dpr))
      this.canvas.height = Math.max(1, Math.floor(res[0].height * dpr))
      this.viewWidth = res[0].width
      this.viewHeight = res[0].height
      this.dpr = dpr
      this.THREE = createScopedThreejs(this.canvas)
      this.build3D()
      this.setData({ ready: true })
      this.quote('酒吧已点亮 · 拖动画面可转动视角')
    })
  },

  onShow() { audio.resumeMusic() },
  onHide() { audio.pauseMusic() },
  onUnload() {
    clearTimeout(this.qt)
    clearTimeout(this.at)
    if (this.world) this.world.dead = true
    audio.pauseMusic()
  },

  mat(color, options = {}) {
    const T = this.THREE
    return new T.MeshStandardMaterial({
      color,
      roughness: options.r == null ? 0.3 : options.r,
      metalness: options.m || 0,
      transparent: !!options.t,
      opacity: options.o == null ? 1 : options.o,
      side: options.ds ? T.DoubleSide : T.FrontSide,
      depthWrite: options.dw == null ? true : options.dw
    })
  },

  addShadowBlob(parent, x, z, sx, sz, opacity = 0.18) {
    const T = this.THREE
    const material = new T.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false
    })
    const mesh = new T.Mesh(new T.CircleGeometry(1, 32), material)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(x, 0.006, z)
    mesh.scale.set(sx, sz, 1)
    parent.add(mesh)
    return mesh
  },

  createPendantLight(parent, x, z, warm = 0xffb36a) {
    const T = this.THREE
    const g = new T.Group()
    const cord = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 2.2, 8), this.mat(0x181818, { r: 0.7 }))
    cord.position.y = 4.8
    g.add(cord)
    const shade = new T.Mesh(new T.CylinderGeometry(0.13, 0.48, 0.48, 24, 1, true), this.mat(0x171717, { r: 0.42, m: 0.35, ds: true }))
    shade.position.y = 3.7
    g.add(shade)
    const bulb = new T.Mesh(new T.SphereGeometry(0.12, 18, 12), this.mat(0xffddb3, { r: 0.2 }))
    bulb.position.y = 3.55
    g.add(bulb)
    const light = new T.PointLight(warm, 0.95, 9)
    light.position.y = 3.5
    g.add(light)
    g.position.set(x, 0, z)
    parent.add(g)
  },

  createBackBar(parent) {
    const T = this.THREE
    const wall = new T.Mesh(new T.BoxGeometry(10, 5.2, 0.28), this.mat(0x0c1018, { r: 0.82 }))
    wall.position.set(0, 2.3, -4.3)
    parent.add(wall)

    const wood = this.mat(0x3a2419, { r: 0.46 })
    const darkMetal = this.mat(0x17191e, { r: 0.34, m: 0.62 })
    for (let row = 0; row < 3; row++) {
      const shelf = new T.Mesh(new T.BoxGeometry(7.7, 0.12, 0.72), wood)
      shelf.position.set(0, 1.15 + row * 1.15, -3.95)
      shelf.castShadow = true
      parent.add(shelf)
      const rail = new T.Mesh(new T.BoxGeometry(7.9, 0.05, 0.04), darkMetal)
      rail.position.set(0, 1.08 + row * 1.15, -3.55)
      parent.add(rail)
      for (let i = 0; i < 8; i++) {
        const h = 0.48 + ((i + row) % 3) * 0.12
        const radius = 0.12 + (i % 2) * 0.025
        const bottleMat = this.mat([0x173522, 0x4a291b, 0x16273c, 0x4b1516][(i + row) % 4], { r: 0.23, t: true, o: 0.82, dw: false })
        const bg = new T.Group()
        const body = new T.Mesh(new T.CylinderGeometry(radius, radius * 1.05, h, 12), bottleMat)
        body.position.y = h / 2
        bg.add(body)
        const neck = new T.Mesh(new T.CylinderGeometry(radius * 0.44, radius * 0.48, 0.18, 10), bottleMat)
        neck.position.y = h + 0.08
        bg.add(neck)
        bg.position.set(-3.05 + i * 0.87, 1.21 + row * 1.15, -3.78)
        parent.add(bg)
      }
    }
  },

  createHand(style = 'pour') {
    const T = this.THREE
    const g = new T.Group()
    const skin = this.mat(0xc78f72, { r: 0.62 })
    const sleeve = this.mat(0x181b22, { r: 0.7 })
    const forearm = new T.Mesh(new T.CylinderGeometry(0.22, 0.27, 1.45, 18), sleeve)
    forearm.rotation.z = Math.PI / 2
    forearm.position.x = style === 'pour' ? -0.7 : 0.7
    g.add(forearm)
    const palm = new T.Mesh(new T.BoxGeometry(0.54, 0.25, 0.7), skin)
    palm.position.x = style === 'pour' ? 0.02 : -0.02
    g.add(palm)
    for (let i = 0; i < 4; i++) {
      const finger = new T.Mesh(new T.CylinderGeometry(0.055, 0.06, 0.62, 10), skin)
      finger.rotation.z = Math.PI / 2
      finger.position.set(style === 'pour' ? 0.18 : -0.18, -0.02 + i * 0.045, -0.24 + i * 0.16)
      g.add(finger)
    }
    const thumb = new T.Mesh(new T.CylinderGeometry(0.065, 0.07, 0.46, 10), skin)
    thumb.rotation.z = Math.PI / 2.8
    thumb.rotation.y = 0.45
    thumb.position.set(style === 'pour' ? 0.05 : -0.05, -0.16, 0.25)
    g.add(thumb)
    return g
  },

  createBottle() {
    const T = this.THREE
    const p = this.data.profile
    const g = new T.Group()
    const kind = p.bottle.kind
    const color = hex(p.bottle.body, 0x604020)
    const glass = this.mat(color, { r: 0.18, t: true, o: 0.78, dw: false })
    const capMat = this.mat(hex(p.bottle.cap, 0xd9b56f), { r: 0.22, m: 0.48 })
    const labelMat = this.mat(0xe4d4b7, { r: 0.55 })
    let body

    if (kind === 'whiskey_bottle') {
      body = new T.Mesh(new T.BoxGeometry(0.92, 1.65, 0.7), glass)
      body.position.y = 0.92
      g.add(body)
      const shoulder = new T.Mesh(new T.CylinderGeometry(0.26, 0.48, 0.35, 18), glass)
      shoulder.position.y = 1.88
      g.add(shoulder)
      const neck = new T.Mesh(new T.CylinderGeometry(0.23, 0.25, 0.64, 18), glass)
      neck.position.y = 2.35
      g.add(neck)
      const cap = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 0.18, 18), capMat)
      cap.position.y = 2.76
      g.add(cap)
      const label = new T.Mesh(new T.BoxGeometry(0.72, 0.62, 0.025), labelMat)
      label.position.set(0, 1.05, 0.365)
      g.add(label)
      const amber = new T.Mesh(new T.BoxGeometry(0.78, 1.05, 0.56), this.mat(0x9b4f16, { r: 0.16, t: true, o: 0.58, dw: false }))
      amber.position.y = 0.67
      g.add(amber)
    } else if (kind === 'beer_can') {
      body = new T.Mesh(new T.CylinderGeometry(0.39, 0.39, 1.78, 28), this.mat(color, { r: 0.34, m: 0.52 }))
      body.position.y = 0.92
      g.add(body)
      const lid = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.045, 28), capMat)
      lid.position.y = 1.83
      g.add(lid)
    } else {
      body = new T.Mesh(new T.CylinderGeometry(0.4, 0.5, 1.8, 28), glass)
      body.position.y = 0.92
      g.add(body)
      const shoulder = new T.Mesh(new T.CylinderGeometry(0.19, 0.39, 0.32, 20), glass)
      shoulder.position.y = 1.96
      g.add(shoulder)
      const neck = new T.Mesh(new T.CylinderGeometry(0.18, 0.19, 0.68, 18), glass)
      neck.position.y = 2.43
      g.add(neck)
      const cap = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.13, 18), capMat)
      cap.position.y = 2.84
      g.add(cap)
    }

    g.traverse && g.traverse(obj => {
      if (obj && obj.isMesh) obj.castShadow = true
    })
    return g
  },

  createGlass() {
    const T = this.THREE
    const d = this.data.drink
    const g = new T.Group()
    const glassMat = this.mat(0xe8f4ff, { r: 0.04, t: true, o: 0.19, ds: true, dw: false })
    const edgeMat = this.mat(0xf7fbff, { r: 0.02, t: true, o: 0.42, dw: false })
    const liquidMat = this.mat(hex(d.color, 0xc87938), { r: 0.08, t: true, o: d.id === 'whiskey' ? 0.78 : 0.68, dw: false })
    let body
    let r = 0.42
    let h = 1.05
    let base = 0.12

    if (d.glassType === 'beer_mug') {
      body = new T.Mesh(new T.CylinderGeometry(0.58, 0.5, 1.75, 36, 1, true), glassMat)
      body.position.y = 0.88
      const bottom = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.10, 36), glassMat)
      bottom.position.y = 0.06
      g.add(bottom)
      const handle = new T.Mesh(new T.TorusGeometry(0.48, 0.07, 12, 32, Math.PI * 1.48), glassMat)
      handle.position.set(0.56, 0.95, 0)
      handle.rotation.y = Math.PI / 2
      handle.rotation.z = -2.2
      g.add(handle)
      r = 0.45; h = 1.48; base = 0.14
    } else if (d.glassType === 'rocks_glass') {
      body = new T.Mesh(new T.CylinderGeometry(0.63, 0.56, 1.04, 36, 1, true), glassMat)
      body.position.y = 0.54
      const thickBottom = new T.Mesh(new T.CylinderGeometry(0.56, 0.56, 0.14, 36), this.mat(0xeaf6ff, { r: 0.03, t: true, o: 0.28, dw: false }))
      thickBottom.position.y = 0.07
      g.add(thickBottom)
      const rim = new T.Mesh(new T.TorusGeometry(0.63, 0.018, 8, 40), edgeMat)
      rim.rotation.x = Math.PI / 2
      rim.position.y = 1.06
      g.add(rim)
      r = 0.52; h = 0.78; base = 0.15

      if (d.id === 'whiskey') {
        const iceMat = this.mat(0xeaf7ff, { r: 0.05, t: true, o: 0.46, dw: false })
        const ice1 = new T.Mesh(new T.BoxGeometry(0.42, 0.42, 0.42), iceMat)
        ice1.position.set(-0.16, 0.37, 0.08)
        ice1.rotation.set(0.18, 0.42, 0.08)
        const ice2 = new T.Mesh(new T.BoxGeometry(0.39, 0.39, 0.39), iceMat)
        ice2.position.set(0.18, 0.40, -0.10)
        ice2.rotation.set(-0.12, -0.30, 0.24)
        g.add(ice1, ice2)
        g.userData.ice = [ice1, ice2]
      }
    } else if (d.glassType === 'shot_glass' || d.glassType === 'erguotou_glass') {
      body = new T.Mesh(new T.CylinderGeometry(0.35, 0.27, 0.7, 30, 1, true), glassMat)
      body.position.y = 0.37
      const bottom = new T.Mesh(new T.CylinderGeometry(0.27, 0.27, 0.08, 30), glassMat)
      bottom.position.y = 0.04
      g.add(bottom)
      r = 0.27; h = 0.5; base = 0.11
    } else if (d.glassType === 'wine_glass') {
      const bowl = new T.Mesh(new T.SphereGeometry(0.64, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.66), glassMat)
      bowl.scale.set(0.78, 1.05, 0.78)
      bowl.position.y = 1.13
      g.add(bowl)
      const stem = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.78, 14), glassMat)
      stem.position.y = 0.44
      g.add(stem)
      const foot = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.05, 28), glassMat)
      foot.position.y = 0.03
      g.add(foot)
      r = 0.4; h = 0.55; base = 0.86
    } else if (d.glassType === 'cocktail_glass') {
      body = new T.Mesh(new T.CylinderGeometry(0.7, 0.08, 0.8, 32, 1, true), glassMat)
      body.position.y = 1.16
      const stem = new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.78, 14), glassMat)
      stem.position.y = 0.47
      g.add(stem)
      const foot = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.05, 28), glassMat)
      foot.position.y = 0.03
      g.add(foot)
      r = 0.38; h = 0.43; base = 0.9
    } else {
      body = new T.Mesh(new T.CylinderGeometry(0.5, 0.42, 1.2, 32, 1, true), glassMat)
      body.position.y = 0.62
    }

    if (body) g.add(body)
    const liquid = new T.Mesh(new T.CylinderGeometry(r, r * 0.94, h, 32), liquidMat)
    liquid.scale.y = 0.01
    liquid.position.y = base
    g.add(liquid)
    g.userData.liquid = liquid
    g.userData.base = base
    g.userData.h = h
    g.userData.r = r
    return g
  },

  setLiquid(value) {
    if (!this.g3) return
    const v = Math.max(0.01, Math.min(1, value))
    this.level = v
    const u = this.g3.userData
    u.liquid.scale.y = v
    u.liquid.position.y = u.base + u.h * v * 0.5
  },

  updateLiquidWorldLevel() {
    if (!this.g3 || !this.g3.userData.liquid) return
    const liquid = this.g3.userData.liquid
    liquid.rotation.x = -this.g3.rotation.x
    liquid.rotation.z = -this.g3.rotation.z
  },

  build3D() {
    const T = this.THREE
    const C = this.canvas
    const scene = new T.Scene()
    scene.background = new T.Color(0x07090d)
    scene.fog = new T.Fog(0x07090d, 9, 20)

    const camera = new T.PerspectiveCamera(38, C.width / C.height, 0.1, 50)
    camera.position.set(0, 3.15, 8.9)
    camera.lookAt(0, 1.25, 0)

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(1)
    renderer.setSize(C.width, C.height)
    renderer.shadowMap.enabled = true
    if (renderer.shadowMap) renderer.shadowMap.type = T.PCFSoftShadowMap

    const ambient = new T.AmbientLight(0x66738c, 0.55)
    scene.add(ambient)
    const key = new T.PointLight(0xffa34d, 2.3, 17)
    key.position.set(-3.6, 5.8, 3.2)
    key.castShadow = true
    scene.add(key)
    const fill = new T.PointLight(0x6c8fd1, 0.8, 13)
    fill.position.set(4.5, 3.4, 2.2)
    scene.add(fill)
    const rim = new T.PointLight(0xffcf8a, 0.75, 10)
    rim.position.set(0, 2.6, -2.8)
    scene.add(rim)

    const root = new T.Group()
    scene.add(root)

    const floor = new T.Mesh(new T.PlaneGeometry(18, 18), this.mat(0x090b10, { r: 0.92 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.38
    floor.receiveShadow = true
    scene.add(floor)

    const table = new T.Mesh(new T.BoxGeometry(8.7, 0.36, 4.2), this.mat(0x362219, { r: 0.48 }))
    table.position.set(0, -0.20, 0.4)
    table.receiveShadow = true
    table.castShadow = true
    root.add(table)
    const tableEdge = new T.Mesh(new T.BoxGeometry(8.72, 0.07, 4.22), this.mat(0x7a4b2b, { r: 0.38 }))
    tableEdge.position.set(0, 0.005, 0.4)
    root.add(tableEdge)

    this.createBackBar(root)
    this.createPendantLight(scene, -2.7, 0.4)
    this.createPendantLight(scene, 2.9, 0.1, 0xffc785)

    const bottle = this.createBottle()
    bottle.position.set(-1.55, 0.03, 0.1)
    root.add(bottle)

    const glass = this.createGlass()
    glass.position.set(1.05, 0.03, 0.18)
    root.add(glass)

    this.addShadowBlob(root, -1.55, 0.1, 0.65, 0.34, 0.23)
    this.addShadowBlob(root, 1.05, 0.18, 0.55, 0.30, 0.24)

    const stream = new T.Mesh(
      new T.CylinderGeometry(0.042, 0.025, 2.15, 10),
      this.mat(hex(this.data.drink.color, 0xc87938), { r: 0.06, t: true, o: 0.82, dw: false })
    )
    stream.visible = false
    root.add(stream)

    const drop = new T.Mesh(
      new T.SphereGeometry(0.07, 14, 10),
      this.mat(hex(this.data.drink.color, 0xc87938), { r: 0.06, t: true, o: 0.78, dw: false })
    )
    drop.visible = false
    root.add(drop)

    const pourHand = this.createHand('pour')
    pourHand.visible = false
    pourHand.scale.set(0.92, 0.92, 0.92)
    root.add(pourHand)

    const drinkHand = this.createHand('drink')
    drinkHand.visible = false
    drinkHand.scale.set(0.78, 0.78, 0.78)
    root.add(drinkHand)

    this.g3 = glass
    this.level = 0
    this.world = {
      scene,
      camera,
      renderer,
      root,
      bottle,
      glass,
      stream,
      drop,
      pourHand,
      drinkHand,
      phase: 'idle',
      dead: false,
      yaw: 0,
      desiredYaw: 0,
      t0: 0,
      dur: 0
    }
    this.animate3D()
  },

  animate3D() {
    const W = this.world
    const C = this.canvas
    if (!W || W.dead) return

    W.yaw += (W.desiredYaw - W.yaw) * 0.07
    W.root.rotation.y = W.yaw

    if (W.phase === 'pour') {
      const t = clamp01((Date.now() - W.t0) / W.dur)
      const reach = smooth(t / 0.22)
      const retreat = smooth((1 - t) / 0.18)
      const hold = Math.min(reach, retreat)
      const tilt = smooth(clamp01((t - 0.12) / 0.20)) * smooth(clamp01((0.92 - t) / 0.18))

      W.bottle.rotation.z = -1.03 * tilt
      W.bottle.rotation.x = 0.08 * tilt
      W.bottle.position.set(-1.55 + 0.95 * hold, 0.03 + 0.64 * hold, 0.1 + 0.06 * hold)

      W.pourHand.visible = hold > 0.05
      W.pourHand.position.set(-2.45 + 1.15 * hold, 1.55 + 0.42 * hold, 0.18)
      W.pourHand.rotation.z = -0.25 - 0.55 * tilt

      const flowing = t > 0.28 && t < 0.82
      W.stream.visible = flowing
      if (flowing) {
        W.stream.position.set(0.08, 1.62, 0.12)
        W.stream.rotation.z = -0.54
        W.stream.scale.y = 0.93 + Math.sin(Date.now() * 0.025) * 0.04
      }

      const fill = clamp01((t - 0.28) / 0.50)
      this.setLiquid(W.start + (W.target - W.start) * easeOut(fill))

      const ice = W.glass.userData.ice || []
      if (flowing && ice.length) {
        ice.forEach((cube, index) => {
          cube.rotation.x += 0.006 + index * 0.001
          cube.rotation.z += 0.004
          cube.position.y = 0.37 + Math.sin(Date.now() * 0.015 + index) * 0.025
        })
      }

      const tail = t > 0.82 && t < 0.90
      W.drop.visible = tail
      if (tail) {
        const dt = (t - 0.82) / 0.08
        W.drop.position.set(0.16 + dt * 0.1, 1.72 - dt * 0.86, 0.12)
        W.drop.scale.setScalar(1 - dt * 0.35)
      }

      if (t >= 1) {
        W.bottle.rotation.set(0, 0, 0)
        W.bottle.position.set(-1.55, 0.03, 0.1)
        W.stream.visible = false
        W.drop.visible = false
        W.pourHand.visible = false
        W.phase = 'idle'
      }
    } else if (W.phase === 'drink') {
      const t = clamp01((Date.now() - W.t0) / W.dur)
      const lift = t < 0.30 ? smooth(t / 0.30) : t < 0.72 ? 1 : smooth((1 - t) / 0.28)
      const drinkTilt = smooth(clamp01((t - 0.26) / 0.18)) * smooth(clamp01((0.80 - t) / 0.18))

      W.glass.position.set(1.05 - 0.82 * lift, 0.03 + 1.75 * lift, 0.18 + 0.72 * lift)
      W.glass.rotation.z = -0.92 * drinkTilt
      W.glass.rotation.x = 0.20 * drinkTilt

      W.drinkHand.visible = lift > 0.06
      W.drinkHand.position.set(1.95 - 1.05 * lift, 1.12 + 0.92 * lift, 0.40 + 0.38 * lift)
      W.drinkHand.rotation.z = 2.95 - 0.62 * drinkTilt

      if (t > 0.38 && t < 0.78) {
        const sip = clamp01((t - 0.38) / 0.40)
        this.setLiquid(Math.max(0, W.start - W.amount * easeOut(sip)))
      }
      this.updateLiquidWorldLevel()

      if (t >= 1) {
        W.glass.position.set(1.05, 0.03, 0.18)
        W.glass.rotation.set(0, 0, 0)
        W.drinkHand.visible = false
        this.setLiquid(Math.max(0, W.start - W.amount))
        this.updateLiquidWorldLevel()
        W.phase = 'idle'
      }
    }

    C.requestAnimationFrame(() => this.animate3D())
    W.renderer.render(W.scene, W.camera)
  },

  startPour() {
    const W = this.world
    const p = this.data.profile
    if (!W || W.phase !== 'idle' || this.data.busy) return
    if (p.requiresBartending && !this.data.cocktailCrafted) {
      this.goBartend()
      return
    }
    if (this.level > 0.12) {
      this.quote('杯里还有酒，先喝完再倒')
      return
    }

    W.phase = 'pour'
    W.t0 = Date.now()
    W.dur = Math.max(1900, p.pour.duration || 1800)
    W.start = this.level
    W.target = p.fillTarget || 0.75
    this.setData({ busy: true })
    audio.playSfx('pour')
    wx.vibrateShort({ type: 'light' })
    clearTimeout(this.at)
    this.at = setTimeout(() => {
      this.setData({ busy: false })
      this.quote(this.data.drink.id === 'whiskey' ? '琥珀色落进冰里，先闻香再喝' : (p.pour.caption || '倒好了'))
    }, W.dur + 120)
  },

  takeSip() {
    const W = this.world
    const d = this.data.drink
    const p = this.data.profile
    if (!W || W.phase !== 'idle' || this.data.busy || this.data.drunkValue >= 100) return
    if (this.level <= 0.04) {
      this.quote('先倒一杯')
      return
    }

    const amount = Math.min(0.32, 1 / d.sipsPerGlass + (d.abv >= 40 ? 0.05 : 0))
    const dur = Math.max(1450, p.motion.duration || 1200)
    W.phase = 'drink'
    W.t0 = Date.now()
    W.dur = dur
    W.start = this.level
    W.amount = amount

    const newValue = Math.min(100, this.data.drunkValue + (100 / d.sipsPerGlass) * d.drunkSpeed * 0.35)
    const level = getDrunkLevel(newValue)
    const br = this.breakdown[d.id] || { sips: 0, glasses: 0 }
    br.sips++
    this.breakdown[d.id] = br

    this.setData({
      busy: true,
      sips: this.data.sips + 1,
      drunkValue: Math.round(newValue),
      drunkStatus: level.status,
      drunkLevelColor: level.color
    })
    audio.playSfx('drink')
    clearTimeout(this.at)
    this.at = setTimeout(() => {
      if (this.level <= 0.04) {
        br.glasses++
        this.setData({ glasses: this.data.glasses + 1 })
      }
      this.setData({ busy: false })
      this.quote(getRandomQuote(newValue, d.id))
      if (newValue >= 100) setTimeout(() => this.finishDrinking(), 900)
    }, dur + 120)
  },

  switchDrink(e) {
    const index = Number(e.currentTarget.dataset.index)
    if (!Number.isFinite(index) || index === this.data.activeIndex || this.data.busy) return
    if (this.level > 0.04) {
      wx.showModal({
        title: '杯里还有酒',
        content: '换酒会撤下这一杯，确定换吗？',
        success: res => { if (res.confirm) this.applyDrink(index) }
      })
    } else {
      this.applyDrink(index)
    }
  },

  applyDrink(index) {
    const drink = DRINKS[index]
    const profile = getV7Profile(drink.id)
    if (!this.session.includes(drink.id)) this.session.push(drink.id)
    if (!this.breakdown[drink.id]) this.breakdown[drink.id] = { sips: 0, glasses: 0 }
    if (this.world) this.world.dead = true
    this.setData({
      drink,
      profile,
      activeIndex: index,
      cocktailCrafted: drink.id === 'cocktail' ? false : this.data.cocktailCrafted
    }, () => this.build3D())
    app.globalData.currentDrink = drink
    audio.playSfx('click')
    this.quote(`换成${drink.name} · ${profile.serving}`)
  },

  goBartend() {
    app.globalData.currentDrink = this.data.drink
    wx.navigateTo({ url: '/pages/bartend-3d/bartend-3d' })
  },

  toggleCabinet() {
    this.setData({ cabinetOpen: !this.data.cabinetOpen })
  },

  onTouchStart(e) {
    const t = e.touches && e.touches[0]
    if (!t) return
    const x = t.x == null ? (t.clientX == null ? t.pageX : t.clientX) : t.x
    this.tx = x || 0
    this.y0 = this.world ? this.world.desiredYaw || 0 : 0
  },

  onTouchMove(e) {
    const t = e.touches && e.touches[0]
    if (!t || !this.world) return
    const x = t.x == null ? (t.clientX == null ? t.pageX : t.clientX) : t.x
    this.world.desiredYaw = Math.max(-0.48, Math.min(0.48, this.y0 + ((x || 0) - this.tx) / 220))
  },

  quote(text) {
    clearTimeout(this.qt)
    this.setData({ currentQuote: text, quoteVisible: true })
    this.qt = setTimeout(() => this.setData({ quoteVisible: false }), 2800)
  },

  finishDrinking() {
    const stats = app.globalData.stats
    stats.totalSips += this.data.sips
    stats.totalDrinks += this.data.glasses
    stats.maxDrunkLevel = Math.max(stats.maxDrunkLevel, this.data.drunkValue)
    stats.drinkRecords = stats.drinkRecords || []
    Object.keys(this.breakdown).forEach(id => {
      const x = this.breakdown[id]
      if (x.sips || x.glasses) {
        stats.drinkRecords.push({
          drinkId: id,
          sips: x.sips,
          glasses: x.glasses,
          drunkLevel: this.data.drunkValue,
          time: Date.now()
        })
      }
    })
    const achievements = checkAchievements(stats)
    app.saveStats()
    app.globalData.finishData = {
      drink: this.data.drink,
      sips: this.data.sips,
      glasses: this.data.glasses,
      drunkValue: this.data.drunkValue,
      breakdown: this.breakdown,
      newAchievements: achievements
    }
    wx.redirectTo({ url: '/pages/result/result' })
  },

  onShareAppMessage() {
    return {
      title: `我正在 3D 赛博酒桌喝${this.data.drink.name}`,
      path: `/pages/drink-3d/drink-3d?id=${this.data.drink.id}`
    }
  }
})
