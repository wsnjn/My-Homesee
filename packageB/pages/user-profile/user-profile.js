const { request } = require('../../../utils/request');

Page({
  data: {
    form: {
      username: '',
      realName: '',
      phone: '',
      email: '',
      company: '',
      wechat: '',
      qq: '',
      job: '',
      rentalBudgetMin: '',
      rentalBudgetMax: '',
      preferredDistricts: '',
      houseRequirements: ''
    },
    saving: false
  },
  onShow() {
    const user = wx.getStorageSync('user') || {};
    this.setData({
      form: {
        username: user.username || '',
        realName: user.realName || '',
        phone: user.phone || '',
        email: user.email || '',
        company: user.company || '',
        wechat: user.wechat || '',
        qq: user.qq || '',
        job: user.job || '',
        rentalBudgetMin: user.rentalBudgetMin || '',
        rentalBudgetMax: user.rentalBudgetMax || '',
        preferredDistricts: user.preferredDistricts || '',
        houseRequirements: user.houseRequirements || ''
      }
    });
  },
  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail.value || '' });
  },
  async onSave() {
    const { form } = this.data;
    if (!form.realName || !form.phone) {
      wx.showToast({ title: '姓名和手机号必填', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      const user = wx.getStorageSync('user') || {};
      const payload = { ...user, ...form };
      wx.setStorageSync('user', payload);
      if (user.id) {
        try {
          await request({ url: `/api/users/${user.id}`, method: 'PUT', data: form });
        } catch (e) {}
      }
      wx.showToast({ title: '已保存', icon: 'success' });
    } finally {
      this.setData({ saving: false });
    }
  }
});