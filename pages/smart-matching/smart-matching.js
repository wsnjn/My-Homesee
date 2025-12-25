// pages/smart-matching/smart-matching.js
const { request } = require('../../utils/request');

Page({
  data: {
    user: null,
    messages: [],
    userInput: '',
    loading: false,
    scrollTop: 0,
    avatarUrl: 'https://files.homesee.xyz/api/files/download/default-avatar.png'
  },

  onLoad() {
    this.checkLoginStatus();
  },

  onShow() {
    // Re-check login status in case it changed
    this.checkLoginStatus();
  },

  checkLoginStatus() {
    const user = wx.getStorageSync('user');
    if (user) {
      this.setData({
        user,
        avatarUrl: this.getAvatarUrl(user)
      });
      this.fetchHistory();
    } else {
      this.setData({
        user: null,
        messages: [{
          role: 'assistant',
          content: '您好！我是您的智能租房助手。请先登录以获取更个性化的服务。',
          htmlContent: '您好！我是您的智能租房助手。请先登录以获取更个性化的服务。',
          timestamp: Date.now()
        }]
      });
    }
  },

  getAvatarUrl(user) {
    if (!user || !user.avatar) {
      return 'https://files.homesee.xyz/api/files/download/default-avatar.png';
    }
    if (user.avatar.startsWith('http')) {
      return user.avatar;
    }
    const FILE_SERVER_HOST = 'https://files.homesee.xyz';
    return `${FILE_SERVER_HOST}/api/files/download/${user.avatar}`;
  },

  async fetchHistory() {
    if (!this.data.user) return;

    try {
      const res = await request({
        url: `/api/smart-matching/history/${this.data.user.id}`,
        method: 'GET'
      });

      let history = res || [];
      const messages = history.map(h => ({
        role: h.role,
        content: h.content,
        htmlContent: this.processHtmlForRichText(h.content),
        timestamp: new Date(h.createdTime).getTime()
      }));

      if (messages.length === 0) {
        const userName = this.data.user.realName || this.data.user.username;
        const welcomeMsg = `您好${userName}！我是您的智能租房助手。我已经了解了您的租房偏好，请告诉我您的具体需求，我会为您推荐合适的房源。`;
        messages.push({
          role: 'assistant',
          content: welcomeMsg,
          htmlContent: this.processHtmlForRichText(welcomeMsg),
          timestamp: Date.now()
        });
      }

      this.setData({ messages }, () => {
        this.scrollToBottom();
      });

    } catch (error) {
      console.error('Failed to fetch history:', error);
      wx.showToast({
        title: '获取历史记录失败',
        icon: 'none'
      });
    }
  },

  handleInput(e) {
    this.setData({
      userInput: e.detail.value
    });
  },

  async sendMessage() {
    const content = this.data.userInput.trim();
    if (!content || this.data.loading) return;

    if (!this.data.user) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' });
          }
        }
      });
      return;
    }

    // Add user message
    const newMessage = {
      role: 'user',
      content: content,
      timestamp: Date.now()
    };

    const messages = [...this.data.messages, newMessage];

    this.setData({
      messages,
      userInput: '',
      loading: true
    }, () => {
      this.scrollToBottom();
    });

    try {
      const res = await request({
        url: '/api/smart-matching/chat',
        method: 'POST',
        data: {
          userId: this.data.user.id,
          message: content
        }
      });

      if (res && res.success) {
        const aiMsg = res.data;
        this.setData({
          messages: [...this.data.messages, {
            role: 'assistant',
            content: aiMsg.content,
            htmlContent: this.processHtmlForRichText(aiMsg.content),
            timestamp: Date.now()
          }]
        });
      } else {
        const errorMsg = '抱歉，我现在无法回答，请稍后再试。';
        this.setData({
          messages: [...this.data.messages, {
            role: 'assistant',
            content: errorMsg,
            htmlContent: this.processHtmlForRichText(errorMsg),
            timestamp: Date.now()
          }]
        });
      }

    } catch (error) {
      console.error('Chat API Error:', error);
      const netErrorMsg = '网络连接出现问题，请检查您的网络设置。';
      this.setData({
        messages: [...this.data.messages, {
          role: 'assistant',
          content: netErrorMsg,
          htmlContent: this.processHtmlForRichText(netErrorMsg),
          timestamp: Date.now()
        }]
      });
    } finally {
      this.setData({ loading: false }, () => {
        this.scrollToBottom();
      });
    }
  },

  scrollToBottom() {
    this.setData({
      scrollTop: 99999 // Scroll to a very large value to ensure bottom
    });
  },

  // 处理 HTML 使其兼容 rich-text 组件
  processHtmlForRichText(content) {
    if (!content) return '';

    let html = content;

    // 1. 移除 ACTION 注释
    html = html.replace(/<!--\s*ACTION:\s*({.*?})\s*-->/g, '');

    // 2. 清理多余空白：移除标签之间的空白和换行
    html = html.replace(/>\s+</g, '><');  // 标签之间的空白
    html = html.replace(/\n\s*/g, '');    // 移除所有换行和缩进

    // 3. 处理列表：转换为紧凑的段落格式
    html = html.replace(/<ul>/gi, '');
    html = html.replace(/<\/ul>/gi, '');
    html = html.replace(/<ol>/gi, '');
    html = html.replace(/<\/ol>/gi, '');
    html = html.replace(/<li>/gi, '<p style="margin:8px 0;">• ');  // 用段落替代li，添加bullet
    html = html.replace(/<\/li>/gi, '</p>');

    // 4. 处理段落和换行
    html = html.replace(/<p>/gi, '<p style="margin:8px 0;">');  // 紧凑段落间距
    html = html.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br/>');  // 连续br合并为一个
    html = html.replace(/<br\s*\/?>/gi, '<br/>');  // 标准化br

    // 5. 将链接转换为带样式的文字
    html = html.replace(
      /<a\s+href="[^"]*houseId=(\d+)"[^>]*>([^<]*)<\/a>/gi,
      '<span style="color:#007AFF;text-decoration:underline;">$2</span>'
    );

    // 6. 移除 target 属性
    html = html.replace(/\s*target="[^"]*"/gi, '');

    // 7. 加粗样式
    html = html.replace(/<strong>/gi, '<span style="font-weight:bold;">');
    html = html.replace(/<\/strong>/gi, '</span>');

    return html;
  }
});
