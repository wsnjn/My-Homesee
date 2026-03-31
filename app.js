// app.js
App({
  onLaunch() {
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)
    // 不在此处调用 wx.login：请在用户阅读并同意《隐私政策》后，于登录/注册等业务环节按需调用，以符合个人信息授权规则。
  },
  globalData: {
    userInfo: null
  }
})
