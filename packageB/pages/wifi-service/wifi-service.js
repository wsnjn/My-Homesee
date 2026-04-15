const { request } = require('../../../utils/request');

Page({
  data: {
    loading: false,
    wifi: null
  },
  onShow() {
    this.fetchWifi();
  },
  async fetchWifi() {
    const user = wx.getStorageSync('user') || {};
    if (!user.id) return;
    this.setData({ loading: true });
    try {
      const res = await request({ url: `/api/tenant-services/wifi/${user.id}`, silent: true });
      this.setData({ wifi: res && res.data ? res.data : null });
    } catch (e) {
      this.setData({ wifi: null });
    } finally {
      this.setData({ loading: false });
    }
  },
  copyValue(e) {
    const val = e.currentTarget.dataset.value;
    if (!val) return;
    wx.setClipboardData({ data: String(val) });
  }
});
