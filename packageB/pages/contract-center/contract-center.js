const { request } = require('../../../utils/request');

Page({
  data: {
    loading: false,
    contract: null
  },
  onShow() {
    this.fetchContract();
  },
  async fetchContract() {
    const user = wx.getStorageSync('user') || {};
    if (!user.id) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    this.setData({ loading: true });
    try {
      const res = await request({ url: `/api/tenant-services/contract/${user.id}`, silent: true });
      this.setData({ contract: res && res.data ? res.data : null });
    } catch (e) {
      this.setData({ contract: null });
    } finally {
      this.setData({ loading: false });
    }
  }
});
