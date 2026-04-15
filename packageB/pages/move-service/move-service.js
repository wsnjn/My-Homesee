const { request } = require('../../../utils/request');

Page({
  data: {
    fromAddress: '',
    toAddress: '',
    moveDate: '',
    contactPhone: '',
    remark: '',
    submitting: false
  },
  onShow() {
    const user = wx.getStorageSync('user') || {};
    this.setData({ contactPhone: user.phone || '' });
  },
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: e.detail.value || '' });
  },
  onDate(e) {
    this.setData({ moveDate: e.detail.value });
  },
  async submit() {
    const user = wx.getStorageSync('user') || {};
    const { fromAddress, toAddress, moveDate, contactPhone, remark } = this.data;
    if (!fromAddress || !toAddress || !moveDate) {
      return wx.showToast({ title: '请补全搬家信息', icon: 'none' });
    }
    this.setData({ submitting: true });
    try {
      await request({
        url: '/api/tenant-services/move-order',
        method: 'POST',
        data: { userId: user.id || null, fromAddress, toAddress, moveDate, contactPhone, remark }
      });
      wx.showToast({ title: '预约成功', icon: 'success' });
      this.setData({ remark: '' });
    } catch (e) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
