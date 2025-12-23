// pages/my-appointments/my-appointments.js
const { request } = require('../../../utils/request');

Page({
  data: {
    userInfo: null,
    activeLease: null,
    houseDetails: null,
    appointments: [],
    loading: true,

    // Formatting maps
    statusMap: {
      0: { text: '待确认', class: 'status-pending', color: '#D97706' },
      1: { text: '已确认', class: 'status-blue', color: '#2563EB' },
      2: { text: '已完成', class: 'status-green', color: '#059669' },
      3: { text: '已取消', class: 'status-red', color: '#DC2626' },
      4: { text: '已过期', class: 'status-gray', color: '#6B7280' },
      5: { text: '爽约', class: 'status-red', color: '#DC2626' }
    },

    leaseStatusMap: {
      0: { text: '待签约', color: '#D97706' },
      1: { text: '已签约', color: '#059669' },
      2: { text: '履行中', color: '#059669' },
      3: { text: '已到期', color: '#6B7280' },
      4: { text: '提前解约', color: '#DC2626' },
      5: { text: '已退租', color: '#6B7280' }
    },

    paymentMap: ['月付', '季付', '半年付', '年付']
  },

  onLoad(options) {
    this.checkLogin();
  },

  onShow() {
    if (this.data.userInfo) {
      this.fetchData();
    }
  },

  onPullDownRefresh() {
    this.fetchData();
  },

  checkLogin() {
    const user = wx.getStorageSync('user');
    if (user) {
      this.setData({ userInfo: user });
      this.fetchData();
    } else {
      this.setData({ loading: false });
    }
  },

  fetchData() {
    this.setData({ loading: true });
    Promise.all([
      this.fetchAppointments(),
      this.fetchActiveLease()
    ]).finally(() => {
      this.setData({ loading: false });
      wx.stopPullDownRefresh();
    });
  },

  async fetchAppointments() {
    if (!this.data.userInfo) return;
    try {
      const res = await request({
        url: `/api/viewing-appointment/user/${this.data.userInfo.id}`,
        method: 'GET'
      });
      if (res.success) {
        const appointments = (res.appointments || []).map(app => ({
          ...app,
          statusInfo: this.data.statusMap[app.status] || { text: '未知', color: '#999' },
          typeText: app.appointmentType === 1 ? '现场看房' : '视频看房',
          formattedDate: this.formatDate(app.preferredDate)
        }));
        this.setData({ appointments });
      }
    } catch (e) {
      console.error('Fetch appointments failed', e);
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
        // Find active contract (1=Signed, 2=Active)
        const active = res.contracts.find(c => c.contractStatus === 1 || c.contractStatus === 2);
        if (active) {
          const lease = {
            ...active,
            statusInfo: this.data.leaseStatusMap[active.contractStatus] || { text: '未知', color: '#999' },
            paymentMethod: this.data.paymentMap[active.paymentCycle] || '未知',
            formattedStart: this.formatDate(active.contractStartDate),
            formattedEnd: this.formatDate(active.contractEndDate)
          };
          this.setData({ activeLease: lease });

          if (active.roomId) {
            this.fetchHouseDetails(active.roomId);
          }
        } else {
          this.setData({ activeLease: null });
        }
      } else {
        this.setData({ activeLease: null });
      }
    } catch (e) {
      console.error('Fetch lease failed', e);
    }
  },

  async fetchHouseDetails(roomId) {
    try {
      const res = await request({
        url: `/api/room-info/${roomId}`,
        method: 'GET'
      });
      if (res.success && res.room) {
        this.setData({ houseDetails: res.room });
      }
    } catch (e) {
      console.error('Fetch house details failed', e);
    }
  },

  formatDate(str) {
    if (!str) return '-';
    const d = new Date(str);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  goLogin() {
    wx.navigateTo({ url: '/pages/login/login' });
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' });
  }
});