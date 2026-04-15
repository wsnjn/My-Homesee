const { request, uploadFile } = require('../../../utils/request')

const FILE_DOWNLOAD = 'https://files.homesee.xyz/api/files/download'

Page({
  data: {
    user: null,
    composerAvatar: 'https://files.homesee.xyz/api/files/download/default-avatar.png',
    friends: [],
    friendIds: [],
    posts: [],
    filteredPosts: [],
    feedFilterIndex: 0,
    feedFilters: ['全部动态', '只看好友'],
    newPostContent: '',
    visibilityIndex: 0,
    visibilityOptions: ['公开', '仅好友'],
    hasActiveLease: false,
    submitting: false,
    previewImage: '',
    previewType: '',
    userNames: {}
  },

  onLoad() {
    const user = wx.getStorageSync('user') || null
    this.setData({
      user,
      composerAvatar: this.getAvatarUrl(user && user.avatar)
    })
  },

  onShow() {
    const user = wx.getStorageSync('user') || null
    this.setData({
      user,
      composerAvatar: this.getAvatarUrl(user && user.avatar)
    })
    this.bootstrap()
  },

  onPullDownRefresh() {
    this.bootstrap().finally(() => wx.stopPullDownRefresh())
  },

  async bootstrap() {
    await this.checkLease()
    await this.fetchFriends()
    await this.fetchPosts()
    this.applyFilter()
  },

  async checkLease() {
    const { user } = this.data
    if (!user || !user.id) {
      this.setData({ hasActiveLease: false })
      return
    }
    try {
      const res = await request({
        url: `/api/admin/tenant/tenant/${user.id}`,
        method: 'GET',
        silent: true
      })
      if (res && res.success && Array.isArray(res.contracts)) {
        const active = res.contracts.find(
          (c) => c.contractStatus === 1 || c.contractStatus === 2
        )
        this.setData({ hasActiveLease: !!active })
      } else {
        this.setData({ hasActiveLease: false })
      }
    } catch (e) {
      this.setData({ hasActiveLease: false })
    }
  },

  async fetchFriends() {
    const { user } = this.data
    if (!user || !user.id) {
      this.setData({ friends: [], friendIds: [] })
      return
    }
    try {
      const res = await request({
        url: `/api/community/friends/${user.id}`,
        method: 'GET'
      })
      const list = res && res.success && Array.isArray(res.data) ? res.data : []
      const friendIds = list.map((f) => f.friendId)
      this.setData({ friends: list, friendIds })
    } catch (e) {
      this.setData({ friends: [], friendIds: [] })
    }
  },

  async fetchPosts() {
    const { user } = this.data
    const uid = user && user.id ? user.id : ''
    try {
      const res = await request({
        url: `/api/community/posts/with-user-info?userId=${uid}`,
        method: 'GET'
      })
      if (!res || !res.success || !Array.isArray(res.data)) {
        this.setData({ posts: [] })
        return
      }
      const posts = res.data.map((p) => this.normalizePost(p))
      this.setData({ posts })
    } catch (e) {
      this.setData({ posts: [] })
    }
  },

  normalizePost(p) {
    const liked = p.liked !== undefined ? !!p.liked : !!p.isLiked
    const mediaList = this.parseMediaUrls(p.mediaUrls).map((u) => ({
      url: this.buildFileUrl(u),
      raw: u,
      isImage: this.isImage(u),
      isVideo: this.isVideo(u)
    }))
    return {
      ...p,
      liked,
      displayName: p.username ? p.username : `用户${p.userId}`,
      avatarUrl: this.getAvatarUrl(p.avatar),
      mediaList,
      showComments: false,
      newComment: '',
      comments: [],
      timeText: this.formatTime(p.createdTime)
    }
  },

  parseMediaUrls(mediaUrls) {
    if (!mediaUrls) return []
    try {
      const parsed = JSON.parse(mediaUrls)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch (e) {}
    return [mediaUrls]
  },

  buildFileUrl(name) {
    if (!name) return ''
    if (String(name).startsWith('http')) return name
    return `${FILE_DOWNLOAD}/${name}`
  },

  getAvatarUrl(fileName) {
    if (!fileName) return `${FILE_DOWNLOAD}/default-avatar.png`
    if (String(fileName).startsWith('http')) return fileName
    return `${FILE_DOWNLOAD}/${fileName}`
  },

  isImage(url) {
    if (!url) return false
    return /\.(jpe?g|png|gif|webp|bmp)$/i.test(url) || String(url).includes('unsplash')
  },

  isVideo(url) {
    if (!url) return false
    return /\.(mp4|webm|mov|m4v)$/i.test(url)
  },

  formatTime(str) {
    if (!str) return ''
    const date = new Date(str)
    if (Number.isNaN(date.getTime())) return ''
    const now = Date.now()
    const diff = now - date.getTime()
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    const m = date.getMonth() + 1
    const d = date.getDate()
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${m}月${d}日 ${h}:${min}`
  },

  onFeedFilterChange(e) {
    const feedFilterIndex = Number(e.detail.value) || 0
    this.setData({ feedFilterIndex })
    this.applyFilter()
  },

  onVisibilityChange(e) {
    this.setData({ visibilityIndex: Number(e.detail.value) || 0 })
  },

  onPostInput(e) {
    this.setData({ newPostContent: e.detail.value || '' })
  },

  applyFilter() {
    const { posts, user, friendIds, feedFilterIndex } = this.data
    const uid = user && user.id
    const onlyFriends = feedFilterIndex === 1
    const filtered = posts.filter((post) => {
      const isSelf = post.userId === uid
      const isFriend = friendIds.includes(post.userId)
      if (!isSelf && !isFriend) return false
      if (onlyFriends) return isFriend
      return true
    })
    this.setData({ filteredPosts: filtered })
  },

  chooseImage() {
    if (!this.data.hasActiveLease) {
      wx.showToast({ title: '住户签约后可发动态', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0]
        if (!f) return
        this.setData({
          previewImage: f.tempFilePath,
          previewType: 'image'
        })
      }
    })
  },

  chooseVideo() {
    if (!this.data.hasActiveLease) {
      wx.showToast({ title: '住户签约后可发动态', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      sourceType: ['album', 'camera'],
      maxDuration: 60,
      success: (res) => {
        const f = res.tempFiles && res.tempFiles[0]
        if (!f) return
        this.setData({
          previewImage: f.tempFilePath,
          previewType: 'video'
        })
      }
    })
  },

  clearPreview() {
    this.setData({ previewImage: '', previewType: '' })
  },

  async submitPost() {
    const {
      user,
      newPostContent,
      previewImage,
      visibilityIndex,
      hasActiveLease,
      submitting
    } = this.data
    const text = (newPostContent || '').trim()
    if (!hasActiveLease) {
      wx.showToast({ title: '仅限住户发布', icon: 'none' })
      return
    }
    if (!text && !previewImage) {
      wx.showToast({ title: '请输入文字或选择图片', icon: 'none' })
      return
    }
    if (!user || !user.id) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (submitting) return

    this.setData({ submitting: true })
    try {
      let mediaUrls = ''
      if (previewImage) {
        wx.showLoading({ title: '上传中', mask: true })
        const up = await uploadFile({
          url: '/api/community/upload',
          filePath: previewImage,
          name: 'file'
        })
        wx.hideLoading()
        if (!up || !up.success || !up.filename) {
          wx.showToast({ title: (up && up.message) || '上传失败', icon: 'none' })
          return
        }
        mediaUrls = up.filename
      }

      const res = await request({
        url: '/api/community/posts/create',
        method: 'POST',
        data: {
          userId: user.id,
          content: text,
          mediaUrls,
          visibility: visibilityIndex
        }
      })
      if (res && res.success && res.data) {
        const merged = {
          ...res.data,
          username: user.username,
          avatar: user.avatar,
          likeCount: res.data.likeCount != null ? res.data.likeCount : 0,
          commentCount: res.data.commentCount != null ? res.data.commentCount : 0,
          liked: false
        }
        const row = this.normalizePost(merged)
        const posts = [row, ...this.data.posts]
        this.setData({
          posts,
          newPostContent: '',
          previewImage: '',
          previewType: ''
        })
        this.applyFilter()
        wx.showToast({ title: '发布成功', icon: 'success' })
      } else {
        wx.showToast({ title: (res && res.message) || '发布失败', icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  async onToggleLike(e) {
    const id = Number(e.currentTarget.dataset.id)
    const { user } = this.data
    if (!user || !user.id) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    try {
      const res = await request({
        url: `/api/community/posts/${id}/like`,
        method: 'POST',
        data: { userId: user.id }
      })
      if (!res || !res.success) return
      const isLiked = !!res.isLiked
      const patch = (p) => {
        if (Number(p.id) !== id) return p
        let likeCount = Number(p.likeCount) || 0
        likeCount += isLiked ? 1 : -1
        if (likeCount < 0) likeCount = 0
        return { ...p, liked: isLiked, likeCount }
      }
      this.setData({
        posts: this.data.posts.map(patch),
        filteredPosts: this.data.filteredPosts.map(patch)
      })
    } catch (e) {}
  },

  async onToggleComments(e) {
    const id = Number(e.currentTarget.dataset.id)
    const index = Number(e.currentTarget.dataset.index)
    const filteredPosts = this.data.filteredPosts.map((p, i) => {
      if (i !== index) return { ...p, showComments: false }
      return { ...p, showComments: !p.showComments }
    })
    const cur = filteredPosts[index]
    this.setData({ filteredPosts })
    if (cur && cur.showComments && (!cur.comments || !cur.comments.length)) {
      await this.loadComments(id)
    }
    this.syncPostShowComments(id, cur && cur.showComments)
  },

  syncPostShowComments(postId, show) {
    const pid = Number(postId)
    const posts = this.data.posts.map((p) =>
      Number(p.id) === pid ? { ...p, showComments: !!show } : p
    )
    this.setData({ posts })
  },

  async loadComments(postId) {
    const pid = Number(postId)
    const idx = this.data.filteredPosts.findIndex((p) => Number(p.id) === pid)
    if (idx < 0) return
    try {
      const res = await request({
        url: `/api/community/posts/${postId}/comments`,
        method: 'GET'
      })
      const list = res && res.success && Array.isArray(res.data) ? res.data : []
      const enriched = await this.enrichCommentUsers(list)
      this.setData({ [`filteredPosts[${idx}].comments`]: enriched })
      const posts = this.data.posts.map((p) =>
        Number(p.id) === pid ? { ...p, comments: enriched } : p
      )
      this.setData({ posts })
    } catch (e) {}
  },

  async enrichCommentUsers(comments) {
    const out = []
    for (const c of comments) {
      const name = await this.getUserDisplayName(c.userId)
      out.push({ ...c, displayName: name })
    }
    return out
  },

  async getUserDisplayName(userId) {
    const { user, userNames } = this.data
    if (user && Number(user.id) === Number(userId)) return '我'
    if (userNames[userId]) return userNames[userId]
    const hit = this.data.friends.find((f) => f.friendId === userId)
    if (hit) {
      const n = hit.realName || hit.username || `用户${userId}`
      this.setData({ [`userNames.${userId}`]: n })
      return n
    }
    try {
      const res = await request({
        url: `/api/user/${userId}`,
        method: 'GET',
        silent: true
      })
      if (res && res.success && res.user) {
        const n =
          res.user.realName || res.user.username || `用户${userId}`
        this.setData({ [`userNames.${userId}`]: n })
        return n
      }
    } catch (e) {}
    return `用户${userId}`
  },

  onCommentInput(e) {
    const index = Number(e.currentTarget.dataset.index)
    const v = e.detail.value || ''
    this.setData({ [`filteredPosts[${index}].newComment`]: v })
  },

  async submitComment(e) {
    const id = Number(e.currentTarget.dataset.id)
    let index = e.currentTarget.dataset.index
    if (index !== undefined && index !== '') index = Number(index)
    else index = -1
    if (index < 0 || Number.isNaN(index)) {
      index = this.data.filteredPosts.findIndex((p) => Number(p.id) === id)
    }
    const { user, filteredPosts } = this.data
    if (!user || !user.id) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const post = filteredPosts[index]
    if (index < 0 || !post) {
      wx.showToast({ title: '操作失败', icon: 'none' })
      return
    }
    const content = (post.newComment || '').trim()
    if (!content) return
    try {
      const res = await request({
        url: `/api/community/posts/${id}/comment`,
        method: 'POST',
        data: { userId: user.id, content }
      })
      if (res && res.success && res.data) {
        const name = await this.getUserDisplayName(res.data.userId)
        const row = { ...res.data, displayName: name }
        const comments = [...(post.comments || []), row]
        const cc = (Number(post.commentCount) || 0) + 1
        this.setData({
          [`filteredPosts[${index}].comments`]: comments,
          [`filteredPosts[${index}].newComment`]: '',
          [`filteredPosts[${index}].commentCount`]: cc
        })
        const posts = this.data.posts.map((p) =>
          Number(p.id) === id ? { ...p, comments, commentCount: cc, newComment: '' } : p
        )
        this.setData({ posts })
      }
    } catch (e) {
      wx.showToast({ title: '评论失败', icon: 'none' })
    }
  },

  previewMedia(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ urls: [url], current: url })
  },

  onShareAppMessage() {
    return {
      title: 'Homesee 朋友圈',
      path: '/packageD/pages/friend-circle/friend-circle'
    }
  }
})
