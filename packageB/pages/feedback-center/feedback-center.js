const { request } = require('../../../utils/request');

Page({
  data: {
    type: '建议',
    content: '',
    contactPhone: '',
    submitting: false
  },
  onShow() {
    const user = wx.getStorageSync('user') || {};
    this.setData({ contactPhone: user.phone || '' });
  },
  onType(e) {
    this.setData({ type: e.currentTarget.dataset.type });
  },
  onContent(e) {
    this.setData({ content: e.detail.value || '' });
  },
  onPhone(e) {
    this.setData({ contactPhone: e.detail.value || '' });
  },
  async submit() {
    const user = wx.getStorageSync('user') || {};
    const { type, content, contactPhone } = this.data;
    if (!content.trim()) return wx.showToast({ title: '请填写内容', icon: 'none' });
    this.setData({ submitting: true });
    try {
      await request({
        url: '/api/tenant-services/feedback',
        method: 'POST',
        data: { userId: user.id || null, type, content, contactPhone }
      });
      wx.showToast({ title: '已提交', icon: 'success' });
      this.setData({ content: '' });
    } catch (e) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
