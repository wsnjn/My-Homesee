Page({
  data: {
    user: null,
    menuList: [
      { key: 'appointments', text: '我的申请', sub: '看房与合同进度', icon: 'empty', tint: 'linear-gradient(145deg,#ecfdf5,#d1fae5)' },
      { key: 'favorites', text: '我的收藏', sub: '心动房源一键回顾', icon: 'heart', tint: 'linear-gradient(145deg,#fef2f2,#fecaca)' },
      { key: 'history', text: '浏览记录', sub: '最近看过的房间', icon: 'clock', tint: 'linear-gradient(145deg,#eff6ff,#dbeafe)' },
      { key: 'service', text: '联系客服', sub: '人工与电话支持', icon: 'message', tint: 'linear-gradient(145deg,#fff7ed,#ffedd5)' },
      { key: 'privacy', text: '隐私协议', sub: '数据与授权说明', icon: 'lock', tint: 'linear-gradient(145deg,#f5f3ff,#ede9fe)' }
    ]
  },

  onShow() {
    const user = wx.getStorageSync('user') || null
    this.setData({ user })
  },

  goProfile() {
    wx.navigateTo({ url: '/packageB/pages/user-profile/user-profile' })
  },

  onMenuTap(e) {
    const { key } = e.currentTarget.dataset
    if (key === 'appointments') {
      wx.navigateTo({ url: '/packageB/pages/my-appointments/my-appointments' })
      return
    }
    if (key === 'privacy') {
      wx.navigateTo({ url: '/pages/legal/privacy-policy' })
      return
    }
    if (key === 'service') {
      wx.showModal({
        title: '联系客服',
        content: '客服电话：13429858256',
        showCancel: false
      })
      return
    }
    if (key === 'favorites') {
      this.openLocalList('favorite_houses', '暂无收藏')
      return
    }
    if (key === 'history') {
      this.openLocalList('browse_history', '暂无浏览记录')
      return
    }
    wx.showToast({ title: '功能开发中', icon: 'none' })
  },

  openLocalList(storageKey, emptyText) {
    const list = wx.getStorageSync(storageKey) || []
    if (!list.length) {
      wx.showToast({ title: emptyText, icon: 'none' })
      return
    }
    const itemList = list.slice(0, 8).map(i => `${i.title || '房源'} ${i.rentPrice ? `¥${i.rentPrice}` : ''}`)
    wx.showActionSheet({
      itemList,
      success: (res) => {
        const item = list[res.tapIndex]
        if (!item || !item.id) return
        wx.navigateTo({
          url: `/pages/house-detail/house-detail?houseId=${item.id}`
        })
      }
    })
  },

  logout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (!res.confirm) return
        wx.removeStorageSync('user')
        wx.removeStorageSync('token')
        this.setData({ user: null })
        wx.reLaunch({ url: '/pages/login/login' })
      }
    })
  }
})
