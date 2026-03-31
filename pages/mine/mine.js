Page({
  data: {
    user: null,
    menuList: [
      { key: 'appointments', text: '我的申请' },
      { key: 'favorites', text: '我的收藏' },
      { key: 'history', text: '浏览记录' },
      { key: 'service', text: '联系客服' },
      { key: 'privacy', text: '隐私协议' }
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
        content: '客服电话：400-123-4567',
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
