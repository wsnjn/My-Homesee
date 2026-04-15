const { request } = require('../../utils/request');

Page({
    data: {
        user: null,
        isLoggedIn: false,
        showUserMenu: false,
        isScrolled: false,
        isLongPressing: false,
        appointments: [],
        loadingAppointments: false,
        avatarUrl: 'https://files.homesee.xyz/api/files/download/default-avatar.png',
        displayName: '',
        greetingLine: '你好，旅人',
        greetingTag: '今日也要好好住',
        animReady: false,
        chipPulse: '',
        quickChips: [
            { key: 'repair', text: '水电门锁', icon: 'fix' },
            { key: 'contract', text: '合同', icon: 'empty' },
            { key: 'bill', text: '账单', icon: 'badge' },
            { key: 'platform', text: '找平台', icon: 'building' }
        ],
        serviceMatrix: [
            { key: 'find', label: '找房', icon: 'home', tint: 'linear-gradient(145deg,#ecfdf5,#d1fae5)' },
            { key: 'map', label: '地图找房', icon: 'map', tint: 'linear-gradient(145deg,#ecfeff,#cffafe)' },
            { key: 'book', label: '预定', icon: 'calendar', tint: 'linear-gradient(145deg,#fff7ed,#ffedd5)' },
            { key: 'visit', label: '预约看房', icon: 'camera', tint: 'linear-gradient(145deg,#f5f3ff,#ede9fe)' },
            { key: 'feedback', label: '投诉建议', icon: 'message', tint: 'linear-gradient(145deg,#fef2f2,#fecaca)' },
            { key: 'move', label: '优选搬家', icon: 'location', tint: 'linear-gradient(145deg,#f0fdf4,#bbf7d0)' },
            { key: 'butler', label: '我的管家', icon: 'user', tint: 'linear-gradient(145deg,#eff6ff,#dbeafe)' },
            { key: 'wifi', label: 'WiFi密码', icon: 'wifi', tint: 'linear-gradient(145deg,#f8fafc,#e2e8f0)' }
        ],
        features: [
            {
                id: 1,
                name: '全景看房',
                icon: 'vr',
                description: '全景漫游 · 沉浸式体验 · 360° 浏览',
                page: 'house-selection',
                linkText: '立即体验'
            },
            {
                id: 2,
                name: '智能匹配',
                icon: 'match',
                description: '偏好分析 · 算法推荐 · 更懂你的预算',
                page: 'smart-matching',
                linkText: '开始匹配'
            },
            {
                id: 3,
                name: '安全保障',
                icon: 'safe',
                description: '实名认证 · 交易担保 · 隐私保护',
                page: 'my-appointments',
                linkText: '查看详情'
            },
            {
                id: 4,
                name: '在线报修',
                icon: 'fix',
                description: '在线报修 · 进度追踪 · 快速响应',
                page: 'maintenance',
                linkText: '立即报修'
            },
            {
                id: 6,
                name: '地图找房',
                icon: 'map',
                description: '地图选房 · 区域筛选 · 周边配套',
                page: 'map-search',
                linkText: '查看地图'
            }
        ]
    },

    onLoad() {
        this.checkLoginStatus();
    },

    onReady() {
        setTimeout(() => {
            this.setData({ animReady: true });
        }, 80);
    },

    onShow() {
        this.checkLoginStatus();
    },

    refreshGreeting(displayNameOverride) {
        const hour = new Date().getHours();
        let tag = '把生活过成喜欢的样子';
        if (hour < 6) tag = '夜深了，早点休息';
        else if (hour < 11) tag = '早安，开启元气一天';
        else if (hour < 14) tag = '午安，记得好好吃饭';
        else if (hour < 18) tag = '下午茶时间，放松一下';
        else if (hour < 22) tag = '傍晚好，看看心仪的小窝';
        else tag = '晚安，祝好梦';

        const name =
            displayNameOverride !== undefined && displayNameOverride !== null
                ? (displayNameOverride || '旅人')
                : (this.data.displayName || '旅人');
        const hi =
            hour < 6 ? `嗨，${name}` :
            hour < 11 ? `早安，${name}` :
            hour < 18 ? `你好，${name}` :
            `晚上好，${name}`;

        this.setData({ greetingTag: tag, greetingLine: hi });
    },

    onPageScroll(e) {
        this.setData({
            isScrolled: e.scrollTop > 50
        });
    },

    checkLoginStatus() {
        const user = wx.getStorageSync('user');
        if (user) {
            const displayName = user.realName || user.username || '用户';
            this.setData({
                user,
                isLoggedIn: true,
                displayName,
                avatarUrl: this.getAvatarUrl(user)
            });
            this.refreshGreeting(displayName);
            this.fetchUserAppointments();
        } else {
            this.setData({
                user: null,
                isLoggedIn: false,
                displayName: '',
                avatarUrl: 'https://files.homesee.xyz/api/files/download/default-avatar.png',
                appointments: []
            });
            this.refreshGreeting('');
        }
    },

    getAvatarUrl(user) {
        if (!user || !user.avatar) {
            return 'https://files.homesee.xyz/api/files/download/default-avatar.png';
        }
        if (user.avatar.startsWith('http')) {
            return user.avatar;
        }
        const FILE_SERVER_HOST = 'https://files.homesee.xyz';
        return `${FILE_SERVER_HOST}/api/files/download/${user.avatar}`;
    },

    toggleUserMenu() {
        if (this.data.isLoggedIn) {
            this.setData({
                showUserMenu: !this.data.showUserMenu
            });
        }
    },

    closeUserMenu() {
        this.setData({
            showUserMenu: false
        });
    },

    showUserDetail() {
        this.setData({ isLongPressing: true });
    },

    hideUserDetail() {
        if (this.data.isLongPressing) {
            this.setData({ isLongPressing: false });
        }
    },

    navigateToLogin() {
        wx.navigateTo({ url: '/pages/login/login' });
    },

    navigateToUserProfile() {
        this.closeUserMenu();
        wx.navigateTo({ url: '/packageB/pages/user-profile/user-profile' });
    },

    logout() {
        wx.removeStorageSync('user');
        wx.removeStorageSync('token');
        this.setData({
            user: null,
            isLoggedIn: false,
            showUserMenu: false,
            appointments: []
        });
        wx.showToast({
            title: '已退出登录',
            icon: 'success'
        });
    },

    // Navigation Methods
    navigateToHouseSelection() {
        wx.switchTab({ url: '/pages/house-selection/house-selection' });
    },

    navigateToSmartMatching() {
        wx.navigateTo({ url: '/pages/smart-matching/smart-matching' });
    },

    navigateToMyAppointments() {
        wx.navigateTo({ url: '/packageB/pages/my-appointments/my-appointments' });
    },

    navigateToMaintenance() {
        wx.navigateTo({ url: '/packageB/pages/maintenance/maintenance' });
    },
    navigateToContractCenter() {
        wx.navigateTo({ url: '/packageB/pages/contract-center/contract-center' });
    },
    navigateToBillCenter() {
        wx.navigateTo({ url: '/packageB/pages/bill-center/bill-center' });
    },
    navigateToFeedbackCenter() {
        wx.navigateTo({ url: '/packageB/pages/feedback-center/feedback-center' });
    },
    navigateToMoveService() {
        wx.navigateTo({ url: '/packageB/pages/move-service/move-service' });
    },
    navigateToWifiService() {
        wx.navigateTo({ url: '/packageB/pages/wifi-service/wifi-service' });
    },

    navigateToCommunity() {
        wx.navigateTo({ url: '/pages/community/community' });
    },

    navigateToVirtualWorld() {
        wx.navigateTo({ url: '/packageA/pages/interactive-cube/interactive-cube' });
    },

    navigateToMapSearch() {
        wx.navigateTo({ url: '/pages/map-search/map-search' });
    },

    navigateToMine() {
        wx.switchTab({ url: '/pages/mine/mine' });
    },

    onQuickChipTap(e) {
        const { key } = e.currentTarget.dataset;
        if (!key) return;
        this.setData({ chipPulse: key });
        setTimeout(() => this.setData({ chipPulse: '' }), 420);
        if (key === 'repair') {
            this.navigateToMaintenance();
            return;
        }
        if (key === 'contract' || key === 'bill') {
            key === 'contract' ? this.navigateToContractCenter() : this.navigateToBillCenter();
            return;
        }
        if (key === 'platform') {
            this.navigateToSmartMatching();
        }
    },

    onServiceMatrixTap(e) {
        const { key } = e.currentTarget.dataset;
        const route = {
            find: () => this.navigateToHouseSelection(),
            map: () => this.navigateToMapSearch(),
            book: () => this.navigateToHouseSelection(),
            visit: () => this.navigateToMyAppointments(),
            feedback: () => this.navigateToFeedbackCenter(),
            move: () => this.navigateToMoveService(),
            butler: () => this.navigateToUserProfile(),
            wifi: () => this.navigateToWifiService()
        };
        const fn = route[key];
        if (fn) fn();
    },

    // 功能卡片导航
    navigateToFeature(e) {
        const { page } = e.currentTarget.dataset;
        if (!page) return;

        // Special handling for pages that might be tabs or in subpackages
        const pageMap = {
            'house-selection': { url: '/pages/house-selection/house-selection', type: 'switchTab' },
            'smart-matching': { url: '/pages/smart-matching/smart-matching', type: 'navigate' },
            'map-search': { url: '/pages/map-search/map-search', type: 'navigate' },
            'maintenance': { url: '/packageB/pages/maintenance/maintenance', type: 'navigate' },
            'my-appointments': { url: '/packageB/pages/my-appointments/my-appointments', type: 'navigate' },
            'user-profile': { url: '/packageB/pages/user-profile/user-profile', type: 'navigate' }
        };

        const target = pageMap[page];
        if (target) {
            if (target.type === 'switchTab') {
                wx.switchTab({ url: target.url });
            } else {
                wx.navigateTo({ url: target.url });
            }
        } else {
            // Fallback for direct path usage or unknown keys
            wx.navigateTo({
                url: `/pages/${page}/${page}`, fail: () => {
                    // Try packageA/B as fallback if simple path fails?
                    // For now, allow failing if not in map to encourage mapped safety
                    console.warn(`Page ${page} not found in map and direct navigation failed.`);
                }
            });
        }
    },

    // API Methods
    async fetchUserAppointments() {
        if (!this.data.user) return;

        this.setData({ loadingAppointments: true });
        try {
            const res = await request({
                url: `/api/viewing-appointment/user/${this.data.user.id}`
            });

            // Process appointments for display
            let appointmentList = [];
            if (Array.isArray(res)) {
                appointmentList = res;
            } else if (res && Array.isArray(res.data)) {
                appointmentList = res.data;
            } else if (res && res.content && Array.isArray(res.content)) {
                appointmentList = res.content;
            }

            const processedAppointments = appointmentList.map(apt => ({
                ...apt,
                statusText: this.getAppointmentStatusText(apt.status),
                statusClass: this.getStatusClass(apt.status),
                typeText: apt.type === 1 ? '现场看房' : '视频看房',
                formattedTime: this.formatDate(apt.appointmentTime)
            }));

            this.setData({
                appointments: processedAppointments
            });
        } catch (error) {
            console.error('获取预约信息失败', error);
        } finally {
            this.setData({ loadingAppointments: false });
        }
    },

    getAppointmentStatusText(status) {
        const statusMap = {
            0: '待确认',
            1: '已确认',
            2: '已完成',
            3: '已取消',
            4: '已过期',
            5: '用户爽约'
        };
        return statusMap[status] || '未知状态';
    },

    getStatusClass(status) {
        const statusClassMap = {
            0: 'status-pending',
            1: 'status-confirmed',
            2: 'status-completed',
            3: 'status-cancelled',
            4: 'status-expired',
            5: 'status-missed'
        };
        return statusClassMap[status] || 'status-unknown';
    },

    formatDate(dateString) {
        if (!dateString) return '未设置';
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN');
    }
});
