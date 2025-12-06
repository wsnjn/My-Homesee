// pages/smart-matching/smart-matching.js
const { request } = require('../../utils/request');

Page({
  data: {
    user: null,
    messages: [],
    userInput: '',
    loading: false,
    scrollTop: 0,
    avatarUrl: '/models/image/default-avatar.png'
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
          parsedContent: this.parseMessage('您好！我是您的智能租房助手。请先登录以获取更个性化的服务。'),
          timestamp: Date.now()
        }]
      });
    }
  },

  getAvatarUrl(user) {
    if (!user || !user.avatar) {
      return '/models/image/default-avatar.png';
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
        parsedContent: this.parseMessage(h.content),
        timestamp: new Date(h.createdTime).getTime()
      }));

      if (messages.length === 0) {
        const userName = this.data.user.realName || this.data.user.username;
        const welcomeMsg = `您好${userName}！我是您的智能租房助手。我已经了解了您的租房偏好，请告诉我您的具体需求，我会为您推荐合适的房源。`;
        messages.push({
          role: 'assistant',
          content: welcomeMsg,
          parsedContent: this.parseMessage(welcomeMsg),
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
      parsedContent: this.parseMessage(content),
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
            parsedContent: this.parseMessage(aiMsg.content),
            timestamp: Date.now()
          }]
        });
      } else {
        const errorMsg = '抱歉，我现在无法回答，请稍后再试。';
        this.setData({
          messages: [...this.data.messages, {
            role: 'assistant',
            content: errorMsg,
            parsedContent: this.parseMessage(errorMsg),
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
          parsedContent: this.parseMessage(netErrorMsg),
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

  // Parse HTML content into structured nodes
  parseMessage(content) {
    if (!content) return [];

    let processed = content;

    // 1. Extract and remove ACTION comment
    const actionRegex = /<!--\s*ACTION:\s*({.*?})\s*-->/;
    const actionMatch = processed.match(actionRegex);
    if (actionMatch) {
      try {
        const action = JSON.parse(actionMatch[1]);
        console.log('Hidden Action:', action);
      } catch (e) {
        console.error('Failed to parse action:', e);
      }
      processed = processed.replace(actionRegex, '');
    }

    // 2. Pre-process tags
    processed = processed
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p>/gi, '')
      .replace(/\n\s*\n/g, '\n'); // Collapse multiple newlines into one

    const nodes = [];
    // Regex to match tags or text
    const tagRegex = /<strong>(.*?)<\/strong>|<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi;

    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(processed)) !== null) {
      // Add text before the tag
      if (match.index > lastIndex) {
        const text = processed.substring(lastIndex, match.index);
        if (text) nodes.push({ type: 'text', text });
      }

      if (match[0].toLowerCase().startsWith('<strong>')) {
        // Bold
        const text = match[1];
        // Check if it's a title (e.g., "1. xxx")
        if (/^\d+\./.test(text)) {
          nodes.push({ type: 'title', text });
        } else {
          nodes.push({ type: 'bold', text });
        }
      } else if (match[0].toLowerCase().startsWith('<a')) {
        // Link
        const url = match[2];
        const text = match[3];
        let linkType = 'unknown';
        let id = '';

        if (url.includes('house-tour')) {
          linkType = 'house-tour';
          const idMatch = url.match(/houseId=(\d+)/);
          if (idMatch) id = idMatch[1];
        } else if (url.includes('appointment')) {
          linkType = 'appointment';
          const idMatch = url.match(/houseId=(\d+)/);
          if (idMatch) id = idMatch[1];
        }

        nodes.push({ type: 'link', text, linkType, id, url });
      }

      lastIndex = tagRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < processed.length) {
      const text = processed.substring(lastIndex);
      if (text) nodes.push({ type: 'text', text });
    }

    return this.groupLinks(nodes);
  },

  // Group VR and Appointment links into a single block
  groupLinks(nodes) {
    const newNodes = [];
    for (let i = 0; i < nodes.length; i++) {
      const current = nodes[i];
      // Look ahead for appointment link if current is house-tour link
      if (current.type === 'link' && current.linkType === 'house-tour') {
        let j = i + 1;
        let foundAppointment = false;
        let middleNodes = [];

        // Scan next few nodes (limit to 3 to avoid scanning too far)
        while (j < nodes.length && j < i + 4) {
          const next = nodes[j];
          if (next.type === 'link' && next.linkType === 'appointment') {
            foundAppointment = true;
            // Found it! Group them.
            newNodes.push({
              type: 'link-group',
              items: [current, ...middleNodes, next]
            });
            i = j; // Advance main loop to the appointment link
            break;
          } else if (next.type === 'text') {
            // Allow text nodes in between (like " | ", "\n", etc.)
            middleNodes.push(next);
          } else {
            // If we hit something else (like bold or title), stop looking
            break;
          }
          j++;
        }

        if (!foundAppointment) {
          newNodes.push(current);
        }
      } else {
        newNodes.push(current);
      }
    }
    return newNodes;
  },

  // Handle link clicks
  handleLinkTap(e) {
    const { type, id } = e.currentTarget.dataset;
    if (type === 'house-tour' && id) {
      wx.navigateTo({
        url: `/pages/house-tour/house-tour?id=${id}`
      });
    } else if (type === 'appointment' && id) {
      wx.navigateTo({
        url: `/pages/appointment/appointment?houseId=${id}`
      });
    }
  }
});
