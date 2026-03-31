const { request, put } = require('../../utils/request');
const {
  locateAndValidateCoordinate,
  roomNeedsCoordinateRefresh,
  fetchNearbyPoiItems,
  DEFAULT_CENTER_LNG,
  DEFAULT_CENTER_LAT
} = require('../../utils/amapLocation');

const MARKER_ICON_BLUE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyNTYzRUIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtOSAxM3MtOS02LTktMTNhOSA5IDAgMCAxIDE4IDB6Ij48L3BhdGg+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iMyI+PC9jaXJjbGU+PC9zdmc+';
const MAP_SEARCH_STATE_KEY = 'map_search_state_v1';

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function hashStringToMarkerId(str, fallbackIndex) {
  const s = String(str);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  const id = Math.abs(h) % 2000000000;
  return id > 0 ? id : fallbackIndex + 1;
}

function getStableMarkerId(room, index) {
  const id = room.id;
  if (typeof id === 'number' && !isNaN(id) && id > 0 && id < 2000000000) {
    return id;
  }
  const n = Number(id);
  if (!isNaN(n) && String(n) === String(id) && n > 0) {
    return n;
  }
  return hashStringToMarkerId(String(id), index);
}

Page({
  data: {
    rooms: [],
    filteredRooms: [],
    markers: [],

    searchText: '',
    activeFilters: [],

    latitude: DEFAULT_CENTER_LAT,
    longitude: DEFAULT_CENTER_LNG,
    scale: 12,

    selectedRoom: null,
    showDetail: false,
    aiLoading: false,
    aiItems: [],
    sidebarOpen: false,
    resultCount: 0,
    activeRoomId: null,
    cardScrollIntoView: '',
    viewportBounds: null,
    showMetroLayer: false,
    showBusinessLayer: false,
    poiMarkers: [],
    showBasicFilters: true,
    showAdvancedFilters: false,
    activePriceRange: 'all',
    activeRentalType: 'all',
    sortType: 'default',
    favoriteIds: [],
    smartSuggestions: [],

    specificRoomId: '',
    isProcessing: false
  },

  _markerIdToRoomId: {},
  _searchDebounceTimer: null,
  _poiDebounceTimer: null,
  _regionDebounceTimer: null,
  _mapCtx: null,

  onLoad() {
    this._markerIdToRoomId = {};
    this._mapCtx = wx.createMapContext('map', this);
    this.restoreState();
    this.fetchRooms();
  },

  onHide() {
    this.persistState();
  },

  onUnload() {
    this.persistState();
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
    }
    if (this._poiDebounceTimer) {
      clearTimeout(this._poiDebounceTimer);
      this._poiDebounceTimer = null;
    }
    if (this._regionDebounceTimer) {
      clearTimeout(this._regionDebounceTimer);
      this._regionDebounceTimer = null;
    }
  },

  moveToUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          scale: 14
        });
      },
      fail: () => {
        wx.showToast({ title: '定位失败', icon: 'none' });
      }
    });
  },

  async fetchRooms() {
    wx.showLoading({ title: '加载房源...' });
    try {
      const res = await request({ url: '/api/rooms/available' });
      if (res && res.success && res.rooms) {
        this.setData({ rooms: res.rooms });
        this.applyFilters();
      }
    } catch (error) {
      console.error('加载房源失败', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onSearchInput(e) {
    this.setData({ searchText: e.detail.value });
    if (this._searchDebounceTimer) clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this.applyFilters();
    }, 250);
  },

  onSpecificRoomInput(e) {
    this.setData({ specificRoomId: e.detail.value });
  },

  onSearchConfirm() {
    this.applyFilters();
  },

  toggleFilter(e) {
    const type = e.currentTarget.dataset.type;
    let filters = [...this.data.activeFilters];
    const disabledLegacyFilterTypes = ['price_desc'];
    if (disabledLegacyFilterTypes.includes(type)) return;

    if (filters.includes(type)) {
      filters = filters.filter((t) => t !== type);
    } else {
      if (['whole', 'shared', 'single'].includes(type)) {
        filters = filters.filter((t) => !['whole', 'shared', 'single'].includes(t));
      }
      filters.push(type);
    }

    this.setData({ activeFilters: filters });
    this.applyFilters();
  },

  onPriceRangeTap(e) {
    const value = e.currentTarget.dataset.value || 'all';
    this.setData({ activePriceRange: value });
    this.applyFilters();
  },

  onRentalTypeTap(e) {
    const value = e.currentTarget.dataset.value || 'all';
    this.setData({ activeRentalType: value });
    this.applyFilters();
  },

  onSortTap(e) {
    const value = e.currentTarget.dataset.value || 'default';
    this.setData({ sortType: value });
    this.applyFilters();
  },

  toggleBasicFilters() {
    this.setData({ showBasicFilters: !this.data.showBasicFilters });
  },

  toggleAdvancedFilters() {
    this.setData({ showAdvancedFilters: !this.data.showAdvancedFilters });
  },

  applyFilters() {
    let result = this.data.rooms;
    const { searchText, activeFilters, latitude, longitude, viewportBounds, activePriceRange, activeRentalType, sortType } = this.data;

    if (searchText) {
      const key = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          (r.communityName && r.communityName.toLowerCase().includes(key)) ||
          (r.district && r.district.toLowerCase().includes(key)) ||
          (r.street && r.street.toLowerCase().includes(key))
      );
    }

    if (activeFilters.includes('whole')) {
      result = result.filter((r) => r.rentalType === 0);
    }
    if (activeFilters.includes('shared')) {
      result = result.filter((r) => r.rentalType === 1);
    }
    if (activeFilters.includes('single')) {
      result = result.filter((r) => r.rentalType === 2);
    }

    if (activeFilters.includes('subway')) {
      result = result.filter((r) => r.description && r.description.includes('地铁'));
    }

    if (activeFilters.includes('nearby')) {
      result = result.filter((r) => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng)) return false;
        return calculateDistanceKm(latitude, longitude, lat, lng) <= 3;
      });
    }

    if (activeFilters.includes('viewport') && viewportBounds) {
      const { southwest, northeast } = viewportBounds;
      result = result.filter((r) => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng)) return false;
        return (
          lat >= southwest.latitude &&
          lat <= northeast.latitude &&
          lng >= southwest.longitude &&
          lng <= northeast.longitude
        );
      });
    }

    if (activeRentalType !== 'all') {
      const rentalTypeMap = { whole: 0, shared: 1, single: 2 };
      const targetType = rentalTypeMap[activeRentalType];
      result = result.filter((r) => r.rentalType === targetType);
    }

    if (activePriceRange !== 'all') {
      result = result.filter((r) => {
        const price = Number(r.rentPrice);
        if (isNaN(price)) return false;
        if (activePriceRange === 'lt2000') return price < 2000;
        if (activePriceRange === '2000to4000') return price >= 2000 && price <= 4000;
        if (activePriceRange === 'gt4000') return price > 4000;
        return true;
      });
    }

    if (sortType === 'price_asc') {
      result = [...result].sort((a, b) => Number(a.rentPrice || 0) - Number(b.rentPrice || 0));
    } else if (sortType === 'distance_asc') {
      result = [...result].sort((a, b) => {
        const aLat = parseFloat(a.latitude);
        const aLng = parseFloat(a.longitude);
        const bLat = parseFloat(b.latitude);
        const bLng = parseFloat(b.longitude);
        const da = isNaN(aLat) || isNaN(aLng) ? Number.MAX_SAFE_INTEGER : calculateDistanceKm(latitude, longitude, aLat, aLng);
        const db = isNaN(bLat) || isNaN(bLng) ? Number.MAX_SAFE_INTEGER : calculateDistanceKm(latitude, longitude, bLat, bLng);
        return da - db;
      });
    }

    const favoriteIds = this.data.favoriteIds || [];
    result = result.map((item) => ({
      ...item,
      isFavorite: favoriteIds.includes(String(item.id))
    }));

    const activeRoomStillVisible = result.some((r) => String(r.id) === String(this.data.activeRoomId));
    const nextActiveRoomId = activeRoomStillVisible ? this.data.activeRoomId : result[0]?.id || null;

    this.setData({
      filteredRooms: result,
      resultCount: result.length,
      activeRoomId: nextActiveRoomId
    });
    this.updateMarkers(result);
    this.updateSmartSuggestions(result.length);
  },

  updateMarkers(rooms) {
    this._markerIdToRoomId = {};
    const roomMarkers = (rooms || []).map((room, index) => {
      let lat = parseFloat(room.latitude);
      let lng = parseFloat(room.longitude);

      if (isNaN(lat) || isNaN(lng)) {
        lat = DEFAULT_CENTER_LAT + (Math.random() - 0.5) * 0.05;
        lng = DEFAULT_CENTER_LNG + (Math.random() - 0.5) * 0.05;
      }

      const markerId = getStableMarkerId(room, index);
      this._markerIdToRoomId[markerId] = room.id;

      return {
        id: markerId,
        latitude: lat,
        longitude: lng,
        width: 32,
        height: 32,
        iconPath: MARKER_ICON_BLUE,
        callout: {
          content: `¥${room.rentPrice}`,
          color: '#ffffff',
          fontSize: 12,
          borderRadius: 16,
          bgColor: '#2563EB',
          padding: 6,
          display: 'ALWAYS',
          textAlign: 'center'
        }
      };
    });

    const markers = roomMarkers.concat(this.data.poiMarkers || []);
    this.setData({ markers });
  },

  onMarkerTap(e) {
    const markerId = e.detail.markerId;
    const mappedId = this._markerIdToRoomId[markerId];
    if (!mappedId) {
      return;
    }
    const room = this.data.rooms.find((r) => r.id == mappedId || r.id == markerId);

    if (!room) {
      wx.showToast({ title: '房源数据未找到', icon: 'none' });
      return;
    }

    this.setData({ showDetail: false });

    setTimeout(() => {
      const tagsList = room.tags
        ? String(room.tags)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];
      this.setData({
        selectedRoom: Object.assign({}, room, { tagsList }),
        showDetail: true,
        aiLoading: true,
        aiItems: [],
        activeRoomId: room.id,
        cardScrollIntoView: `room-card-${room.id}`,
        latitude: parseFloat(room.latitude) || this.data.latitude,
        longitude: parseFloat(room.longitude) || this.data.longitude
      });
      this.loadNearbyPoiForRoom(room);
    }, 50);
  },

  onRoomCardTap(e) {
    const roomId = e.currentTarget.dataset.id;
    const room = this.data.filteredRooms.find((r) => String(r.id) === String(roomId));
    if (!room) return;

    const tagsList = room.tags
      ? String(room.tags)
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    this.setData({
      selectedRoom: Object.assign({}, room, { tagsList }),
      showDetail: true,
      aiLoading: true,
      aiItems: [],
      activeRoomId: room.id,
      cardScrollIntoView: `room-card-${room.id}`,
      latitude: parseFloat(room.latitude) || this.data.latitude,
      longitude: parseFloat(room.longitude) || this.data.longitude,
      scale: 14
    });
    this.loadNearbyPoiForRoom(room);
  },

  toggleCardFavorite(e) {
    const roomId = e.currentTarget.dataset.id;
    if (roomId === undefined || roomId === null) return;
    const room = this.data.rooms.find((r) => String(r.id) === String(roomId));
    if (!room) return;

    const key = 'favorite_houses';
    const list = wx.getStorageSync(key) || [];
    const exists = list.some((item) => String(item.id) === String(room.id));
    let nextList;
    if (exists) {
      nextList = list.filter((item) => String(item.id) !== String(room.id));
      wx.showToast({ title: '已取消收藏', icon: 'none' });
    } else {
      nextList = [room].concat(list).slice(0, 200);
      wx.showToast({ title: '收藏成功', icon: 'success' });
    }
    wx.setStorageSync(key, nextList);
    const favoriteIds = nextList.map((item) => String(item.id));
    this.setData({ favoriteIds });
    this.applyFilters();
  },

  quickAppointment(e) {
    const roomId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/packageB/pages/appointment/appointment?houseId=${roomId}`
    });
  },

  async loadNearbyPoiForRoom(room) {
    const lat = parseFloat(room.latitude);
    const lng = parseFloat(room.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      this.setData({
        aiLoading: false,
        aiItems: []
      });
      return;
    }

    try {
      const items = await fetchNearbyPoiItems(lng, lat);
      this.setData({
        aiLoading: false,
        aiItems: items.length ? items : []
      });
    } catch (err) {
      console.error('周边配套查询失败', err);
      this.setData({
        aiLoading: false,
        aiItems: []
      });
    }
  },

  onMapTap() {
    this.setData({ showDetail: false });
  },

  closeDetail() {
    this.setData({ showDetail: false });
  },

  preventBubble() {},

  toggleSidebar() {
    this.setData({
      sidebarOpen: !this.data.sidebarOpen
    });
  },

  onRegionChange(e) {
    if (e.type === 'end' && (e.causedBy === 'drag' || e.causedBy === 'scale') && e.detail && e.detail.centerLocation) {
      this.setData({
        latitude: e.detail.centerLocation.latitude,
        longitude: e.detail.centerLocation.longitude
      });
      if (this._regionDebounceTimer) clearTimeout(this._regionDebounceTimer);
      this._regionDebounceTimer = setTimeout(() => {
        this.updateViewportBounds();
        if (
          this.data.activeFilters.includes('nearby') ||
          this.data.activeFilters.includes('viewport') ||
          this.data.sortType === 'distance_asc'
        ) {
          this.applyFilters();
        }
        if (this.data.showMetroLayer || this.data.showBusinessLayer) {
          if (this._poiDebounceTimer) clearTimeout(this._poiDebounceTimer);
          this._poiDebounceTimer = setTimeout(() => this.refreshPoiLayer(), 250);
        }
      }, 180);
    }
  },

  resetFilters() {
    this.setData({
      searchText: '',
      activeFilters: [],
      activePriceRange: 'all',
      activeRentalType: 'all',
      sortType: 'default'
    });
    this.applyFilters();
  },

  quickRelaxViewport() {
    const nextFilters = (this.data.activeFilters || []).filter((f) => f !== 'viewport');
    this.setData({ activeFilters: nextFilters });
    this.applyFilters();
  },

  quickRelaxPrice() {
    this.setData({ activePriceRange: 'all' });
    this.applyFilters();
  },

  quickClearAll() {
    this.resetFilters();
  },

  updateSmartSuggestions(resultCount) {
    const suggestions = [];
    const { activeFilters, activePriceRange, activeRentalType, searchText, sortType } = this.data;
    const has = (k) => (activeFilters || []).includes(k);

    if (resultCount === 0) {
      if (has('viewport')) suggestions.push({ key: 'remove_viewport', text: '去掉视野内限制' });
      if (has('nearby')) suggestions.push({ key: 'remove_nearby', text: '去掉3km附近限制' });
      if (searchText) suggestions.push({ key: 'clear_search', text: '清空关键词' });
      if (activePriceRange !== 'all') suggestions.push({ key: 'price_all', text: '放宽价格条件' });
      if (activeRentalType !== 'all') suggestions.push({ key: 'rental_all', text: '切换到全部出租类型' });
      if (sortType !== 'default') suggestions.push({ key: 'sort_default', text: '恢复默认排序' });
      suggestions.push({ key: 'clear_all', text: '一键清空所有筛选' });
    } else {
      if (!has('viewport')) suggestions.push({ key: 'add_viewport', text: '仅看当前视野' });
      if (activePriceRange === 'all') suggestions.push({ key: 'price_2k_4k', text: '筛选2k-4k' });
      if (activeRentalType === 'all') suggestions.push({ key: 'rental_whole', text: '只看整租' });
      if (sortType !== 'distance_asc') suggestions.push({ key: 'sort_distance', text: '按距离排序' });
    }

    this.setData({ smartSuggestions: suggestions.slice(0, 4) });
  },

  applySuggestion(e) {
    const key = e.currentTarget.dataset.key;
    const filters = [...(this.data.activeFilters || [])];
    const addFilter = (f) => {
      if (!filters.includes(f)) filters.push(f);
    };
    const removeFilter = (f) => filters.filter((x) => x !== f);

    if (key === 'remove_viewport') {
      this.setData({ activeFilters: removeFilter('viewport') });
    } else if (key === 'remove_nearby') {
      this.setData({ activeFilters: removeFilter('nearby') });
    } else if (key === 'clear_search') {
      this.setData({ searchText: '' });
    } else if (key === 'price_all') {
      this.setData({ activePriceRange: 'all' });
    } else if (key === 'rental_all') {
      this.setData({ activeRentalType: 'all' });
    } else if (key === 'sort_default') {
      this.setData({ sortType: 'default' });
    } else if (key === 'clear_all') {
      this.resetFilters();
      return;
    } else if (key === 'add_viewport') {
      addFilter('viewport');
      this.setData({ activeFilters: filters });
    } else if (key === 'price_2k_4k') {
      this.setData({ activePriceRange: '2000to4000' });
    } else if (key === 'rental_whole') {
      this.setData({ activeRentalType: 'whole' });
    } else if (key === 'sort_distance') {
      this.setData({ sortType: 'distance_asc' });
    }

    this.applyFilters();
  },

  persistState() {
    const state = {
      searchText: this.data.searchText,
      activeFilters: this.data.activeFilters,
      activePriceRange: this.data.activePriceRange,
      activeRentalType: this.data.activeRentalType,
      sortType: this.data.sortType,
      showBasicFilters: this.data.showBasicFilters,
      showAdvancedFilters: this.data.showAdvancedFilters,
      showMetroLayer: this.data.showMetroLayer,
      showBusinessLayer: this.data.showBusinessLayer
    };
    wx.setStorageSync(MAP_SEARCH_STATE_KEY, state);
  },

  restoreState() {
    const state = wx.getStorageSync(MAP_SEARCH_STATE_KEY) || {};
    const favoriteList = wx.getStorageSync('favorite_houses') || [];
    this.setData({
      searchText: state.searchText || '',
      activeFilters: Array.isArray(state.activeFilters) ? state.activeFilters : [],
      activePriceRange: state.activePriceRange || 'all',
      activeRentalType: state.activeRentalType || 'all',
      sortType: state.sortType || 'default',
      showBasicFilters: state.showBasicFilters !== false,
      showAdvancedFilters: !!state.showAdvancedFilters,
      showMetroLayer: !!state.showMetroLayer,
      showBusinessLayer: !!state.showBusinessLayer,
      favoriteIds: favoriteList.map((item) => String(item.id))
    });
  },

  updateViewportBounds() {
    if (!this._mapCtx || !this._mapCtx.getRegion) return;
    this._mapCtx.getRegion({
      success: (res) => {
        if (res && res.southwest && res.northeast) {
          this.setData({ viewportBounds: res });
        }
      }
    });
  },

  toggleMetroLayer() {
    this.setData({ showMetroLayer: !this.data.showMetroLayer }, () => {
      this.refreshPoiLayer();
    });
  },

  toggleBusinessLayer() {
    this.setData({ showBusinessLayer: !this.data.showBusinessLayer }, () => {
      this.refreshPoiLayer();
    });
  },

  async refreshPoiLayer() {
    const { showMetroLayer, showBusinessLayer, latitude, longitude } = this.data;
    if (!showMetroLayer && !showBusinessLayer) {
      this.setData({ poiMarkers: [] });
      this.updateMarkers(this.data.filteredRooms);
      return;
    }

    try {
      const items = await fetchNearbyPoiItems(longitude, latitude);
      const metroKeywords = ['地铁', '站'];
      const businessKeywords = ['商场', '广场', '中心', 'mall', 'MALL'];

      const poiMarkers = (items || [])
        .filter((item) => {
          const name = String(item.name || '');
          const isMetro = metroKeywords.some((k) => name.includes(k));
          const isBusiness = businessKeywords.some((k) => name.includes(k));
          return (showMetroLayer && isMetro) || (showBusinessLayer && isBusiness);
        })
        .slice(0, 20)
        .map((item, idx) => ({
          id: 1900000000 + idx,
          latitude: parseFloat(item.latitude),
          longitude: parseFloat(item.longitude),
          width: 20,
          height: 20,
          alpha: 0.95,
          callout: {
            content: item.name || '周边点位',
            color: '#1F2937',
            fontSize: 10,
            borderRadius: 10,
            bgColor: '#F9FAFB',
            padding: 4,
            display: 'BYCLICK',
            textAlign: 'center'
          }
        }))
        .filter((m) => !isNaN(m.latitude) && !isNaN(m.longitude));

      this.setData({ poiMarkers });
      this.updateMarkers(this.data.filteredRooms);
    } catch (err) {
      console.error('POI 图层刷新失败', err);
    }
  },

  async runConcurrent(tasks, concurrency) {
    const queue = [...tasks];
    const workers = [];
    for (let w = 0; w < concurrency; w++) {
      workers.push(
        (async () => {
          while (queue.length) {
            const item = queue.shift();
            if (item) await item();
          }
        })()
      );
    }
    await Promise.all(workers);
  },

  async startAICompletion() {
    if (this.data.isProcessing) return;

    const toProcess = this.data.rooms.filter((r) => roomNeedsCoordinateRefresh(r));
    if (toProcess.length === 0) {
      wx.showToast({ title: '暂无需完善的房源', icon: 'none' });
      return;
    }

    this.setData({ isProcessing: true });

    let successCount = 0;
    let failCount = 0;
    let locateFailCount = 0;
    let done = 0;

    const tasks = toProcess.map((room) => async () => {
      const { result, reason } = await locateAndValidateCoordinate(room);
      done += 1;
      wx.showLoading({ title: `处理中 ${done}/${toProcess.length}`, mask: true });

      if (!result) {
        locateFailCount += 1;
        if (reason) {
          console.warn(`[房源 ${room.id}] 定位失败`, reason);
        }
        return;
      }

      const idx = this.data.rooms.findIndex((r) => r.id == room.id);
      if (idx === -1) {
        locateFailCount += 1;
        return;
      }

      const roomsCopy = [...this.data.rooms];
      const updated = { ...roomsCopy[idx], latitude: result.lat, longitude: result.lng };
      roomsCopy[idx] = updated;

      try {
        await put(`/api/rooms/update/${room.id}`, updated);
        successCount += 1;
        this.setData({ rooms: roomsCopy });
      } catch (err) {
        console.error('后端更新失败', room.id, err);
        failCount += 1;
      }

      await new Promise((r) => setTimeout(r, 200));
    });

    wx.showLoading({ title: `准备处理 ${toProcess.length} 个房源`, mask: true });

    await this.runConcurrent(tasks, 3);

    wx.hideLoading();
    this.setData({ isProcessing: false });
    this.applyFilters();

    wx.showModal({
      title: '处理完成',
      content: `成功 ${successCount}\n更新失败 ${failCount}\n定位失败 ${locateFailCount}`,
      showCancel: false
    });
  },

  async processSpecificRoom() {
    if (this.data.isProcessing) return;

    const roomId = String(this.data.specificRoomId || '').trim();
    if (!roomId) {
      wx.showToast({ title: '请输入房源ID', icon: 'none' });
      return;
    }

    const room = this.data.rooms.find((r) => String(r.id) === roomId || r.id == roomId);
    if (!room) {
      wx.showToast({ title: '未找到该房源', icon: 'none' });
      return;
    }

    this.setData({ isProcessing: true });
    wx.showLoading({ title: '重新检测中...', mask: true });

    try {
      const { result, reason } = await locateAndValidateCoordinate(room);

      if (!result) {
        wx.showToast({
          title: reason ? `未通过校验` : '无法定位',
          icon: 'none'
        });
        if (reason) console.warn('[指定房源]', reason);
        return;
      }

      const idx = this.data.rooms.findIndex((r) => r.id == room.id);
      if (idx === -1) return;

      const roomsCopy = [...this.data.rooms];
      const updated = { ...roomsCopy[idx], latitude: result.lat, longitude: result.lng };
      roomsCopy[idx] = updated;

      await put(`/api/rooms/update/${room.id}`, updated);
      this.setData({ rooms: roomsCopy });
      this.applyFilters();

      wx.showToast({ title: '更新成功', icon: 'success' });
    } catch (err) {
      console.error('指定房源更新失败', err);
      wx.showToast({ title: '更新失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ isProcessing: false });
    }
  },

  navigateToDetail() {
    if (this.data.selectedRoom) {
      wx.navigateTo({
        url: `/pages/house-detail/house-detail?houseId=${this.data.selectedRoom.id}`
      });
    }
  },

  goBack() {
    wx.navigateBack();
  }
});
