const { request } = require('../../../utils/request');

Page({
  data: {
    list: [],
    filtered: [],
    tab: 'all',
    loading: false
  },
  onShow() {
    this.fetchList();
  },
  async fetchList() {
    const user = wx.getStorageSync('user') || {};
    if (!user.id) return this.setData({ list: [], filtered: [] });
    this.setData({ loading: true });
    try {
      const res = await request({ url: `/api/viewing-appointment/user/${user.id}` });
      const list = Array.isArray(res) ? res : Array.isArray(res.data) ? res.data : [];
      const format = list.map((i) => ({
        ...i,
        statusText: { 0: '待确认', 1: '已确认', 2: '已完成', 3: '已取消' }[i.status] || '未知',
        dateText: i.appointmentTime ? new Date(i.appointmentTime).toLocaleString('zh-CN') : '未安排'
      }));
      this.setData({ list: format }, () => this.applyTab());
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab }, () => this.applyTab());
  },
  applyTab() {
    const { list, tab } = this.data;
    const filtered = tab === 'all' ? list : list.filter((i) => (tab === 'pending' ? i.status === 0 || i.status === 1 : i.status === 2 || i.status === 3));
    this.setData({ filtered });
  },
  goHouse(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/house-detail/house-detail?houseId=${id}` });
  }
});