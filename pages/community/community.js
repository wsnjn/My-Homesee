// pages/community/community.js
const { request } = require('../../utils/request');
const app = getApp();

Page({
  data: {
    currentTab: 'chat',
    chatTab: 'groups',
    feedFilter: 'all',

    userInfo: null,
    userId: null,

    groups: [],
    friends: [],
    pendingRequests: [],
    activeGroup: null,
    messages: [],
    newMessage: '',
    scrollToMessage: '',

    posts: [],
    page: 0,
    size: 10,
    loading: false,
    hasMore: true,

    showGroupModal: false,
    showFriendModal: false,
    showPostModal: false,
    newGroupName: '',
    newGroupAnnouncement: '',
    friendPhone: '',
    newPostContent: '',
    postVisibility: 0, // 0: public, 1: friends

    userInfoCache: {}
  },

  pollTimer: null,

  onLoad(options) {
    this.checkLogin();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadData();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  checkLogin() {
    const user = wx.getStorageSync('user');
    if (user) {
      this.setData({
        userInfo: {
          ...user,
          avatarUrl: this.getAvatarUrl(user.avatar)
        },
        userId: user.id
      });
      // 缓存当前用户信息
      const cache = {};
      cache[user.id] = user;
      this.setData({ userInfoCache: cache });
    }
  },

  loadData() {
    if (this.data.currentTab === 'chat') {
      this.loadGroups();
      this.loadFriends();
      this.loadPendingRequests();
      this.startPolling();
    } else {
      this.stopPolling();
      this.loadPosts(true);
    }
  },

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (this.data.currentTab === 'chat') {
        this.loadGroups();
        this.loadFriends();
        this.loadPendingRequests();
        if (this.data.activeGroup) {
          this.loadMessages(this.data.activeGroup.id);
        }
      }
    }, 5000);
  },

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab,
      activeGroup: null,
      posts: [],
      page: 0,
      hasMore: true
    });
    this.loadData();
  },

  switchChatTab(e) {
    this.setData({ chatTab: e.currentTarget.dataset.tab });
  },

  // ========== 聊天功能 ==========

  async loadGroups() {
    if (!this.data.userId) return;
    try {
      const res = await request({
        url: `/api/community/groups/user/${this.data.userId}`,
        method: 'GET'
      });
      if (res.success) {
        const groups = (res.data || []).map(g => {
          if (g.groupType === 3 && g.displayAvatar) {
            return { ...g, displayAvatar: this.getAvatarUrl(g.displayAvatar) };
          }
          return g;
        });
        this.setData({ groups });
      }
    } catch (e) {
      console.error('加载群组失败', e);
    }
  },

  async loadFriends() {
    if (!this.data.userId) return;
    try {
      const res = await request({
        url: `/api/community/friends/${this.data.userId}`,
        method: 'GET'
      });
      if (res.success) {
        const friends = (res.data || []).map(f => ({
          ...f,
          avatarUrl: this.getAvatarUrl(f.avatar)
        }));
        // 将好友信息缓存到 userInfoCache，聊天消息可直接使用
        const cache = { ...this.data.userInfoCache };
        friends.forEach(f => {
          if (f.friendId) {
            cache[f.friendId] = {
              username: f.username,
              avatar: f.avatar,
              realName: f.realName
            };
          }
        });
        this.setData({ friends, userInfoCache: cache });
      }
    } catch (e) {
      console.error('加载好友失败', e);
    }
  },

  async loadPendingRequests() {
    if (!this.data.userId) return;
    try {
      const res = await request({
        url: `/api/community/friends/pending/${this.data.userId}`,
        method: 'GET'
      });
      if (res.success) {
        this.setData({ pendingRequests: res.data || [] });
      }
    } catch (e) {
      console.error('加载好友申请失败', e);
    }
  },

  selectGroup(e) {
    const group = e.currentTarget.dataset.group;
    this.setData({ activeGroup: group });
    this.loadMessages(group.id);
  },

  closeChat() {
    this.setData({ activeGroup: null, messages: [] });
  },

  async loadMessages(groupId) {
    try {
      const res = await request({
        url: `/api/community/messages/group/${groupId}`,
        method: 'GET'
      });
      if (res.success) {
        const rawMessages = res.data || [];

        // 获取所有发送者ID
        const senderIds = [...new Set(rawMessages.map(m => m.senderId))];

        // 获取用户信息
        await this.fetchUsersInfo(senderIds);

        // 构建消息列表
        const messages = rawMessages.map(msg => {
          const userInfo = this.data.userInfoCache[msg.senderId];
          return {
            ...msg,
            senderAvatar: userInfo ? this.getAvatarUrl(userInfo.avatar) : '/images/models/default-avatar.png',
            senderName: userInfo ? (userInfo.username || userInfo.realName || '用户') : '用户',
            formattedTime: this.formatTime(msg.createdTime)
          };
        });

        this.setData({
          messages,
          scrollToMessage: messages.length > 0 ? `msg-${messages[messages.length - 1].id}` : ''
        });
      }
    } catch (e) {
      console.error('加载消息失败', e);
    }
  },

  async fetchUsersInfo(userIds) {
    const uncached = userIds.filter(id => !this.data.userInfoCache[id]);
    if (uncached.length === 0) return;

    const cache = { ...this.data.userInfoCache };

    for (const userId of uncached) {
      try {
        const res = await request({
          url: `/api/user/${userId}`,
          method: 'GET'
        });
        console.log('获取用户信息:', userId, res);

        // 处理不同的响应格式
        if (res.success && res.user) {
          cache[userId] = res.user;
        } else if (res.id) {
          cache[userId] = res;
        } else if (res.data) {
          cache[userId] = res.data;
        }
      } catch (e) {
        console.error('获取用户信息失败', userId, e);
      }
    }

    this.setData({ userInfoCache: cache });
  },

  onMessageInput(e) {
    this.setData({ newMessage: e.detail.value });
  },

  async sendMessage() {
    if (!this.data.newMessage.trim() || !this.data.activeGroup) return;

    try {
      const res = await request({
        url: '/api/community/messages/send',
        method: 'POST',
        data: {
          senderId: this.data.userId,
          groupId: this.data.activeGroup.id,
          content: this.data.newMessage,
          msgType: 0
        }
      });

      if (res.success) {
        const newMsg = {
          ...res.data,
          senderAvatar: this.data.userInfo.avatarUrl,
          senderName: this.data.userInfo.realName || this.data.userInfo.username || '我',
          formattedTime: this.formatTime(res.data.createdTime)
        };
        const messages = [...this.data.messages, newMsg];
        this.setData({
          messages,
          newMessage: '',
          scrollToMessage: `msg-${res.data.id}`
        });
      }
    } catch (e) {
      console.error('发送消息失败', e);
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },

  async startPrivateChat(e) {
    const friend = e.currentTarget.dataset.friend;
    try {
      const res = await request({
        url: '/api/community/groups/private',
        method: 'POST',
        data: { userId: this.data.userId, friendId: friend.friendId }
      });
      if (res.success) {
        const groups = [...this.data.groups];
        const exists = groups.find(g => g.id === res.data.id);
        if (!exists) {
          groups.push(res.data);
        }
        this.setData({
          groups,
          activeGroup: res.data,
          chatTab: 'groups'
        });
        this.loadMessages(res.data.id);
      }
    } catch (e) {
      console.error('创建私聊失败', e);
    }
  },

  async respondRequest(e) {
    const { id, status } = e.currentTarget.dataset;
    try {
      const res = await request({
        url: '/api/community/friends/respond',
        method: 'POST',
        data: { requestId: id, status: parseInt(status) }
      });
      if (res.success) {
        this.loadPendingRequests();
        if (status == 1) this.loadFriends();
        wx.showToast({ title: status == 1 ? '已接受' : '已拒绝', icon: 'success' });
      }
    } catch (e) {
      console.error('处理好友申请失败', e);
    }
  },

  showCreateGroup() {
    this.setData({ showGroupModal: true });
  },

  onGroupNameInput(e) {
    this.setData({ newGroupName: e.detail.value });
  },

  onGroupAnnouncementInput(e) {
    this.setData({ newGroupAnnouncement: e.detail.value });
  },

  async createGroup() {
    if (!this.data.newGroupName.trim()) {
      wx.showToast({ title: '请输入群组名称', icon: 'none' });
      return;
    }

    try {
      const res = await request({
        url: '/api/community/groups/create',
        method: 'POST',
        data: {
          groupName: this.data.newGroupName,
          announcement: this.data.newGroupAnnouncement,
          ownerId: this.data.userId,
          groupType: 0
        }
      });

      if (res.success) {
        const groups = [...this.data.groups, res.data];
        this.setData({
          groups,
          showGroupModal: false,
          newGroupName: '',
          newGroupAnnouncement: ''
        });
        wx.showToast({ title: '创建成功', icon: 'success' });
      }
    } catch (e) {
      console.error('创建群组失败', e);
      wx.showToast({ title: '创建失败', icon: 'none' });
    }
  },

  showAddFriend() {
    this.setData({ showFriendModal: true });
  },

  onFriendPhoneInput(e) {
    this.setData({ friendPhone: e.detail.value });
  },

  async sendFriendRequest() {
    if (!this.data.friendPhone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }

    try {
      const searchRes = await request({
        url: `/api/user/search/phone?phone=${this.data.friendPhone}`,
        method: 'GET'
      });

      if (!searchRes.success || !searchRes.user) {
        wx.showToast({ title: '未找到该用户', icon: 'none' });
        return;
      }

      if (searchRes.user.id === this.data.userId) {
        wx.showToast({ title: '不能添加自己', icon: 'none' });
        return;
      }

      const res = await request({
        url: '/api/community/friends/request',
        method: 'POST',
        data: { userId: this.data.userId, friendId: searchRes.user.id }
      });

      if (res.success) {
        this.setData({ showFriendModal: false, friendPhone: '' });
        wx.showToast({ title: '请求已发送', icon: 'success' });
      } else {
        wx.showToast({ title: res.message || '发送失败', icon: 'none' });
      }
    } catch (e) {
      console.error('添加好友失败', e);
      wx.showToast({ title: '请求失败', icon: 'none' });
    }
  },

  hideModal() {
    this.setData({
      showGroupModal: false,
      showFriendModal: false,
      showPostModal: false
    });
  },

  preventBubble() {
    // 阻止事件冒泡
  },

  // ========== 帖子功能 ==========

  onPostContentInput(e) {
    this.setData({ newPostContent: e.detail.value });
  },

  setPostVisibility(e) {
    const visibility = e.currentTarget.dataset.value;
    this.setData({ postVisibility: parseInt(visibility) });
  },

  async publishPost() {
    if (!this.data.newPostContent.trim()) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }

    try {
      const res = await request({
        url: '/api/community/posts/create',
        method: 'POST',
        data: {
          userId: this.data.userId,
          content: this.data.newPostContent,
          visibility: this.data.postVisibility,
          mediaUrls: JSON.stringify([]) // TODO: Support image upload
        }
      });

      if (res.success) {
        this.setData({
          showPostModal: false,
          newPostContent: '',
          postVisibility: 0
        });
        wx.showToast({ title: '发布成功', icon: 'success' });
        this.loadPosts(true);
      }
    } catch (e) {
      console.error('发布帖子失败', e);
      wx.showToast({ title: '发布失败', icon: 'none' });
    }
  },

  async loadPosts(reset = false) {
    if (this.data.loading || (!reset && !this.data.hasMore)) return;

    this.setData({ loading: true });

    try {
      let url = `/api/community/posts/with-user-info`;
      if (this.data.userId) {
        url += `?userId=${this.data.userId}`;
      }

      const res = await request({ url, method: 'GET' });

      let posts = [];
      if (res.success && res.data) {
        posts = res.data.map(post => ({
          ...post,
          showComments: false,
          newComment: '',
          comments: [],
          avatarUrl: this.getAvatarUrl(post.avatar),
          mediaList: this.parseMediaUrls(post.mediaUrls),
          formattedTime: this.formatPostTime(post.createdTime)
        }));
      }

      if (this.data.currentTab === 'feed') {
        posts = posts.filter(p => p.visibility === 0);
      }

      if (this.data.feedFilter === 'popular') {
        posts.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));
      }

      this.setData({ posts, hasMore: false, loading: false });

    } catch (error) {
      console.error('加载帖子失败', error);
      this.setData({ loading: false });
    }
  },

  toggleFilter() {
    const newFilter = this.data.feedFilter === 'all' ? 'popular' : 'all';
    this.setData({ feedFilter: newFilter });
    this.loadPosts(true);
  },

  async toggleLike(e) {
    const { id, index } = e.currentTarget.dataset;
    if (!this.data.userId) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    try {
      const res = await request({
        url: `/api/community/posts/${id}/like`,
        method: 'POST',
        data: { userId: this.data.userId }
      });

      if (res.success) {
        const posts = [...this.data.posts];
        posts[index].liked = res.isLiked;
        posts[index].likeCount = (posts[index].likeCount || 0) + (res.isLiked ? 1 : -1);
        this.setData({ posts });
      }
    } catch (e) {
      console.error('点赞失败', e);
    }
  },

  async toggleComments(e) {
    const { id, index } = e.currentTarget.dataset;
    const posts = [...this.data.posts];
    posts[index].showComments = !posts[index].showComments;

    if (posts[index].showComments && (!posts[index].comments || posts[index].comments.length === 0)) {
      try {
        const res = await request({
          url: `/api/community/posts/${id}/comments`,
          method: 'GET'
        });
        if (res.success) {
          posts[index].comments = res.data || [];
        }
      } catch (e) {
        console.error('加载评论失败', e);
      }
    }

    this.setData({ posts });
  },

  onCommentInput(e) {
    const index = e.currentTarget.dataset.index;
    const posts = [...this.data.posts];
    posts[index].newComment = e.detail.value;
    this.setData({ posts });
  },

  async submitComment(e) {
    const index = e.currentTarget.dataset.index;
    const post = this.data.posts[index];

    if (!post.newComment || !post.newComment.trim()) {
      wx.showToast({ title: '请输入评论', icon: 'none' });
      return;
    }

    if (!this.data.userId) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    try {
      const res = await request({
        url: `/api/community/posts/${post.id}/comment`,
        method: 'POST',
        data: { userId: this.data.userId, content: post.newComment }
      });

      if (res.success) {
        const posts = [...this.data.posts];
        if (!posts[index].comments) posts[index].comments = [];
        posts[index].comments.push(res.data);
        posts[index].commentCount = (posts[index].commentCount || 0) + 1;
        posts[index].newComment = '';
        this.setData({ posts });
        wx.showToast({ title: '评论成功', icon: 'success' });
      }
    } catch (e) {
      console.error('评论失败', e);
      wx.showToast({ title: '评论失败', icon: 'none' });
    }
  },

  onPullDownRefresh() {
    this.loadData();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.currentTab !== 'chat') {
      this.loadPosts();
    }
  },

  handlePost() {
    if (!this.data.userInfo) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    this.setData({ showPostModal: true });
  },

  previewImage(e) {
    const { urls, current } = e.currentTarget.dataset;
    wx.previewImage({ current, urls });
  },

  // ========== 工具函数 ==========

  getAvatarUrl(avatarName) {
    console.log('getAvatarUrl input:', avatarName);
    if (!avatarName) return '/images/models/default-avatar.png';
    if (avatarName.startsWith('http')) return avatarName;
    const url = `https://files.homesee.xyz/api/files/download/${avatarName}`;
    console.log('getAvatarUrl output:', url);
    return url;
  },

  parseMediaUrls(mediaUrls) {
    if (!mediaUrls) return [];
    try {
      const parsed = JSON.parse(mediaUrls);
      if (Array.isArray(parsed)) {
        return parsed.map(url => this.buildFileUrl(url));
      }
    } catch (e) {
      if (mediaUrls) return [this.buildFileUrl(mediaUrls)];
    }
    return [];
  },

  buildFileUrl(filename) {
    if (!filename) return '';
    if (filename.startsWith('http')) return filename;
    return `https://files.homesee.xyz/api/files/download/${filename}`;
  },

  formatTime(str) {
    if (!str) return '';
    return new Date(str).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  },

  formatPostTime(str) {
    if (!str) return '';
    const date = new Date(str);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
});