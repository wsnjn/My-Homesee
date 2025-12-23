const { request } = require('../../utils/request');

Page({
    data: {
        rooms: [], // All rooms
        filteredRooms: [], // Displayed rooms
        markers: [],

        // Search & Filter
        searchText: '',
        activeFilters: [],

        // Map State
        latitude: 22.543099,
        longitude: 114.057868,
        scale: 12,

        // UI State
        selectedRoom: null,
        showDetail: false,
        aiLoading: false,
        aiItems: [],
        sidebarOpen: false
    },

    onLoad() {
        this.fetchRooms();
    },

    async fetchRooms() {
        wx.showLoading({ title: '加载房源...' });
        try {
            const res = await request({ url: '/api/rooms/available' });
            if (res && res.success && res.rooms) {
                this.setData({
                    rooms: res.rooms
                });
                this.applyFilters();
            }
        } catch (error) {
            console.error('Fetch rooms failed', error);
            wx.showToast({ title: '加载失败', icon: 'none' });
        } finally {
            wx.hideLoading();
        }
    },

    // Input Handler
    onSearchInput(e) {
        this.setData({ searchText: e.detail.value });
    },

    onSearchConfirm() {
        this.applyFilters();
    },

    // Filter Handler
    toggleFilter(e) {
        const type = e.currentTarget.dataset.type;
        let filters = [...this.data.activeFilters];

        if (filters.includes(type)) {
            filters = filters.filter(t => t !== type);
        } else {
            // Exclusive rental types
            if (['whole', 'shared', 'single'].includes(type)) {
                filters = filters.filter(t => !['whole', 'shared', 'single'].includes(t));
            }
            filters.push(type);
        }

        this.setData({ activeFilters: filters });
        this.applyFilters();
    },

    // Apply filters to rooms and update markers
    applyFilters() {
        let result = this.data.rooms;
        const { searchText, activeFilters } = this.data;

        // 1. Search Text
        if (searchText) {
            const key = searchText.toLowerCase();
            result = result.filter(r =>
                (r.communityName && r.communityName.toLowerCase().includes(key)) ||
                (r.district && r.district.toLowerCase().includes(key)) ||
                (r.street && r.street.toLowerCase().includes(key))
            );
        }

        // 2. Rental Type (0: Whole, 1: Shared, 2: Single)
        if (activeFilters.includes('whole')) {
            result = result.filter(r => r.rentalType === 0);
        }
        if (activeFilters.includes('shared')) {
            result = result.filter(r => r.rentalType === 1);
        }
        if (activeFilters.includes('single')) {
            result = result.filter(r => r.rentalType === 2);
        }

        // 3. Subway Tag
        if (activeFilters.includes('subway')) {
            result = result.filter(r => r.description && r.description.includes('地铁'));
        }

        // 4. Sort Price
        if (activeFilters.includes('price_desc')) {
            result = [...result].sort((a, b) => b.rentPrice - a.rentPrice);
        }

        this.setData({ filteredRooms: result });
        this.updateMarkers(result);
    },

    updateMarkers(rooms) {
        const markers = rooms.map(room => {
            // Handle invalid coords with simple random fallback near center (Mocking the Vue logic)
            let lat = parseFloat(room.latitude);
            let lng = parseFloat(room.longitude);

            if (isNaN(lat) || isNaN(lng)) {
                lat = 22.543099 + (Math.random() - 0.5) * 0.05;
                lng = 114.057868 + (Math.random() - 0.5) * 0.05;
            }

            return {
                id: room.id, // IMPORTANT: Ensure this is set correctly
                latitude: lat,
                longitude: lng,
                width: 32,
                height: 32,
                // Simple Blue Pin Marker (Base64 SVG)
                iconPath: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMyNTYzRUIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJNMjEgMTBjMCA3LTkgMTMtOSAxM3MtOS02LTktMTNhOSA5IDAgMCAxIDE4IDB6Ij48L3BhdGg+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMCIgcj0iMyI+PC9jaXJjbGU+PC9zdmc+',
                // Using custom callout for price bubble
                callout: {
                    content: `¥${room.rentPrice}`,
                    color: '#ffffff',
                    fontSize: 12,
                    borderRadius: 16,
                    bgColor: '#2563EB', // Changed to blue
                    padding: 6,
                    display: 'ALWAYS',
                    textAlign: 'center'
                }
            };
        });

        console.log('Setting markers:', markers.length);
        this.setData({ markers });
    },

    onMarkerTap(e) {
        console.log('Marker tapped! Event:', e);
        const markerId = e.detail.markerId || e.markerId;
        console.log('Marker ID:', markerId);

        const room = this.data.rooms.find(r => r.id === markerId);
        console.log('Found room:', room);

        if (room) {
            // Force refresh by briefly hiding then showing
            this.setData({ showDetail: false });

            setTimeout(() => {
                this.setData({
                    selectedRoom: room,
                    showDetail: true,
                    aiLoading: true,
                    aiItems: []
                });

                // Simulate AI Analysis Delay
                setTimeout(() => {
                    this.simulateAIAnalysis();
                }, 600);
            }, 50);
        } else {
            console.error('Room not found for marker ID:', markerId);
            wx.showToast({
                title: '房源数据未找到',
                icon: 'none'
            });
        }
    },

    simulateAIAnalysis() {
        // Mock data generation with color property for icons
        const pois = [
            { type: 'subway', name: '科学馆地铁站', distance: Math.floor(Math.random() * 500) + 100, color: '#2563EB' },
            { type: 'bus', name: '兴华宾馆西公交站', distance: Math.floor(Math.random() * 300) + 50, color: '#10B981' },
            { type: 'supermarket', name: '沃尔玛购物广场', distance: Math.floor(Math.random() * 800) + 200, color: '#F59E0B' },
            { type: 'hospital', name: '深圳市第二人民医院', distance: Math.floor(Math.random() * 1000) + 500, color: '#EF4444' }
        ];

        // Sort by distance
        pois.sort((a, b) => a.distance - b.distance);

        this.setData({
            aiLoading: false,
            aiItems: pois
        });
    },

    onMapTap() {
        this.setData({ showDetail: false });
    },

    closeDetail() {
        this.setData({ showDetail: false });
    },

    preventBubble() {
        // Prevent click from bubbling to overlay
    },

    // Sidebar Toggle
    toggleSidebar() {
        this.setData({
            sidebarOpen: !this.data.sidebarOpen
        });
    },

    // Region Change Handler (prevents map reset)
    onRegionChange(e) {
        if (e.type === 'end' && e.causedBy === 'drag') {
            this.setData({
                latitude: e.detail.centerLocation.latitude,
                longitude: e.detail.centerLocation.longitude
            });
        }
    },

    // AI Data Completion - Geocode rooms with missing coordinates
    async startAICompletion() {
        const AMAP_KEY = 'f912b11737cbc1bd7c50a495e2112315';

        // Filter rooms needing completion
        const incompleteRooms = this.data.rooms.filter(r =>
            !r.latitude || !r.longitude || isNaN(parseFloat(r.latitude))
        );

        if (incompleteRooms.length === 0) {
            wx.showToast({
                title: '所有房源数据已完善！',
                icon: 'success',
                duration: 2000
            });
            return;
        }

        // Show progress modal
        wx.showLoading({
            title: `准备处理 ${incompleteRooms.length} 个房源...`,
            mask: true
        });

        let successCount = 0;
        let failCount = 0;

        // Process each room sequentially
        for (let i = 0; i < incompleteRooms.length; i++) {
            const room = incompleteRooms[i];

            wx.showLoading({
                title: `处理中 ${i + 1}/${incompleteRooms.length}`,
                mask: true
            });

            try {
                // Build address from room data
                const components = [
                    room.city || '深圳市',
                    room.district || '',
                    room.street || '',
                    room.communityName || ''
                ].filter(Boolean);
                const address = components.join('');

                if (!address) {
                    failCount++;
                    continue;
                }

                // Call AMap Geocoding API
                const geoResult = await this.geocodeAddress(address, AMAP_KEY);

                if (geoResult) {
                    // Update local room data
                    const roomIndex = this.data.rooms.findIndex(r => r.id === room.id);
                    if (roomIndex !== -1) {
                        this.data.rooms[roomIndex].latitude = geoResult.lat;
                        this.data.rooms[roomIndex].longitude = geoResult.lng;
                    }

                    // Update backend
                    const updateSuccess = await this.updateRoomBackend(room.id, {
                        latitude: geoResult.lat,
                        longitude: geoResult.lng
                    });

                    if (updateSuccess) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } else {
                    failCount++;
                }

                // Small delay to avoid API rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.error('Failed to process room:', room.id, error);
                failCount++;
            }
        }

        wx.hideLoading();

        // Show result
        wx.showModal({
            title: 'AI 完善完成',
            content: `成功: ${successCount} 个\n失败: ${failCount} 个`,
            showCancel: false,
            success: () => {
                // Refresh map and data
                this.setData({ rooms: this.data.rooms });
                this.applyFilters();
            }
        });
    },

    // Geocode address using AMap API
    geocodeAddress(address, key) {
        return new Promise((resolve) => {
            wx.request({
                url: 'https://restapi.amap.com/v3/geocode/geo',
                data: {
                    address: address,
                    key: key,
                    city: '深圳'
                },
                success: (res) => {
                    if (res.data.status === '1' && res.data.geocodes && res.data.geocodes.length > 0) {
                        const location = res.data.geocodes[0].location.split(',');
                        resolve({
                            lng: parseFloat(location[0]),
                            lat: parseFloat(location[1])
                        });
                    } else {
                        resolve(null);
                    }
                },
                fail: () => {
                    resolve(null);
                }
            });
        });
    },

    // Update room coordinates in backend
    updateRoomBackend(roomId, data) {
        return new Promise((resolve) => {
            request({
                url: `/api/rooms/update/${roomId}`,
                method: 'PUT',
                data: data
            }).then(() => {
                resolve(true);
            }).catch((error) => {
                console.error('Backend update failed:', error);
                resolve(false);
            });
        });
    },

    navigateToDetail() {
        if (this.data.selectedRoom) {
            wx.navigateTo({
                url: `/packageA/pages/house-tour/house-tour?id=${this.data.selectedRoom.id}`
            });
        }
    },

    goBack() {
        wx.navigateBack();
    }
});
