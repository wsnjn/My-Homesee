const BASE_URL = 'https://api.homesee.xyz'; // 服务器地址

// 获取用户token
const getToken = () => {
  try {
    const user = wx.getStorageSync('user');
    return user ? user.token || '' : '';
  } catch (error) {
    console.error('获取token失败:', error);
    return '';
  }
};

// 检查token是否过期
const checkTokenExpired = (res) => {
  return res.statusCode === 401 || (res.data && res.data.code === 401);
};

// 统一错误处理
const handleError = (error, reject) => {
  console.error('请求错误:', error);

  if (error.errMsg && error.errMsg.includes('timeout')) {
    wx.showToast({
      title: '请求超时',
      icon: 'error',
      duration: 2000
    });
  } else if (error.errMsg && error.errMsg.includes('fail')) {
    wx.showToast({
      title: '网络错误',
      icon: 'error',
      duration: 2000
    });
  }

  reject(error);
};

// 主请求函数
const request = (options) => {
  return new Promise((resolve, reject) => {
    const token = getToken();

    // 构建请求头
    const headers = {
      'Content-Type': 'application/json',
      ...options.header
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // 构建完整URL
    let url = options.url;
    if (!url.startsWith('http')) {
      url = `${BASE_URL}${url}`;
    }

    // 添加时间戳防止缓存
    if (options.method === 'GET' && options.noCache !== false) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}_t=${Date.now()}`;
    }

    wx.request({
      url: url,
      method: options.method || 'GET',
      data: options.data || {},
      header: headers,
      timeout: options.timeout || 10000, // 10秒超时
      success: (res) => {
        // 检查token是否过期
        if (checkTokenExpired(res)) {
          wx.removeStorageSync('user');
          wx.showModal({
            title: '登录已过期',
            content: '请重新登录',
            showCancel: false,
            success: () => {
              wx.reLaunch({ url: '/pages/login/login' });
            }
          });
          reject(res);
          return;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          // 业务错误处理
          const errorMsg = res.data?.message || `请求失败: ${res.statusCode}`;
          wx.showToast({
            title: errorMsg,
            icon: 'error',
            duration: 2000
          });
          reject(res);
        }
      },
      fail: (err) => {
        handleError(err, reject);
      }
    });
  });
};

// 文件上传
const uploadFile = (options) => {
  return new Promise((resolve, reject) => {
    const token = getToken();

    wx.uploadFile({
      url: options.url.startsWith('http') ? options.url : `${BASE_URL}${options.url}`,
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(res.data);
            resolve(data);
          } catch (error) {
            resolve(res.data);
          }
        } else {
          reject(res);
        }
      },
      fail: (err) => {
        handleError(err, reject);
      }
    });
  });
};

// 快捷方法
const get = (url, data = {}, options = {}) => {
  return request({ url, method: 'GET', data, ...options });
};

const post = (url, data = {}, options = {}) => {
  return request({ url, method: 'POST', data, ...options });
};

const put = (url, data = {}, options = {}) => {
  return request({ url, method: 'PUT', data, ...options });
};

const del = (url, data = {}, options = {}) => {
  return request({ url, method: 'DELETE', data, ...options });
};

module.exports = {
  request,
  uploadFile,
  get,
  post,
  put,
  del,
  BASE_URL
};
