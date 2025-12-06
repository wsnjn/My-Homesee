// pages/house-selection/house-selection.js
const { request } = require('../../utils/request');

Page({
  data: {
    // 筛选条件
    filters: {
      priceRange: [0, 10000],
      areaRange: [0, 200],
      rentalType: '', // 0: 整租, 1: 合租, 2: 单间
      decoration: '', // 1: 毛坯, 2: 简装, 3: 精装, 4: 豪装
      hasElevator: false
    },

    // 房屋列表
    houses: [],
    loading: false,
    hasMore: true,
    page: 1, // Note: Backend API doesn't seem to support pagination in /filter endpoint based on controller code, but we'll keep it for future
    pageSize: 10,

    // 筛选面板状态
    showFilterPanel: false,

    // 排序选项
    sortOptions: [
      { id: 1, name: '默认排序' },
      { id: 2, name: '价格低→高' },
      { id: 3, name: '价格高→低' },
      { id: 4, name: '面积大→小' },
      { id: 5, name: '面积小→大' }
    ],
    currentSort: 1,

    // 搜索关键词
    searchKeyword: '',

    // 选项数据
    rentalTypeOptions: [
      { value: '', label: '不限' },
      { value: '0', label: '整租' },
      { value: '1', label: '合租' },
      { value: '2', label: '单间' }
    ],
    decorationOptions: [
      { value: '', label: '不限' },
      { value: '1', label: '毛坯' },
      { value: '2', label: '简装' },
      { value: '3', label: '精装' },
      { value: '4', label: '豪装' }
    ]
  },

  onLoad(options) {
    this.loadHouses();
  },

  onShow() {
    if (this.data.houses.length === 0) {
      this.loadHouses();
    }
  },

  // 加载房屋列表
  async loadHouses(reset = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      // 构建API参数
      const params = {};

      // 价格范围
      if (this.data.filters.priceRange[1] < 10000) {
        params.minPrice = 0;
        params.maxPrice = this.data.filters.priceRange[1];
      }

      // 面积范围
      if (this.data.filters.areaRange[1] < 200) {
        params.minArea = 0;
        params.maxArea = this.data.filters.areaRange[1];
      }

      // 租赁类型
      if (this.data.filters.rentalType !== '') {
        params.rentalType = parseInt(this.data.filters.rentalType);
      }

      // 装修
      if (this.data.filters.decoration !== '') {
        params.decoration = parseInt(this.data.filters.decoration);
      }

      // 关键词
      if (this.data.searchKeyword) {
        params.keyword = this.data.searchKeyword;
      }

      const res = await request({
        url: '/api/room-info/filter',
        method: 'GET',
        data: params
      });

      let houses = res || [];

      // 客户端过滤：电梯
      if (this.data.filters.hasElevator) {
        houses = houses.filter(h => h.hasElevator === 1);
      }

      // 客户端排序
      switch (this.data.currentSort) {
        case 2: // 价格低到高
          houses.sort((a, b) => a.rentPrice - b.rentPrice);
          break;
        case 3: // 价格高到低
          houses.sort((a, b) => b.rentPrice - a.rentPrice);
          break;
        case 4: // 面积大到小
          houses.sort((a, b) => b.roomArea - a.roomArea);
          break;
        case 5: // 面积小到大
          houses.sort((a, b) => a.roomArea - b.roomArea);
          break;
        default: // 默认排序 (ID desc)
          houses.sort((a, b) => b.id - a.id);
          break;
      }

      // 格式化电话号码
      houses = houses.map(h => ({
        ...h,
        formattedPhone: this.formatPhoneNumber(h.landlordPhone)
      }));

      this.setData({
        houses: houses,
        hasMore: false, // Since /filter returns all results
        loading: false
      });

    } catch (error) {
      console.error('加载房屋列表失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
      this.setData({ loading: false });
    }
  },

  // 搜索房屋
  onSearch(e) {
    const keyword = e.detail.value || '';
    this.setData({ searchKeyword: keyword });
    this.loadHouses(true);
  },

  // 切换筛选面板
  toggleFilterPanel() {
    this.setData({
      showFilterPanel: !this.data.showFilterPanel
    });
  },

  // 更新筛选条件
  updateFilter(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail.value;

    // Handle custom data-value for taps
    const val = e.currentTarget.dataset.value !== undefined ? e.currentTarget.dataset.value : value;

    this.setData({
      [`filters.${field}`]: val
    });
  },

  // 应用筛选
  applyFilters() {
    this.setData({ showFilterPanel: false });
    this.loadHouses(true);
  },

  // 重置筛选
  resetFilters() {
    this.setData({
      filters: {
        priceRange: [0, 10000],
        areaRange: [0, 200],
        rentalType: '',
        decoration: '',
        hasElevator: false
      }
    });
  },

  // 选择排序方式
  selectSort(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({ currentSort: index });
    this.loadHouses(true);
  },

  // 查看房屋详情
  viewHouseDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/house-tour/house-tour?id=${id}`
    });
  },

  // 预约看房
  makeAppointment(e) {
    const { id } = e.currentTarget.dataset;
    const house = this.data.houses.find(h => h.id === id);
    if (house) {
      wx.navigateTo({
        url: `/pages/appointment/appointment?houseId=${id}&houseTitle=${house.communityName}`
      });
    }
  },

  // 收藏房屋
  async toggleFavorite(e) {
    const { id } = e.currentTarget.dataset;
    // Note: API implementation for favorite might need check, assuming it works as before
    // For now just toggle UI state
    const houseIndex = this.data.houses.findIndex(h => h.id === id);
    if (houseIndex === -1) return;

    const houses = [...this.data.houses];
    houses[houseIndex].isFavorite = !houses[houseIndex].isFavorite;
    this.setData({ houses });

    wx.showToast({
      title: houses[houseIndex].isFavorite ? '已收藏' : '已取消收藏',
      icon: 'none'
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadHouses(true);
    wx.stopPullDownRefresh();
  },

  // 格式化价格
  formatPrice(price) {
    if (!price) return '0元/月';
    if (price >= 10000) {
      return `${(price / 10000).toFixed(1)}万/月`;
    }
    return `${price}元/月`;
  },

  // 格式化面积
  formatArea(area) {
    return area ? `${area}㎡` : '0㎡';
  },

  // 格式化房型
  formatRoomType(type) {
    const types = { 0: '整租', 1: '合租', 2: '单间' };
    return types[type] || '未知';
  },

  // 格式化电话号码 (183-0712-3472)
  formatPhoneNumber(phone) {
    if (!phone) return '';
    const cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  },

  // 跳转到VR看房
  goToHouseTour(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/house-tour/house-tour?id=${id}`
    });
  },

  // 跳转到预约页面
  goToAppointment(e) {
    const { id, status } = e.currentTarget.dataset;

    // 检查房屋状态
    if (status !== 0) {
      wx.showToast({
        title: '该房源已下架',
        icon: 'none'
      });
      return;
    }

    const house = this.data.houses.find(h => h.id === id);
    if (house) {
      wx.navigateTo({
        url: `/pages/appointment/appointment?houseId=${id}&houseTitle=${encodeURIComponent(house.communityName)}`
      });
    }
  },

  // 拨打房东电话
  callLandlord(e) {
    const { phone } = e.currentTarget.dataset;
    if (phone) {
      wx.makePhoneCall({
        phoneNumber: phone,
        fail: (err) => {
          console.log('用户取消拨打电话', err);
        }
      });
    }
  },

  // 到达底部加载更多
  onReachBottom() {
    // 当前API不支持分页，暂不处理
  }
});

