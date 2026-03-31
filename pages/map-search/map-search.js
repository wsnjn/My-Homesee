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

    specificRoomId: '',
    isProcessing: false
  },

  _markerIdToRoomId: {},
  _searchDebounceTimer: null,

  onLoad() {
    this._markerIdToRoomId = {};
    this.fetchRooms();
  },

  onUnload() {
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
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

  applyFilters() {
    let result = this.data.rooms;
    const { searchText, activeFilters, latitude, longitude } = this.data;

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

    if (activeFilters.includes('price_desc')) {
      result = [...result].sort((a, b) => b.rentPrice - a.rentPrice);
    }

    if (activeFilters.includes('nearby')) {
      result = result.filter((r) => {
        const lat = parseFloat(r.latitude);
        const lng = parseFloat(r.longitude);
        if (isNaN(lat) || isNaN(lng)) return false;
        return calculateDistanceKm(latitude, longitude, lat, lng) <= 3;
      });
    }

    this.setData({
      filteredRooms: result,
      resultCount: result.length
    });
    this.updateMarkers(result);
  },

  updateMarkers(rooms) {
    this._markerIdToRoomId = {};
    const markers = (rooms || []).map((room, index) => {
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

    this.setData({ markers });
  },

  onMarkerTap(e) {
    const markerId = e.detail.markerId;
    const mappedId = this._markerIdToRoomId[markerId];
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
        aiItems: []
      });
      this.loadNearbyPoiForRoom(room);
    }, 50);
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
    if (e.type === 'end' && e.causedBy === 'drag' && e.detail && e.detail.centerLocation) {
      this.setData({
        latitude: e.detail.centerLocation.latitude,
        longitude: e.detail.centerLocation.longitude
      });
      if (this.data.activeFilters.includes('nearby')) {
        this.applyFilters();
      }
    }
  },

  resetFilters() {
    this.setData({
      searchText: '',
      activeFilters: []
    });
    this.applyFilters();
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
