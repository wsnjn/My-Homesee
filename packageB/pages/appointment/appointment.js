const { request } = require('../../../utils/request');

Page({
  data: {
    houseId: '',
    houseTitle: '',
    date: '',
    time: '18:00',
    type: '1',
    remark: '',
    submitting: false
  },
  onLoad(options) {
    this.setData({
      houseId: options.houseId || '',
      houseTitle: options.houseTitle ? decodeURIComponent(options.houseTitle) : '房源'
    });
  },
  onDate(e) { this.setData({ date: e.detail.value }); },
  onTime(e) { this.setData({ time: e.detail.value }); },
  onType(e) { this.setData({ type: e.detail.value }); },
  onRemark(e) { this.setData({ remark: e.detail.value || '' }); },
  async submit() {
    const user = wx.getStorageSync('user') || {};
    const { houseId, date, time, type, remark } = this.data;
    if (!user.id) return wx.showToast({ title: '请先登录', icon: 'none' });
    if (!houseId) return wx.showToast({ title: '缺少房源信息', icon: 'none' });
    if (!date) return wx.showToast({ title: '请选择日期', icon: 'none' });
    this.setData({ submitting: true });
    try {
      await request({
        url: '/api/viewing-appointment',
        method: 'POST',
        data: {
          roomId: Number(houseId),
          userId: user.id,
          type: Number(type),
          appointmentTime: `${date} ${time}:00`,
          remark
        }
      });
      wx.showToast({ title: '预约成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (e) {
      wx.showToast({ title: '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});