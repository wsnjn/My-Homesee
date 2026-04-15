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