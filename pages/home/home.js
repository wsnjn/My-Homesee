const { request } = require('../../utils/request');

Page({
    data: {
        user: null,
        isLoggedIn: false,
        showUserMenu: false,
        isScrolled: false,
        appointments: [],
        loadingAppointments: false,
        avatarUrl: '/models/image/default-avatar.png',
        displayName: '',
        // 功能卡片数据
        features: [
            {
                id: 1,
                name: 'VR漫游看房',
                icon: 'vr',
                description: '体验沉浸式的房屋漫游功能，支持360度全景浏览和场景切换',
                page: 'house-tour',
                color: 'linear-gradient(135deg, #667eea, #764ba2)'
            },
            {
                id: 2,
                name: '智能匹配',
                icon: 'match',
                description: '根据您的偏好和预算，智能推荐最适合的房源',
                page: 'smart-matching',
                color: 'linear-gradient(135deg, #FF9A9E, #FECFEF)'
            },
            {
                id: 3,
                name: '安全保障',
                icon: 'safe',
                description: '严格的房源审核机制，确保每一笔交易的安全可靠',
                page: 'my-appointments',
                color: 'linear-gradient(135deg, #a18cd1, #fbc2eb)'
            },
            {
                id: 4,
                name: '维修处理',
                icon: 'fix',
                description: '房屋维修服务，快速响应您的维修需求',
                page: 'maintenance',
                color: 'linear-gradient(135deg, #84fab0, #8fd3f4)'
            },
            {
                id: 5,
                name: '社区交流',
                icon: 'community',
                description: '与邻居交流，分享生活点滴，建立社区联系',
                page: 'community',
                color: 'linear-gradient(135deg, #fccb90, #d57eeb)'
            },
            {
                id: 6,
                name: '交互方块',
                icon: 'virtual',
                description: '探索全息交互的未来实验场，体验多维空间',
                page: 'interactive-cube',
                color: 'linear-gradient(135deg, #00f2ff, #007bff)'
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
            const tabPages = ['home', 'house-selection', 'smart-matching'];
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
