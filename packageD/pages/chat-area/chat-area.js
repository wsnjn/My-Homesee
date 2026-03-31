const { request } = require('../../../utils/request')

Page({
  data: {
    groupId: '',
    title: '聊天',
    user: null,
    messages: [],
    inputText: '',
    loading: false,
    scrollTo: ''
  },

  onLoad(options) {
    const user = wx.getStorageSync('user') || null
    const groupId = options.groupId || ''
    const title = options.title ? decodeURIComponent(options.title) : '聊天'
    this.setData({ user, groupId, title })
    wx.setNavigationBarTitle({ title })
    this.loadMessages()
  },

  onShow() {
    this.loadMessages()
  },

  async loadMessages() {
    const { groupId } = this.data
    if (!groupId) return
    this.setData({ loading: true })
    try {
      const res = await request({
        url: `/api/community/messages/group/${groupId}`,
        method: 'GET'
      })
      const list = (res && res.success && Array.isArray(res.data)) ? res.data : []
      const messages = list.map(m => ({
        ...m,
        isSelf: this.data.user && m.senderId === this.data.user.id,
        timeText: this.formatTime(m.createdTime)
      }))
      const last = messages[messages.length - 1]
      this.setData({
        messages,
        scrollTo: last ? `msg-${last.id}` : ''
      })
    } catch (e) {
      wx.showToast({ title: '消息加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value || '' })
  },

  async sendMessage() {
    const { inputText, user, groupId } = this.data
    const text = (inputText || '').trim()
    if (!text) return
    if (!user || !user.id) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    try {
      const res = await request({
        url: '/api/community/messages/send',
        method: 'POST',
        data: {
          senderId: user.id,
          groupId: Number(groupId),
          content: text,
          msgType: 0
        }
      })
      if (res && res.success && res.data) {
        const item = {
          ...res.data,
          isSelf: true,
          timeText: this.formatTime(res.data.createdTime)
        }
        const messages = [...this.data.messages, item]
        this.setData({
          messages,
          inputText: '',
          scrollTo: `msg-${item.id}`
        })
        return
      }
      wx.showToast({ title: '发送失败', icon: 'none' })
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' })
    }
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