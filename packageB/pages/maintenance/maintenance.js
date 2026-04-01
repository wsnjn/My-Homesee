const { request } = require('../../../utils/request');

Page({
  data: {
    typeList: ['水电', '门锁', '网络', '家电', '其他'],
    activeType: '水电',
    content: '',
    contactPhone: '',
    submitting: false
  },
  onShow() {
    const user = wx.getStorageSync('user') || {};
    this.setData({ contactPhone: user.phone || '' });
  },
  chooseType(e) {
    this.setData({ activeType: e.currentTarget.dataset.type });
  },
  onContent(e) {
    this.setData({ content: e.detail.value || '' });
  },
  onPhone(e) {
    this.setData({ contactPhone: e.detail.value || '' });
  },
  async submitRepair() {
    const { activeType, content, contactPhone } = this.data;
    if (!content.trim()) return wx.showToast({ title: '请描述问题', icon: 'none' });
    if (!contactPhone.trim()) return wx.showToast({ title: '请填写联系电话', icon: 'none' });
    this.setData({ submitting: true });
    try {
      await request({
        url: '/api/maintenance/request',
        method: 'POST',
        data: { type: activeType, content, contactPhone }
      });
      wx.showToast({ title: '提交成功', icon: 'success' });
      this.setData({ content: '' });
    } catch (e) {
      wx.showToast({ title: '提交失败，已本地保存', icon: 'none' });
      const local = wx.getStorageSync('local_repairs') || [];
      local.unshift({ type: activeType, content, contactPhone, createdAt: Date.now() });
      wx.setStorageSync('local_repairs', local.slice(0, 30));
    } finally {
      this.setData({ submitting: false });
    }
  },
  callService() {
    wx.makePhoneCall({ phoneNumber: '13429858256' });
  }
});
// pages/maintenance/maintenance.js
const { request } = require('../../../utils/request');

Page({
  data: {
    userInfo: null,
    activeLease: null,
    requests: [],
    loading: false,

    // Modal
    showCreateModal: false,
    newTitle: '',
    newDesc: '',
    newDate: '',

    // Formatting
    statusMap: {
      0: { text: '待处理', class: 'status-pending' },
      1: { text: '处理中', class: 'status-processing' },
      2: { text: '已完成', class: 'status-completed' },
      3: { text: '已关闭', class: 'status-closed' }
    }
  },

  onLoad(options) {
    // Set default date to tomorrow
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    this.setData({
      newDate: this.formatDateSimple(tmr)
    });

    this.checkLogin();
  },

  onShow() {
    if (this.data.activeLease) {
      this.loadRequests();
    }
  },

  onPullDownRefresh() {
    if (this.data.activeLease) {
      this.loadRequests().then(() => wx.stopPullDownRefresh());
    } else {
      this.fetchActiveLease().then(() => wx.stopPullDownRefresh());
    }
  },

  checkLogin() {
    const user = wx.getStorageSync('user');
    if (user) {
      this.setData({ userInfo: user });
      this.fetchActiveLease();
    }
  },

  async fetchActiveLease() {
    if (!this.data.userInfo) return;
    try {
      const res = await request({
        url: `/api/admin/tenant/tenant/${this.data.userInfo.id}`,
        method: 'GET'
      });

      if (res.success && res.contracts && res.contracts.length > 0) {
        // Find active contract
        const active = res.contracts.find(c => c.contractStatus === 1 || c.contractStatus === 2);
        if (active) {
          this.setData({ activeLease: active });
          this.loadRequests();
        }
      }
    } catch (e) {
      console.error('Fetch lease failed', e);
    }
  },

  async loadRequests() {
    if (!this.data.activeLease) return;
    this.setData({ loading: true });

    try {
      const res = await request({
        url: `/api/maintenance/list/${this.data.activeLease.id}`,
        method: 'GET'
      });

      if (res.success) {
        const requests = (res.data || []).map(req => ({
          ...req,
          statusInfo: this.data.statusMap[req.requestStatus] || { text: '未知', class: 'status-closed' },
          formattedTime: this.formatDate(req.requestDate),
          formattedFixDate: this.formatDate(req.expectedFixDate)
        }));
        this.setData({ requests });
      }
    } catch (e) {
      console.error('Load requests failed', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  // Modal Handlers
  handleCreate() {
    if (!this.data.activeLease) {
      wx.showToast({ title: '无有效租约，无法申请', icon: 'none' });
      return;
    }
    this.setData({ showCreateModal: true });
  },

  hideModal() {
    this.setData({ showCreateModal: false });
  },

  preventBubble() { },

  onTitleInput(e) { this.setData({ newTitle: e.detail.value }); },
  onDescInput(e) { this.setData({ newDesc: e.detail.value }); },
  onDateChange(e) { this.setData({ newDate: e.detail.value }); },

  async submitRequest() {
    if (!this.data.newTitle || !this.data.newDesc) {
      wx.showToast({ title: '请完善信息', icon: 'none' });
      return;
    }

    try {
      const res = await request({
        url: '/api/maintenance/create',
        method: 'POST',
        data: {
          tenantManagementId: this.data.activeLease.id,
          requestTitle: this.data.newTitle,
          requestDescription: this.data.newDesc,
          expectedFixDate: this.data.newDate, // YYYY-MM-DD
          requestStatus: 0
        }
      });

      if (res.success) {
        wx.showToast({ title: '提交成功', icon: 'success' });
        this.setData({
          showCreateModal: false,
          newTitle: '',
          newDesc: ''
        });
        this.loadRequests();
      } else {
        wx.showToast({ title: '提交失败', icon: 'none' });
      }
    } catch (e) {
      console.error('Submit failed', e);
      wx.showToast({ title: '网络错误', icon: 'none' });
    }
  },

  formatDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  formatDateSimple(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
});