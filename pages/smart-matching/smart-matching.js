const { request } = require('../../utils/request');

Page({
  data: {
    form: {
      minPrice: '',
      maxPrice: '',
      bedroom: '',
      rentalType: '',
      orientation: '',
      hasElevator: false,
      nearMetro: false,
      moveInDate: '',
      districtKeyword: ''
    },
    rentalTypeOptions: ['不限', '整租', '合租', '单间'],
    bedroomOptions: ['不限', '1居', '2居', '3居+'],
    orientationOptions: ['不限', '南', '东南', '东', '西', '北'],
    loading: false,
    matchedList: []
  },

  onLoad() {
    this.prefillFromStorage();
  },

  prefillFromStorage() {
    const saved = wx.getStorageSync('smartMatchingDraft');
    if (saved) this.setData({ form: { ...this.data.form, ...saved } });
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail.value || '' });
  },

  onSwitch(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: !!e.detail.value });
  },

  onPicker(e) {
    const { field, options } = e.currentTarget.dataset;
    const list = options === 'rental' ? this.data.rentalTypeOptions : options === 'bedroom' ? this.data.bedroomOptions : this.data.orientationOptions;
    const val = list[e.detail.value] || '';
    this.setData({ [`form.${field}`]: val });
  },

  async runMatching() {
    const { form } = this.data;
    wx.setStorageSync('smartMatchingDraft', form);
    this.setData({ loading: true });
    try {
      const params = {};
      if (form.minPrice) params.minPrice = Number(form.minPrice);
      if (form.maxPrice) params.maxPrice = Number(form.maxPrice);
      if (form.rentalType && form.rentalType !== '不限') {
        params.rentalType = { 整租: 0, 合租: 1, 单间: 2 }[form.rentalType];
      }
      if (form.bedroom && form.bedroom !== '不限') {
        if (form.bedroom === '3居+') params.minBedroomCount = 3;
        else params.bedroomCount = Number(String(form.bedroom).replace(/\D/g, ''));
      }
      if (form.orientation && form.orientation !== '不限') params.orientation = form.orientation;
      if (form.hasElevator) params.hasElevator = 1;
      if (form.districtKeyword) params.keyword = form.districtKeyword;

      const res = await request({ url: '/api/room-info/filter', method: 'GET', data: params });
      const list = Array.isArray(res) ? res : [];
      const ranked = list
        .map((room) => ({ ...room, score: this.calcScore(room, form) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
      this.setData({ matchedList: ranked });
      if (!ranked.length) wx.showToast({ title: '暂无匹配结果', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '匹配失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  calcScore(room, form) {
    let score = 50;
    const price = Number(room.rentPrice || 0);
    if (form.minPrice && price >= Number(form.minPrice)) score += 8;
    if (form.maxPrice && price <= Number(form.maxPrice)) score += 10;
    if (form.nearMetro && String(room.street || '').includes('地铁')) score += 8;
    if (form.orientation && form.orientation !== '不限' && form.orientation === room.orientation) score += 10;
    if (form.hasElevator && room.hasElevator === 1) score += 8;
    if (form.bedroom && form.bedroom !== '不限') {
      const bed = Number(room.bedroomCount || 0);
      if (form.bedroom === '3居+' ? bed >= 3 : bed === Number(String(form.bedroom).replace(/\D/g, ''))) score += 10;
    }
    return Math.min(99, score);
  },

  applyToHouseSelection() {
    const { form, matchedList } = this.data;
    wx.setStorageSync('smartMatchingFilters', {
      minPrice: form.minPrice,
      maxPrice: form.maxPrice,
      bedroom: form.bedroom === '不限' ? '' : (form.bedroom === '3居+' ? '3+' : String(form.bedroom).replace(/\D/g, '')),
      rentalType: form.rentalType === '不限' ? '' : form.rentalType,
      orientation: form.orientation === '不限' ? '' : form.orientation
    });
    if (matchedList.length) wx.setStorageSync('smartMatchingPendingRoomId', matchedList[0].id);
    wx.switchTab({ url: '/pages/house-selection/house-selection' });
  },

  goDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/house-detail/house-detail?houseId=${id}` });
  }
});
