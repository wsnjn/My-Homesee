// pages/appointment/appointment.js
const { request } = require('../../../utils/request');

Page({
  data: {
    houseId: '',
    houseInfo: null,
    loading: false,
    submitting: false,
    minDate: '',

    // Modal state
    showSuccessModal: false,
    appointmentNumber: '',

    // Form data
    preferredDate: '',
    preferredTimeSlot: '',
    appointmentType: '1', // 1: On-site, 2: Video
    tenantCount: '',
    expectedMoveInDate: '',
    contactName: '',
    contactPhone: '',
    wechatId: '',
    rentalIntention: '',

    // Options
    timeSlots: [
      '09:00-10:00', '10:00-11:00', '11:00-12:00',
      '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00'
    ],
    appointmentTypes: [
      { value: '1', label: '现场看房' },
      { value: '2', label: '视频看房' }
    ]
  },

  onLoad(options) {
    const houseId = options.houseId;
    if (houseId) {
      this.setData({ houseId });
      this.initDate();
      this.loadHouseInfo(houseId);
      this.prefillUserInfo();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  initDate() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    this.setData({ minDate: dateStr });
  },

  prefillUserInfo() {
    const user = wx.getStorageSync('user');
    if (user) {
      this.setData({
        contactName: user.realName || user.username || '',
        contactPhone: user.phone || ''
      });
    }
  },

  async loadHouseInfo(houseId) {
    this.setData({ loading: true });
    try {
      const res = await request({
        url: `/api/room-info/${houseId}`,
        method: 'GET'
      });
      if (res && res.success) {
        this.setData({ houseInfo: res.room });
      } else {
        wx.showToast({ title: '加载房屋信息失败', icon: 'none' });
      }
    } catch (error) {
      console.error('Failed to load house info:', error);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // Input Handlers
  onDateChange(e) { this.setData({ preferredDate: e.detail.value }); },
  onTimeChange(e) { this.setData({ preferredTimeSlot: this.data.timeSlots[e.detail.value] }); },
  onTypeChange(e) { this.setData({ appointmentType: this.data.appointmentTypes[e.detail.value].value }); },
  onTenantCountInput(e) { this.setData({ tenantCount: e.detail.value }); },
  onMoveInDateChange(e) { this.setData({ expectedMoveInDate: e.detail.value }); },
  onNameInput(e) { this.setData({ contactName: e.detail.value }); },
  onPhoneInput(e) { this.setData({ contactPhone: e.detail.value }); },
  onWechatInput(e) { this.setData({ wechatId: e.detail.value }); },
  onIntentionInput(e) { this.setData({ rentalIntention: e.detail.value }); },

  validateForm() {
    const d = this.data;
    if (!d.preferredDate) return '请选择期望看房日期';
    if (!d.preferredTimeSlot) return '请选择期望时间段';
    if (!d.tenantCount) return '请输入租客人数';
    if (!d.expectedMoveInDate) return '请选择期望入住日期';
    if (!d.contactName.trim()) return '请输入联系人姓名';
    if (!d.contactPhone.trim()) return '请输入联系电话';
    if (!/^1[3-9]\d{9}$/.test(d.contactPhone)) return '手机号格式不正确';
    return null;
  },

  async submitAppointment() {
    const error = this.validateForm();
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    const user = wx.getStorageSync('user');
    if (!user) {
      wx.showModal({
        title: '提示',
        content: '请先登录',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/login/login' });
        }
      });
      return;
    }

    this.setData({ submitting: true });
    try {
      const data = {
        roomId: this.data.houseId,
        userId: user.id,
        preferredDate: this.data.preferredDate,
        preferredTimeSlot: this.data.preferredTimeSlot,
        appointmentType: parseInt(this.data.appointmentType),
        contactName: this.data.contactName,
        contactPhone: this.data.contactPhone,
        wechatId: this.data.wechatId || null,
        tenantCount: parseInt(this.data.tenantCount),
        expectedMoveInDate: this.data.expectedMoveInDate || null,
        rentalIntention: this.data.rentalIntention || null
      };

      const res = await request({
        url: '/api/viewing-appointment/create',
        method: 'POST',
        data: data
      });

      if (res && res.success) {
        this.setData({
          showSuccessModal: true,
          appointmentNumber: res.appointmentNumber
        });
      } else {
        wx.showToast({ title: res.message || '预约失败', icon: 'none' });
      }
    } catch (error) {
      console.error('Submit failed:', error);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  goToMyAppointments() {
    wx.navigateTo({
      url: '/pages/my-appointments/my-appointments'
    });
  }
})