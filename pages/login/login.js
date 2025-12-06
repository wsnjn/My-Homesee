// pages/login/login.js
const { get, post } = require('../../utils/request.js');

Page({
  data: {
    isLogin: true,
    loading: false,
    errorMessage: '',
    formData: {
      username: '',
      phone: '',
      password: '',
      confirmPassword: '',
      realName: ''
    }
  },

  onLoad() {
    // 检查是否已登录
    const user = wx.getStorageSync('user');
    if (user && user.id) {
      this.redirectByUserType(user.userType);
    }
  },

  // 切换登录/注册表单
  toggleForm() {
    this.setData({
      isLogin: !this.data.isLogin,
      errorMessage: '',
      formData: {
        username: '',
        phone: '',
        password: '',
        confirmPassword: '',
        realName: ''
      }
    });
  },

  // 表单输入处理
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;
    
    this.setData({
      [`formData.${field}`]: value
    });
  },

  // 检查手机号是否可用
  async checkPhone() {
    const { phone } = this.data.formData;
    if (!phone) return;

    try {
      const res = await get(`/api/user/check-phone/${phone}`);
      if (res.exists) {
        this.setData({ errorMessage: res.message });
      }
    } catch (error) {
      console.error('检查手机号失败:', error);
    }
  },

  // 检查用户名是否可用
  async checkUsername() {
    const { username } = this.data.formData;
    if (!username) return;

    try {
      const res = await get(`/api/user/check-username/${username}`);
      if (res.exists) {
        this.setData({ errorMessage: res.message });
      }
    } catch (error) {
      console.error('检查用户名失败:', error);
    }
  },

  // 表单提交
  async handleSubmit() {
    const { isLogin, formData } = this.data;
    
    // 表单验证
    if (!this.validateForm()) {
      return;
    }

    this.setData({ loading: true, errorMessage: '' });

    try {
      if (isLogin) {
        // 登录逻辑
        await this.handleLogin();
      } else {
        // 注册逻辑
        await this.handleRegister();
      }
    } catch (error) {
      console.error('请求失败:', error);
      this.setData({
        errorMessage: error.data?.message || '网络错误，请稍后重试',
        loading: false
      });
    }
  },

  // 登录处理
  async handleLogin() {
    const { phone, password } = this.data.formData;
    
    const res = await post('/api/user/login', {
      phone: phone,
      password: password
    });

    if (res.success) {
      // 保存用户信息
      wx.setStorageSync('user', res.user);
      
      // 显示成功提示
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500,
        complete: () => {
          // 根据用户类型跳转
          this.redirectByUserType(res.user.userType);
        }
      });
    } else {
      this.setData({
        errorMessage: res.message || '登录失败',
        loading: false
      });
    }
  },

  // 注册处理
  async handleRegister() {
    const { username, phone, password, confirmPassword, realName } = this.data.formData;
    
    // 验证密码确认
    if (password !== confirmPassword) {
      this.setData({
        errorMessage: '两次输入的密码不一致',
        loading: false
      });
      return;
    }

    const res = await post('/api/user/register', {
      username: username,
      phone: phone,
      password: password,
      realName: realName
    });

    if (res.success) {
      // 注册成功，切换到登录表单
      this.setData({
        isLogin: true,
        errorMessage: '注册成功，请登录',
        loading: false,
        formData: {
          username: '',
          phone: '',
          password: '',
          confirmPassword: '',
          realName: ''
        }
      });
      
      wx.showToast({
        title: '注册成功',
        icon: 'success'
      });
    } else {
      this.setData({
        errorMessage: res.message || '注册失败',
        loading: false
      });
    }
  },

  // 表单验证
  validateForm() {
    const { isLogin, formData } = this.data;
    
    if (isLogin) {
      // 登录表单验证
      if (!formData.phone || !formData.password) {
        this.setData({ errorMessage: '请填写手机号和密码' });
        return false;
      }
      
      if (!/^1[3-9]\d{9}$/.test(formData.phone)) {
        this.setData({ errorMessage: '请输入正确的手机号' });
        return false;
      }
    } else {
      // 注册表单验证
      const { username, phone, password, confirmPassword, realName } = formData;
      
      if (!username || !phone || !password || !confirmPassword || !realName) {
        this.setData({ errorMessage: '请填写所有必填字段' });
        return false;
      }
      
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        this.setData({ errorMessage: '请输入正确的手机号' });
        return false;
      }
      
      if (password.length < 6) {
        this.setData({ errorMessage: '密码长度不能少于6位' });
        return false;
      }
    }
    
    return true;
  },

  // 根据用户类型跳转
  redirectByUserType(userType) {
    switch(userType) {
      case 1: // 租客
        wx.switchTab({ url: '/pages/home/home' });
        break;
      case 2: // 房东
        wx.switchTab({ url: '/pages/landlord/landlord' });
        break;
      case 3: // 管理员
        wx.switchTab({ url: '/pages/admin/admin' });
        break;
      default:
        wx.switchTab({ url: '/pages/home/home' });
    }
  },

  // 快速填充测试账号（开发环境使用）
  fillTestAccount() {
    if (process.env.NODE_ENV === 'development') {
      this.setData({
        formData: {
          phone: '13800138000',
          password: '123456'
        }
      });
    }
  }
});
