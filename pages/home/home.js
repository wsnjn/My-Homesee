const { request } = require('../../utils/request');

Page({
    data: {
        user: null,
        isLoggedIn: false,
        showUserMenu: false,
        isScrolled: false,
        isLongPressing: false, // For tooltip
        appointments: [],
        loadingAppointments: false,
        avatarUrl: '/models/image/default-avatar.png',
        displayName: '',
        // 功能卡片数据 - 与Vue3前端对齐
        features: [
            {
                id: 1,
                name: '全景看房',
                icon: 'vr',
                description: '全景漫游 / 沉浸式体验 / 360度浏览',
                page: 'house-selection',
                linkText: '立即体验'
            },
            {
                id: 2,
                name: '智能匹配',
                icon: 'match',
                description: '智能算法 / 偏好分析 / 精准推荐',
                page: 'smart-matching',
                linkText: '开始匹配'
            },
            {
                id: 3,
                name: '安全保障',
                icon: 'safe',
                description: '实名认证 / 交易担保 / 隐私保护',
                page: 'my-appointments',
                linkText: '查看详情'
            },
            {
                id: 4,
                name: '在线报修',
                icon: 'fix',
                description: '在线报修 / 进度追踪 / 快速响应',
                page: 'maintenance',
                linkText: '立即报修'
            },
            {
                id: 5,
                name: '社区互动',
                icon: 'community',
                description: '邻里互动 / 经验分享 / 活动组织',
                page: 'community',
                linkText: '加入社区'
            },
            {
                id: 6,
                name: '地图找房',
                icon: 'map',
                description: '地图选房 / 区域筛选 / 周边配套',
                page: 'map-search',
                linkText: '查看地图'
            }
        ]
    },

    onLoad() {
        // Check login status
        this.checkLoginStatus();
    },

    onShow() {
        // Re-check login status every time page shows (in case of logout elsewhere)
        this.checkLoginStatus();
    },

    onPageScroll(e) {
        this.setData({
            isScrolled: e.scrollTop > 50
        });
    },

    checkLoginStatus() {
        const user = wx.getStorageSync('user');
        if (user) {
            this.setData({
                user,
                isLoggedIn: true,
                displayName: user.realName || user.username || '用户',
                avatarUrl: this.getAvatarUrl(user)
            });
            this.fetchUserAppointments();
        } else {
            this.setData({
                user: null,
                isLoggedIn: false,
                displayName: '',
                avatarUrl: '/models/image/default-avatar.png',
                appointments: []
            });
        }
    },

    getAvatarUrl(user) {
        if (!user || !user.avatar) {
            return '/models/image/default-avatar.png';
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
        wx.navigateTo({ url: '/pages/login/login' }); // Assuming login page exists or will exist
    },

    navigateToUserProfile() {
        this.closeUserMenu();
        wx.navigateTo({ url: '/pages/user-profile/user-profile' });
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
        wx.switchTab({ url: '/pages/smart-matching/smart-matching' });
    },

    navigateToMyAppointments() {
        wx.navigateTo({ url: '/pages/my-appointments/my-appointments' });
    },

    navigateToMaintenance() {
        wx.navigateTo({ url: '/pages/maintenance/maintenance' });
    },

    navigateToCommunity() {
        wx.navigateTo({ url: '/pages/community/community' });
    },

    navigateToVirtualWorld() {
        wx.navigateTo({ url: '/pages/interactive-cube/interactive-cube' });
    },

    // 功能卡片导航
    navigateToFeature(e) {
        const { page } = e.currentTarget.dataset;
        if (page) {
            const tabPages = ['home', 'house-selection', 'smart-matching', 'map-search'];
            if (tabPages.includes(page)) {
                wx.switchTab({ url: `/pages/${page}/${page}` });
            } else {
                wx.navigateTo({ url: `/pages/${page}/${page}` });
            }
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
