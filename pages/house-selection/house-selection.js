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
    ],
    elevatorOptions: [
      { value: '', label: '不限' },
      { value: '0', label: '无电梯' },
      { value: '1', label: '有电梯' }
    ],
    orientationOptions: [
      { value: '', label: '不限' },
      { value: '东', label: '东' },
      { value: '南', label: '南' },
      { value: '西', label: '西' },
      { value: '北', label: '北' },
      { value: '东南', label: '东南' },
      { value: '西南', label: '西南' },
      { value: '东北', label: '东东北' },
      { value: '西北', label: '西北' }
    ],

    // 地区数据 - 从 API 动态获取
    provinces: [],
    cities: [],
    districts: [],
    streets: [],
    communities: [],

    // 选中的地区
    selectedProvince: '',
    selectedCity: '',
    selectedDistrict: '',
    selectedStreet: '',
    selectedCommunity: '',
    selectedProvinceIndex: 0,
    selectedCityIndex: 0,
    selectedDistrictIndex: 0,
    selectedStreetIndex: 0,
    selectedCommunityIndex: 0,

    // 价格与面积
    minPrice: '',
    maxPrice: '',
    minArea: '',
    maxArea: ''
  },

  onLoad(options) {
    this.loadFilterOptions();
    this.loadHouses();
  },

  // 加载筛选选项 - 与 Vue3 前端一致
  async loadFilterOptions() {
    try {
      const res = await request({
        url: '/api/room-info/filter-options',
        method: 'GET'
      });

      if (res && res.provinces) {
        this.setData({
          provinces: res.provinces || []
        });
      }
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    }
  },

  // 加载城市数据 - 与 Vue3 前端一致
  async loadCities(province) {
    if (!province) {
      this.setData({
        cities: [],
        districts: [],
        streets: [],
        communities: [],
        selectedCity: '',
        selectedDistrict: '',
        selectedStreet: '',
        selectedCommunity: ''
      });
      return;
    }

    try {
      const res = await request({
        url: `/api/room-info/cities/${encodeURIComponent(province)}`,
        method: 'GET'
      });

      this.setData({
        cities: res || [],
        districts: [],
        streets: [],
        communities: []
      });
    } catch (error) {
      console.error('加载城市数据失败:', error);
      this.setData({ cities: [] });
    }
  },

  // 加载区县数据 - 与 Vue3 前端一致
  async loadDistricts(city) {
    if (!city) {
      this.setData({
        districts: [],
        streets: [],
        communities: [],
        selectedDistrict: '',
        selectedStreet: '',
        selectedCommunity: ''
      });
      return;
    }

    try {
      const res = await request({
        url: `/api/room-info/districts/${encodeURIComponent(city)}`,
        method: 'GET'
      });

      this.setData({
        districts: res || [],
        streets: [],
        communities: []
      });
    } catch (error) {
      console.error('加载区县数据失败:', error);
      this.setData({ districts: [] });
    }
  },

  // 加载街道数据 - 与 Vue3 前端一致
  async loadStreets(district) {
    if (!district) {
      this.setData({
        streets: [],
        communities: [],
        selectedStreet: '',
        selectedCommunity: ''
      });
      return;
    }

    try {
      const res = await request({
        url: `/api/room-info/streets/${encodeURIComponent(district)}`,
        method: 'GET'
      });

      this.setData({
        streets: res || [],
        communities: []
      });
    } catch (error) {
      console.error('加载街道数据失败:', error);
      this.setData({ streets: [] });
    }
  },

  // 加载小区数据 - 与 Vue3 前端一致
  async loadCommunities(street) {
    if (!street) {
      this.setData({
        communities: [],
        selectedCommunity: ''
      });
      return;
    }

    try {
      const res = await request({
        url: `/api/room-info/communities/${encodeURIComponent(street)}`,
        method: 'GET'
      });

      this.setData({
        communities: res || []
      });
    } catch (error) {
      console.error('加载小区数据失败:', error);
      this.setData({ communities: [] });
    }
  },

  // 加载房屋列表
  async loadHouses(reset = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      // 构建API参数
      const params = {};

      // 价格范围 (使用输入框的值)
      if (this.data.minPrice) params.minPrice = parseFloat(this.data.minPrice);
      if (this.data.maxPrice) params.maxPrice = parseFloat(this.data.maxPrice);

      // 面积范围 (使用输入框的值)
      if (this.data.minArea) params.minArea = parseFloat(this.data.minArea);
      if (this.data.maxArea) params.maxArea = parseFloat(this.data.maxArea);

      // 租赁类型
      if (this.data.selectedRentalType && this.data.selectedRentalType !== '不限') {
        const typeMap = { '整租': 0, '合租': 1, '单间': 2 };
        if (typeMap[this.data.selectedRentalType] !== undefined) {
          params.rentalType = typeMap[this.data.selectedRentalType];
        }
      }

      // 装修
      if (this.data.selectedDecoration && this.data.selectedDecoration !== '不限') {
        const decoMap = { '毛坯': 1, '简装': 2, '精装': 3, '豪装': 4 };
        if (decoMap[this.data.selectedDecoration] !== undefined) {
          params.decoration = decoMap[this.data.selectedDecoration];
        }
      }

      // 电梯
      if (this.data.selectedElevator && this.data.selectedElevator !== '不限') {
        params.hasElevator = this.data.selectedElevator === '有电梯' ? 1 : 0;
      }

      // 朝向
      if (this.data.selectedOrientation && this.data.selectedOrientation !== '不限') {
        params.orientation = this.data.selectedOrientation;
      }

      // 地区筛选
      if (this.data.selectedProvince) params.province = this.data.selectedProvince;
      if (this.data.selectedCity) params.city = this.data.selectedCity;
      if (this.data.selectedDistrict) params.district = this.data.selectedDistrict;
      if (this.data.selectedStreet) params.street = this.data.selectedStreet;
      if (this.data.selectedCommunity) params.communityName = this.data.selectedCommunity;

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
      },
      selectedProvince: '',
      selectedCity: '',
      selectedDistrict: '',
      selectedStreet: '',
      selectedCommunity: '',
      minPrice: '',
      maxPrice: '',
      minArea: '',
      maxArea: ''
    });
  },

  // 省份选择 - 动态加载城市
  async onProvinceChange(e) {
    const index = e.detail.value;
    const province = this.data.provinces[index];

    this.setData({
      selectedProvince: province,
      selectedProvinceIndex: index,
      selectedCity: '',
      selectedDistrict: '',
      selectedStreet: '',
      selectedCommunity: ''
    });

    await this.loadCities(province);
  },

  // 城市选择 - 动态加载区县
  async onCityChange(e) {
    const index = e.detail.value;
    const city = this.data.cities[index];

    this.setData({
      selectedCity: city,
      selectedCityIndex: index,
      selectedDistrict: '',
      selectedStreet: '',
      selectedCommunity: ''
    });

    await this.loadDistricts(city);
  },

  // 区县选择 - 动态加载街道
  async onDistrictChange(e) {
    const index = e.detail.value;
    const district = this.data.districts[index];

    this.setData({
      selectedDistrict: district,
      selectedDistrictIndex: index,
      selectedStreet: '',
      selectedCommunity: ''
    });

    await this.loadStreets(district);
  },

  // 街道选择 - 动态加载小区
  async onStreetChange(e) {
    const index = e.detail.value;
    const street = this.data.streets[index];

    this.setData({
      selectedStreet: street,
      selectedStreetIndex: index,
      selectedCommunity: ''
    });

    await this.loadCommunities(street);
  },

  // 小区选择
  onCommunityChange(e) {
    const index = e.detail.value;
    const community = this.data.communities[index];

    this.setData({
      selectedCommunity: community,
      selectedCommunityIndex: index
    });
  },

  // 租赁类型选择
  onRentalTypeChange(e) {
    const index = e.detail.value;
    const rentalType = this.data.rentalTypeOptions[index];
    this.setData({
      selectedRentalType: rentalType.label
    });
  },

  // 装修程度选择
  onDecorationChange(e) {
    const index = e.detail.value;
    const decoration = this.data.decorationOptions[index];
    this.setData({
      selectedDecoration: decoration.label
    });
  },

  // 电梯选择
  onElevatorChange(e) {
    const index = e.detail.value;
    const elevator = this.data.elevatorOptions[index];
    this.setData({
      selectedElevator: elevator.label
    });
  },

  // 朝向选择
  onOrientationChange(e) {
    const index = e.detail.value;
    const orientation = this.data.orientationOptions[index];
    this.setData({
      selectedOrientation: orientation.label
    });
  },

  // 价格输入
  onMinPriceInput(e) {
    this.setData({ minPrice: e.detail.value });
  },
  onMaxPriceInput(e) {
    this.setData({ maxPrice: e.detail.value });
  },

  // 面积输入
  onMinAreaInput(e) {
    this.setData({ minArea: e.detail.value });
  },
  onMaxAreaInput(e) {
    this.setData({ maxArea: e.detail.value });
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

