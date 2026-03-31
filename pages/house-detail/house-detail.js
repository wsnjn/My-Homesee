const { request } = require('../../utils/request')

Page({
  data: {
    houseId: '',
    house: null,
    loading: true,
    imageList: [],
    current: 0,
    isFavorite: false
  },

  onLoad(options) {
    const houseId = options.houseId || options.id
    if (!houseId) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.setData({ houseId })
    this.syncFavoriteStatus(houseId)
    this.recordHistory(houseId)
    this.loadDetail(houseId)
  },

  async loadDetail(houseId) {
    this.setData({ loading: true })
    try {
      const res = await request({
        url: `/api/room-info/${houseId}`,
        method: 'GET'
      })

      const room = res && res.success ? res.room : null
      if (!room) {
        throw new Error('房源不存在')
      }

      const imageList = await this.loadImages(houseId, room)
      this.setData({
        house: room,
        imageList,
        loading: false
      })
      this.recordHistory(houseId, room)
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  async loadImages(houseId, room) {
    try {
      const imgRes = await request({
        url: `/api/house-images/${houseId}`,
        method: 'GET'
      })
      if (imgRes && imgRes.success && Array.isArray(imgRes.data) && imgRes.data.length) {
        return imgRes.data.map(i => i.imageUrl).filter(Boolean)
      }
    } catch (e) {}

    const fallback = []
    if (room.coverImage) fallback.push(room.coverImage)
    if (!fallback.length) fallback.push('https://files.homesee.xyz/api/files/download/客厅.jpg')
    return fallback
  },

  onSwiperChange(e) {
    this.setData({ current: e.detail.current })
  },

  makeAppointment() {
    const { house } = this.data
    if (!house || house.status !== 0) {
      wx.showToast({ title: '该房源已下架', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/packageB/pages/appointment/appointment?houseId=${house.id}`
    })
  },

  callLandlord() {
    const phone = this.data.house && this.data.house.landlordPhone
    if (!phone) {
      wx.showToast({ title: '暂无联系方式', icon: 'none' })
      return
    }
    wx.makePhoneCall({ phoneNumber: String(phone) })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  },

  goBack() {
    wx.navigateBack()
  },

  syncFavoriteStatus(houseId) {
    const list = wx.getStorageSync('favorite_houses') || []
    const found = list.some(i => String(i.id) === String(houseId))
    this.setData({ isFavorite: found })
  },

  toggleFavorite() {
    const { house, houseId, isFavorite } = this.data
    const list = wx.getStorageSync('favorite_houses') || []
    if (isFavorite) {
      const next = list.filter(i => String(i.id) !== String(houseId))
      wx.setStorageSync('favorite_houses', next)
      this.setData({ isFavorite: false })
      wx.showToast({ title: '已取消收藏', icon: 'none' })
      return
    }
    const item = {
      id: houseId,
      title: house ? `${house.communityName || ''}${house.doorNumber || ''}` : '房源',
      rentPrice: house ? house.rentPrice : '',
      coverImage: this.data.imageList[0] || '',
      ts: Date.now()
    }
    wx.setStorageSync('favorite_houses', [item, ...list.filter(i => String(i.id) !== String(houseId))])
    this.setData({ isFavorite: true })
    wx.showToast({ title: '收藏成功', icon: 'success' })
  },

  shareHouse() {
    wx.showShareMenu({ withShareTicket: true })
    wx.showToast({ title: '可使用右上角分享', icon: 'none' })
  },

  recordHistory(houseId, house) {
    if (!houseId) return
    const list = wx.getStorageSync('browse_history') || []
    const item = {
      id: houseId,
      title: house ? `${house.communityName || ''}${house.doorNumber || ''}` : '房源',
      rentPrice: house ? house.rentPrice : '',
      coverImage: house && house.coverImage ? house.coverImage : (this.data.imageList[0] || ''),
      ts: Date.now()
    }
    const next = [item, ...list.filter(i => String(i.id) !== String(houseId))].slice(0, 100)
    wx.setStorageSync('browse_history', next)
  },

  formatLayout(house) {
    if (!house) return ''
    if (house.rentalType === 0) return '整租'
    if (house.rentalType === 1) return '合租'
    return '单间'
  }
  ,
  onShareAppMessage() {
    const h = this.data.house || {}
    return {
      title: `${h.communityName || '房源'} ${h.rentPrice ? `¥${h.rentPrice}/月` : ''}`,
      path: `/pages/house-detail/house-detail?houseId=${this.data.houseId}`
    }
  }
})
