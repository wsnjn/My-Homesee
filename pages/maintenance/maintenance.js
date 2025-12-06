// pages/maintenance/maintenance.js
const { request } = require('../../utils/request');

Page({
  data: {
    requests: [],
    loading: false,
    userInfo: null,
    statusMap: {
      0: '待处理',
      1: '处理中',
      2: '已完成'
    },
    statusColorMap: {
      0: '#ff9800', // Orange
      1: '#2196f3', // Blue
      2: '#4caf50'  // Green
    }
  },

  onLoad(options) {
    this.checkLogin();
  },

  onShow() {
    if (this.data.userInfo) {
      this.loadRequests();
    }
  },

  checkLogin() {
    const user = wx.getStorageSync('user');
    if (user) {
      this.setData({ userInfo: user });
      this.loadRequests();
    } else {
      wx.showModal({
        title: '提示',
        content: '请先登录查看维修记录',
        showCancel: false,
        success: () => {
          wx.navigateTo({ url: '/pages/login/login' });
        }
      });
    }
  },

  async loadRequests() {
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      // Assuming API endpoint for user's maintenance requests
      const res = await request({
        url: `/api/maintenance/user/${this.data.userInfo.id}`,
        method: 'GET'
      });

      const requests = Array.isArray(res) ? res : (res.content || []);

      this.setData({
        requests: requests.map(item => ({
          ...item,
          statusText: this.data.statusMap[item.status] || '未知',
          statusColor: this.data.statusColorMap[item.status] || '#999',
          formattedTime: this.formatDate(item.createTime)
        })),
        loading: false
      });
    } catch (error) {
      console.error('加载维修记录失败', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  },

  handleCreate() {
    wx.navigateTo({ url: '/pages/maintenance-request/maintenance-request' });
  },

  viewDetail(e) {
    const { id } = e.currentTarget.dataset;
    // Navigate to detail page if exists, or show modal
    wx.showToast({
      title: '查看详情: ' + id,
      icon: 'none'
    });
  }
});