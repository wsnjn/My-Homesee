// pages/smart-matching/smart-matching.js
const { request } = require('../../utils/request');

const ALLOWED_HOST_SUFFIXES = ['homesee.xyz', 'www.homesee.xyz'];

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
      const welcomeMsg =
        '您好！我是您的智能租房助手。请先登录以获取更个性化的服务。';
      this.setData({
        user: null,
        messages: [
          {
            role: 'assistant',
            content: welcomeMsg,
            segments: this.buildSegmentsFromContent(welcomeMsg),
            timestamp: Date.now()
          }
        ]
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

  stripHtmlTags(html) {
    if (!html) return '';
    return String(html)
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * 校验 AI 给出的 URL 是否为本站业务域名（与后端 SmartMatchingService 要求一致）
   */
  isTrustedHomeseeUrl(href) {
    const raw = (href || '').trim();
    if (!raw) return false;
    if (raw.startsWith('#')) {
      return true;
    }
    if (raw.startsWith('/') && !raw.startsWith('//')) {
      return true;
    }
    try {
      const normalized = raw.startsWith('//') ? `https:${raw}` : raw;
      if (!/^https?:\/\//i.test(normalized)) {
        return true;
      }
      const u = new URL(normalized);
      const host = u.hostname.toLowerCase();
      return ALLOWED_HOST_SUFFIXES.some(
        (h) => host === h || host.endsWith('.homesee.xyz')
      );
    } catch (e) {
      return false;
    }
  },

  /**
   * 将 Web 链接映射为小程序路径（后端提示词中的 #/house-tour?houseId=、#/appointment?houseId= 等）
   */
  resolveMiniProgramLink(href) {
    let raw = (href || '').trim();
    const labelFallback = '打开链接';

    if (!raw) {
      return { valid: false, miniPath: '', externalUrl: '', reason: '空链接', label: labelFallback };
    }

    if (raw.startsWith('#')) {
      raw = `https://www.homesee.xyz${raw}`;
    }

    if (!this.isTrustedHomeseeUrl(raw)) {
      return {
        valid: false,
        miniPath: '',
        externalUrl: raw.startsWith('http') ? raw : '',
        reason: '非本站安全域名',
        label: labelFallback
      };
    }

    const idMatch = raw.match(/(?:[?&#])(?:houseId|id)=(\d+)/i) || raw.match(/(?:houseId|id)=(\d+)/i);
    const houseId = idMatch ? idMatch[1] : '';

    const lower = raw.toLowerCase();
    const pathPart = lower.includes('#') ? lower.split('#')[1] || lower : lower;

    if (pathPart.includes('house-tour') || pathPart.includes('housetour')) {
      if (!houseId) {
        return { valid: false, miniPath: '', externalUrl: '', reason: '缺少房源编号', label: labelFallback };
      }
      return {
        valid: true,
        miniPath: `/packageA/pages/house-tour/house-tour?id=${houseId}`,
        houseId,
        externalUrl: '',
        reason: '',
        label: labelFallback
      };
    }

    if (pathPart.includes('appointment')) {
      if (!houseId) {
        return { valid: false, miniPath: '', externalUrl: '', reason: '缺少房源编号', label: labelFallback };
      }
      return {
        valid: true,
        miniPath: `/packageB/pages/appointment/appointment?houseId=${houseId}`,
        houseId,
        externalUrl: '',
        reason: '',
        label: labelFallback
      };
    }

    if (pathPart.includes('login')) {
      return {
        valid: true,
        miniPath: '/pages/login/login',
        houseId: '',
        externalUrl: '',
        reason: '',
        label: labelFallback
      };
    }

    if (pathPart.includes('register')) {
      return {
        valid: true,
        miniPath: '/pages/login/login',
        houseId: '',
        externalUrl: '',
        reason: '',
        label: labelFallback
      };
    }

    if (pathPart.includes('profile') || pathPart.includes('user-profile')) {
      return {
        valid: true,
        miniPath: '/packageB/pages/user-profile/user-profile',
        houseId: '',
        externalUrl: '',
        reason: '',
        label: labelFallback
      };
    }

    if (pathPart.includes('house-detail') || pathPart.includes('housedetail')) {
      if (!houseId) {
        return { valid: false, miniPath: '', externalUrl: '', reason: '缺少房源编号', label: labelFallback };
      }
      try {
        wx.setStorageSync('smartMatchingPendingRoomId', houseId);
      } catch (e) {}
      return {
        valid: true,
        miniPath: '/pages/house-selection/house-selection',
        houseId,
        useSwitchTab: true,
        externalUrl: '',
        reason: '',
        label: labelFallback
      };
    }

    if (raw.startsWith('http')) {
      return {
        valid: false,
        miniPath: '',
        externalUrl: raw,
        reason: '暂不支持在小程序内打开该页面',
        label: labelFallback
      };
    }

    return {
      valid: false,
      miniPath: '',
      externalUrl: '',
      reason: '无法识别的链接',
      label: labelFallback
    };
  },

  /**
   * 将 Markdown 风格链接转为 a 标签，便于统一解析
   */
  normalizeAiLinks(content) {
    if (!content) return '';
    return String(content).replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2">$1</a>'
    );
  },

  /**
   * 拆成 rich-text 段与可点击链接段
   */
  buildSegmentsFromContent(content) {
    const normalized = this.normalizeAiLinks(content);
    const segments = [];
    const linkRe = /<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let lastIndex = 0;
    let m;
    while ((m = linkRe.exec(normalized)) !== null) {
      if (m.index > lastIndex) {
        const htmlPart = this.processHtmlForRichText(normalized.slice(lastIndex, m.index));
        if (htmlPart && htmlPart.trim()) {
          segments.push({ type: 'html', html: htmlPart });
        }
      }

      const href = m[1];
      const inner = m[2];
      const label = this.stripHtmlTags(inner) || '打开链接';
      const resolved = this.resolveMiniProgramLink(href);
      segments.push({
        type: 'link',
        label,
        valid: resolved.valid,
        miniPath: resolved.miniPath || '',
        houseId: resolved.houseId || '',
        useSwitchTab: !!resolved.useSwitchTab,
        externalUrl: resolved.externalUrl || '',
        reason: resolved.reason || ''
      });

      lastIndex = m.index + m[0].length;
    }

    if (lastIndex < normalized.length) {
      const htmlPart = this.processHtmlForRichText(normalized.slice(lastIndex));
      if (htmlPart && htmlPart.trim()) {
        segments.push({ type: 'html', html: htmlPart });
      }
    }

    if (segments.length === 0) {
      segments.push({ type: 'html', html: this.processHtmlForRichText(normalized) });
    }

    return segments;
  },

  onAssistantLinkTap(e) {
    const { valid, path, switchtab, external } = e.currentTarget.dataset;
    const isValid = valid === true || valid === 'true';
    const useSwitchTab = switchtab === true || switchtab === 'true';

    if (!isValid) {
      if (external) {
        wx.showModal({
          title: '链接提示',
          content: '该链接无法在微信内直接打开，是否复制到剪贴板？',
          confirmText: '复制',
          success: (res) => {
            if (res.confirm) {
              wx.setClipboardData({
                data: external,
                success: () => wx.showToast({ title: '已复制', icon: 'success' })
              });
            }
          }
        });
      } else {
        wx.showToast({
          title: e.currentTarget.dataset.reason || '无法打开该链接',
          icon: 'none'
        });
      }
      return;
    }

    if (!path) {
      wx.showToast({ title: '链接无效', icon: 'none' });
      return;
    }

    if (useSwitchTab) {
      wx.switchTab({
        url: path,
        fail: (err) => {
          console.error('switchTab fail', err);
          wx.showToast({ title: '打开失败', icon: 'none' });
        }
      });
      return;
    }

    wx.navigateTo({
      url: path,
      fail: (err) => {
        console.error('navigateTo fail', err);
        wx.showToast({ title: '页面打开失败', icon: 'none' });
      }
    });
  },

  async fetchHistory() {
    if (!this.data.user) return;

    try {
      const res = await request({
        url: `/api/smart-matching/history/${this.data.user.id}`,
        method: 'GET'
      });

      let history = res || [];
      const messages = history.map((h) => ({
        role: h.role,
        content: h.content,
        segments:
          h.role === 'assistant'
            ? this.buildSegmentsFromContent(h.content)
            : undefined,
        timestamp: new Date(h.createdTime).getTime()
      }));

      if (messages.length === 0) {
        const userName = this.data.user.realName || this.data.user.username;
        const welcomeMsg = `您好${userName}！我是您的智能租房助手。我已经了解了您的租房偏好，请告诉我您的具体需求，我会为您推荐合适的房源。`;
        messages.push({
          role: 'assistant',
          content: welcomeMsg,
          segments: this.buildSegmentsFromContent(welcomeMsg),
          timestamp: Date.now()
        });
      }

      this.setData({ messages }, () => {
        this.scrollToBottom();
      });
    } catch (error) {
      console.error('获取历史失败', error);
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
        const text = aiMsg.content || '';
        this.setData({
          messages: [
            ...this.data.messages,
            {
              role: 'assistant',
              content: text,
              segments: this.buildSegmentsFromContent(text),
              timestamp: Date.now()
            }
          ]
        });
      } else {
        const errorMsg = '抱歉，我现在无法回答，请稍后再试。';
        this.setData({
          messages: [
            ...this.data.messages,
            {
              role: 'assistant',
              content: errorMsg,
              segments: this.buildSegmentsFromContent(errorMsg),
              timestamp: Date.now()
            }
          ]
        });
      }
    } catch (error) {
      console.error('对话接口异常', error);
      const netErrorMsg = '网络连接出现问题，请检查您的网络设置。';
      this.setData({
        messages: [
          ...this.data.messages,
          {
            role: 'assistant',
            content: netErrorMsg,
            segments: this.buildSegmentsFromContent(netErrorMsg),
            timestamp: Date.now()
          }
        ]
      });
    } finally {
      this.setData({ loading: false }, () => {
        this.scrollToBottom();
      });
    }
  },

  scrollToBottom() {
    this.setData({
      scrollTop: 99999
    });
  },

  processHtmlForRichText(content) {
    if (!content) return '';

    let html = content;

    html = html.replace(/<!--\s*ACTION:\s*({.*?})\s*-->/g, '');
    html = html.replace(/>\s+</g, '><');
    html = html.replace(/\n\s*/g, '');

    html = html.replace(/<ul>/gi, '');
    html = html.replace(/<\/ul>/gi, '');
    html = html.replace(/<ol>/gi, '');
    html = html.replace(/<\/ol>/gi, '');
    html = html.replace(/<li>/gi, '<p style="margin:8px 0;">• ');
    html = html.replace(/<\/li>/gi, '</p>');

    html = html.replace(/<p>/gi, '<p style="margin:8px 0;">');
    html = html.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br/>');
    html = html.replace(/<br\s*\/?>/gi, '<br/>');

    html = html.replace(/\s*target="[^"]*"/gi, '');

    html = html.replace(/<strong>/gi, '<span style="font-weight:bold;">');
    html = html.replace(/<\/strong>/gi, '</span>');

    return html;
  }
});
