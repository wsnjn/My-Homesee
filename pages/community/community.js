// pages/community/community.js
const { request } = require('../../utils/request')

Page({
  data: {
    user: null,
    conversations: [],
    unreadTotal: 0
  },

  onShow() {
    const user = wx.getStorageSync('user') || null
    this.setData({ user })
    this.loadConversationList()
  },

  async loadConversationList() {
    const { user } = this.data
    if (!user || !user.id) {
      this.setData({ conversations: [], unreadTotal: 0 })
      return
    }

    try {
      const groupRes = await request({
        url: `/api/community/groups/user/${user.id}`,
        method: 'GET'
      })
      const groups = groupRes && groupRes.success ? (groupRes.data || []) : []

      const conversations = await Promise.all(groups.map(async (g) => {
        let lastText = '暂无消息'
        let lastTime = ''
        try {
          const msgRes = await request({
            url: `/api/community/messages/group/${g.id}`,
            method: 'GET'
          })
          if (msgRes && msgRes.success && Array.isArray(msgRes.data) && msgRes.data.length) {
            const last = msgRes.data[msgRes.data.length - 1]
            lastText = last.msgType === 1 ? '[图片]' : (last.content || '新消息')
            lastTime = this.formatTime(last.createdTime)
          }
        } catch (e) {}

        return {
          id: g.id,
          title: g.displayName || g.groupName || '消息',
          avatar: this.getAvatarUrl(g.displayAvatar),
          lastText,
          lastTime,
          unread: 0
        }
      }))

      this.setData({
        conversations,
        unreadTotal: conversations.reduce((n, i) => n + (i.unread || 0), 0)
      })
    } catch (e) {
      this.setData({ conversations: [], unreadTotal: 0 })
    }
  },

  openChat(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    wx.navigateTo({
      url: `/packageD/pages/chat-area/chat-area?groupId=${item.id}&title=${encodeURIComponent(item.title || '消息')}`
    })
  },

  goHouseSelection() {
    wx.switchTab({ url: '/pages/house-selection/house-selection' })
  },

  goFriendCircle() {
    wx.navigateTo({ url: '/packageD/pages/friend-circle/friend-circle' })
  },

  getAvatarUrl(fileName) {
    if (!fileName) return 'https://files.homesee.xyz/api/files/download/default-avatar.png'
    if (String(fileName).startsWith('http')) return fileName
    return `https://files.homesee.xyz/api/files/download/${fileName}`
  },

  formatTime(str) {
    if (!str) return ''
    const date = new Date(str)
    if (Number.isNaN(date.getTime())) return ''
    const h = String(date.getHours()).padStart(2, '0')
    const m = String(date.getMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
})