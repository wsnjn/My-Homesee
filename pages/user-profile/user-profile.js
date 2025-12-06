// pages/user-profile/user-profile.js
const request = require('../../utils/request');
const app = getApp();

Page({
  data: {
    user: null,
    loading: true,
    isEditing: false,
    editingField: '',
    saveLoading: false,

    // Mappings
    userTypeMap: {
      1: '租客',
      2: '房东',
      3: '租客+房东'
    },
    genderMap: {
      0: '未知',
      1: '男',
      2: '女'
    },

    // Edit Form Data
    editForm: {
      username: '',
      realName: '',
      gender: 0,
      birthday: '',
      idCard: '',
      email: '',
      wechat: '',
      qq: '',
      job: '',
      company: '',
      monthlyIncome: '',
      rentalBudgetMin: '',
      rentalBudgetMax: '',
      preferredDistricts: '',
      houseRequirements: ''
    }
  },

  onLoad(options) {
    this.fetchUserInfo();
  },

  // Fetch user info
  async fetchUserInfo() {
    this.setData({ loading: true });
    try {
      // Get user ID from local storage or app global data
      const user = wx.getStorageSync('user');
      if (!user) {
        wx.redirectTo({ url: '/pages/login/login' });
        return;
      }

      const res = await request.get(`/api/user/${user.id}`);
      if (res.success) {
        this.setData({
          user: res.user,
          loading: false
        });
        // Update local storage
        wx.setStorageSync('user', res.user);
        this.initEditForm();
      } else {
        wx.showToast({ title: '获取信息失败', icon: 'none' });
      }
    } catch (error) {
      console.error(error);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  // Initialize edit form
  initEditForm() {
    const { user } = this.data;
    if (!user) return;

    this.setData({
      editForm: {
        username: user.username || '',
        realName: user.realName || '',
        gender: user.gender || 0,
        birthday: user.birthday ? this.formatDateForInput(user.birthday) : '',
        idCard: user.idCard || '',
        email: user.email || '',
        wechat: user.wechat || '',
        qq: user.qq || '',
        job: user.job || '',
        company: user.company || '',
        monthlyIncome: user.monthlyIncome || '',
        rentalBudgetMin: user.rentalBudgetMin || '',
        rentalBudgetMax: user.rentalBudgetMax || '',
        preferredDistricts: user.preferredDistricts || '',
        houseRequirements: user.houseRequirements || ''
      }
    });
  },

  // Start editing a field
  startEditField(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      isEditing: true,
      editingField: field
    });
  },

  // Handle input change
  handleInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`editForm.${field}`]: value
    });
  },

  // Cancel edit
  cancelEdit() {
    this.setData({
      isEditing: false,
      editingField: ''
    });
    this.initEditForm();
  },

  // Save changes
  async saveUserInfo() {
    this.setData({ saveLoading: true });
    try {
      const { user, editForm } = this.data;
      const res = await request.put(`/api/user/update/${user.id}`, editForm);

      if (res.success) {
        wx.showToast({ title: '保存成功', icon: 'success' });
        this.setData({
          user: { ...user, ...res.user },
          isEditing: false,
          editingField: ''
        });
        wx.setStorageSync('user', this.data.user);
        this.initEditForm();
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' });
      }
    } catch (error) {
      console.error(error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saveLoading: false });
    }
  },

  // Choose and upload avatar
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.uploadAvatar(tempFilePath);
      }
    });
  },

  async uploadAvatar(filePath) {
    wx.showLoading({ title: '上传中...' });
    try {
      // Upload file
      const uploadRes = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: 'https://files.homesee.xyz/api/files/upload',
          filePath: filePath,
          name: 'file',
          success: (res) => resolve(JSON.parse(res.data)),
          fail: (err) => reject(err)
        });
      });

      if (!uploadRes.success) {
        throw new Error(uploadRes.error || '上传失败');
      }

      const fileName = uploadRes.fileName;

      // Update user profile
      const { user } = this.data;
      const updateRes = await request.put(`/api/user/update/${user.id}`, { avatar: fileName });

      if (updateRes.success) {
        this.setData({
          ['user.avatar']: fileName
        });
        wx.setStorageSync('user', this.data.user);
        wx.showToast({ title: '头像更新成功', icon: 'success' });
      } else {
        throw new Error(updateRes.message || '更新头像失败');
      }
    } catch (error) {
      console.error(error);
      wx.showToast({ title: '上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // Helper: Format date for input
  formatDateForInput(dateStr) {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  },

  goBack() {
    wx.navigateBack();
  }
});