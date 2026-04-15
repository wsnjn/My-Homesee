const { request } = require('../../utils/request');

const ALLOWED_HOST = 'homesee.xyz';
const roomCardCache = new Map();
const roomCardFailedIdSet = new Set();
const roomCardInFlightMap = new Map();

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
    if (!user) {
      const welcome = '您好！我是智能租房助手。请先登录后进行个性化选房咨询。';
      this.setData({
        user: null,
        messages: [{
          role: 'assistant',
          content: welcome,
          segments: this.buildSegments(welcome),
          timestamp: Date.now()
        }]
      });
      return;
    }
    this.setData({
      user,
      avatarUrl: this.getAvatarUrl(user)
    });
    this.fetchHistory();
  },

  getAvatarUrl(user) {
    if (!user || !user.avatar) {
      return 'https://files.homesee.xyz/api/files/download/default-avatar.png';
    }
    if (String(user.avatar).startsWith('http')) return user.avatar;
    return `https://files.homesee.xyz/api/files/download/${user.avatar}`;
  },

  async fetchHistory() {
    if (!this.data.user || !this.data.user.id) return;
    try {
      const res = await request({
        url: `/api/smart-matching/history/${this.data.user.id}`,
        method: 'GET'
      });
      const history = Array.isArray(res) ? res : [];
      const messages = history.map((h) => ({
        role: h.role,
        content: h.content,
        segments: h.role === 'assistant' ? this.buildSegments(h.content) : undefined,
        cards: [],
        timestamp: new Date(h.createdTime).getTime()
      }));
      if (!messages.length) {
        const name = this.data.user.realName || this.data.user.username || '用户';
        const welcome = `您好${name}！告诉我预算、区域、户型和通勤偏好，我来为你推荐房源。`;
        messages.push({
          role: 'assistant',
          content: welcome,
          segments: this.buildSegments(welcome),
          timestamp: Date.now()
        });
      }
      this.setData({ messages }, async () => {
        await this.hydrateAllAssistantCards();
        this.scrollToBottom();
      });
    } catch (e) {
      wx.showToast({ title: '加载历史失败', icon: 'none' });
    }
  },

  handleInput(e) {
    this.setData({ userInput: e.detail.value || '' });
  },

  async sendMessage() {
    const content = String(this.data.userInput || '').trim();
    if (!content || this.data.loading) return;
    if (!this.data.user || !this.data.user.id) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    this.setData({
      messages: [...this.data.messages, { role: 'user', content, timestamp: Date.now() }],
      userInput: '',
      loading: true
    }, () => this.scrollToBottom());

    try {
      const res = await request({
        url: '/api/smart-matching/chat',
        method: 'POST',
        data: {
          userId: this.data.user.id,
          message: content
        }
      });
      const ok = res && res.success && res.data;
      const text = ok ? (res.data.content || '已收到，你可以继续提问。') : '抱歉，我现在无法回答，请稍后再试。';
      this.setData({
        messages: [...this.data.messages, {
          role: 'assistant',
          content: text,
          segments: this.buildSegments(text),
          cards: [],
          timestamp: Date.now()
        }]
      }, async () => {
        await this.hydrateLastAssistantCards();
        this.scrollToBottom();
      });
    } catch (e) {
      const text = '网络连接出现问题，请稍后再试。';
      this.setData({
        messages: [...this.data.messages, {
          role: 'assistant',
          content: text,
          segments: this.buildSegments(text),
          cards: [],
          timestamp: Date.now()
        }]
      }, async () => {
        await this.hydrateLastAssistantCards();
        this.scrollToBottom();
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  scrollToBottom() {
    this.setData({ scrollTop: 999999 });
  },

  normalizeContent(content) {
    if (!content) return '';
    return String(content)
      // 口令兜底：即使 AI 返回纯文本，也强制渲染为可点击入口按钮
      .replace(/进入群聊频道/g, '[进入群聊频道](community://enter-group-chat)')
      // 支持 markdown 链接，不限制为 http(s)，便于小程序内协议跳转
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  },

  buildSegments(content) {
    const normalized = this.normalizeContent(content);
    const linkRe = /<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const segments = [];
    let last = 0;
    let m;
    while ((m = linkRe.exec(normalized)) !== null) {
      if (m.index > last) {
        const htmlPart = this.cleanHtmlSegment(this.toRichHtml(normalized.slice(last, m.index)));
        if (htmlPart.trim()) segments.push({ type: 'html', html: htmlPart });
      }
      const href = (m[1] || '').trim();
      const label = (m[2] || '打开链接').replace(/<[^>]+>/g, '').trim() || '打开链接';
      const resolved = this.resolveLink(href);
      segments.push({ type: 'link', label, ...resolved });
      last = m.index + m[0].length;
    }
    if (last < normalized.length) {
      const tail = this.cleanHtmlSegment(this.toRichHtml(normalized.slice(last)));
      if (tail.trim()) segments.push({ type: 'html', html: tail });
    }
    if (!segments.length) segments.push({ type: 'html', html: this.toRichHtml(normalized) });
    return segments;
  },

  cleanHtmlSegment(html) {
    if (!html) return '';
    const cleaned = String(html)
      // 清理只有项目符号的空行，避免出现孤立的“•”或“·”
      .replace(/<p[^>]*>\s*[•·\-]\s*<\/p>/gi, '')
      .replace(/<p[^>]*>\s*(?:&bull;|&middot;)\s*<\/p>/gi, '')
      // 折叠多余空段
      .replace(/(?:<p[^>]*>\s*<\/p>\s*){2,}/gi, '<p style="margin:8px 0;"></p>');

    // 去掉只剩单个标点的尾段（如单独的 "."、"·"、"。"），避免按钮下方出现突兀小点
    const plain = cleaned
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;|&ensp;|&emsp;|&#160;/gi, ' ')
      .trim();
    if (/^[·•.\-。!！?？,，;；:：、~\s]*$/.test(plain)) return '';

    return cleaned;
  },

  toRichHtml(content) {
    return String(content || '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<ul>|<\/ul>|<ol>|<\/ol>/gi, '')
      .replace(/<li>/gi, '<p style="margin:8px 0;">• ')
      .replace(/<\/li>/gi, '</p>')
      .replace(/<p>/gi, '<p style="margin:8px 0;">')
      .replace(/<strong>/gi, '<span style="font-weight:700;">')
      .replace(/<\/strong>/gi, '</span>')
      .replace(/\s*target="[^"]*"/gi, '');
  },

  resolveLink(href) {
    if (!href) return { valid: false, miniPath: '', useSwitchTab: false, externalUrl: '', reason: '空链接' };
    const raw = href.startsWith('#') ? `https://www.${ALLOWED_HOST}${href}` : href;
    if (/house-tour/i.test(raw)) {
      const id = this.extractId(raw);
      if (!id) return { valid: false, miniPath: '', useSwitchTab: false, externalUrl: '', reason: '缺少房源ID' };
      return { valid: true, miniPath: `/packageA/pages/house-tour/house-tour?id=${id}`, useSwitchTab: false, externalUrl: '', reason: '' };
    }
    if (/appointment/i.test(raw)) {
      const id = this.extractId(raw);
      if (!id) return { valid: false, miniPath: '', useSwitchTab: false, externalUrl: '', reason: '缺少房源ID' };
      return { valid: true, miniPath: `/packageB/pages/appointment/appointment?houseId=${id}`, useSwitchTab: false, externalUrl: '', reason: '' };
    }
    if (/house-selection|house-detail/i.test(raw)) {
      const id = this.extractId(raw);
      if (id) wx.setStorageSync('smartMatchingPendingRoomId', id);
      return { valid: true, miniPath: '/pages/house-selection/house-selection', useSwitchTab: true, externalUrl: '', reason: '' };
    }
    if (/map-search/i.test(raw)) {
      return { valid: true, miniPath: '/pages/map-search/map-search', useSwitchTab: false, externalUrl: '', reason: '' };
    }
    if (/community|group|chat-area|friend-circle|进入群聊频道/i.test(raw)) {
      // 消息入口仅通过 AI 给出的按钮进入
      return { valid: true, miniPath: '/pages/community/community', useSwitchTab: false, externalUrl: '', reason: '' };
    }
    if (/^https?:\/\//i.test(raw)) {
      return { valid: false, miniPath: '', useSwitchTab: false, externalUrl: raw, reason: '暂不支持小程序内直接打开' };
    }
    return { valid: false, miniPath: '', useSwitchTab: false, externalUrl: '', reason: '无法识别链接' };
  },

  extractId(text) {
    const m = String(text).match(/(?:houseId|id)=(\d+)/i);
    return m ? m[1] : '';
  },

  extractHouseIdsFromMessage(message) {
    const ids = new Set();
    const fromText = String(message.content || '');
    const textMatches = fromText.match(/\bID\s*[:：]\s*(\d+)\b/gi) || [];
    textMatches.forEach((s) => {
      const m = s.match(/(\d+)/);
      if (m) ids.add(m[1]);
    });
    const segs = Array.isArray(message.segments) ? message.segments : [];
    segs.forEach((seg) => {
      if (seg && seg.houseId) ids.add(String(seg.houseId));
      if (seg && seg.miniPath) {
        const m = String(seg.miniPath).match(/(?:houseId|id)=(\d+)/i);
        if (m) ids.add(m[1]);
      }
    });
    return Array.from(ids)
      .map((id) => this.normalizeHouseId(id))
      .filter(Boolean)
      .slice(0, 4);
  },

  normalizeHouseId(rawId) {
    const value = String(rawId || '').trim();
    if (!/^\d+$/.test(value)) return '';
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '';
    return String(num);
  },

  async fetchRoomCard(houseId) {
    const normalizedId = this.normalizeHouseId(houseId);
    if (!normalizedId) return null;
    if (roomCardCache.has(normalizedId)) return roomCardCache.get(normalizedId);
    if (roomCardFailedIdSet.has(normalizedId)) return null;
    if (roomCardInFlightMap.has(normalizedId)) {
      return roomCardInFlightMap.get(normalizedId);
    }

    const task = (async () => {
      let room = null;
      try {
        const res = await request({
          url: `/api/room-info/${normalizedId}`,
          method: 'GET',
          silent: true
        });
        room = res && res.success ? res.room : null;
      } catch (e) {
        // 兼容另一套房源详情接口，避免部分环境返回 400 时整批卡片都失败
      }

      if (!room) {
        try {
          const fallbackRes = await request({
            url: `/api/rooms/${normalizedId}`,
            method: 'GET',
            silent: true
          });
          room = fallbackRes && fallbackRes.success ? fallbackRes.room : null;
        } catch (e2) {
          room = null;
        }
      }

      if (!room) {
        roomCardFailedIdSet.add(normalizedId);
        return null;
      }

      const card = {
        id: room.id || normalizedId,
        title: `${room.city || ''}${room.district || ''}${room.communityName || '房源'}`.trim(),
        price: room.rentPrice || '--',
        meta: `${room.bedroomCount || 1}室 · ${room.roomArea || '-'}㎡ · ${room.orientation || '朝向待补充'}`,
        cover: room.coverImage || 'https://files.homesee.xyz/api/files/download/客厅.jpg'
      };
      roomCardCache.set(normalizedId, card);
      return card;
    })();

    roomCardInFlightMap.set(normalizedId, task);
    try {
      return await task;
    } finally {
      roomCardInFlightMap.delete(normalizedId);
    }
  },

  async hydrateCardsForMessageIndex(index) {
    const list = this.data.messages || [];
    const msg = list[index];
    if (!msg || msg.role !== 'assistant') return;
    const ids = this.extractHouseIdsFromMessage(msg);
    if (!ids.length) return;
    const cards = (await Promise.all(ids.map((id) => this.fetchRoomCard(id)))).filter(Boolean);
    if (!cards.length) return;
    this.setData({ [`messages[${index}].cards`]: cards });
  },

  async hydrateLastAssistantCards() {
    const list = this.data.messages || [];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].role === 'assistant') {
        await this.hydrateCardsForMessageIndex(i);
        return;
      }
    }
  },

  async hydrateAllAssistantCards() {
    const list = this.data.messages || [];
    for (let i = 0; i < list.length; i += 1) {
      if (list[i].role === 'assistant') {
        await this.hydrateCardsForMessageIndex(i);
      }
    }
  },

  onCardTap(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/pages/house-detail/house-detail?houseId=${id}` });
  },

  onCardVrTap(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/packageA/pages/house-tour/house-tour?id=${id}` });
  },

  onCardAppointmentTap(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/packageB/pages/appointment/appointment?houseId=${id}` });
  },

  onAssistantLinkTap(e) {
    const { valid, path, switchtab, external, reason } = e.currentTarget.dataset;
    const isValid = valid === true || valid === 'true';
    const isSwitch = switchtab === true || switchtab === 'true';
    if (!isValid) {
      if (external) {
        wx.setClipboardData({
          data: external,
          success: () => wx.showToast({ title: '链接已复制', icon: 'success' })
        });
      } else {
        wx.showToast({ title: reason || '无法打开链接', icon: 'none' });
      }
      return;
    }
    if (!path) {
      wx.showToast({ title: '链接无效', icon: 'none' });
      return;
    }
    if (isSwitch) {
      wx.switchTab({ url: path });
    } else {
      wx.navigateTo({ url: path });
    }
  }
});
