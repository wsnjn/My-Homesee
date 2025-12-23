// pages/house-tour/house-tour.js
import { createScopedThreejs } from 'threejs-miniprogram'
const { request } = require('../../../utils/request');

Page({
  data: {
    houseId: '',
    currentScene: null,
    currentSceneIndex: 0,
    naviData: [],
    loading: true,
    error: null,
    showSceneSelector: false, // 默认不显示场景选择面板

    // 智能助手相关
    assistantCollapsed: true, // 默认收起
    inputText: '',
    messages: [], // 聊天记录
    aiLoading: false,
    scrollToMessageId: '', // 滚动到最新消息
    // 默认场景配置
    defaultScenes: [
      {
        scene: {
          id: 1,
          title: '客厅',
          is_main: 1,
          sphereSource: { url: 'https://files.homesee.xyz/api/files/download/客厅.jpg' }
        }
      },
      {
        scene: {
          id: 2,
          title: '卧室',
          is_main: 0,
          sphereSource: { url: 'https://files.homesee.xyz/api/files/download/卧室.jpg' }
        }
      },
      {
        scene: {
          id: 3,
          title: '厨房',
          is_main: 0,
          sphereSource: { url: 'https://files.homesee.xyz/api/files/download/厨房.jpg' }
        }
      }
    ],
    // 默认纹理路径
    defaultTextures: [
      'https://files.homesee.xyz/api/files/download/客厅.jpg',
      'https://files.homesee.xyz/api/files/download/卧室.jpg',
      'https://files.homesee.xyz/api/files/download/厨房.jpg'
    ]
  },

  onLoad(options) {
    const houseId = options.id || options.houseId;

    this.setData({ houseId, loading: true });

    // Initialize Three.js first
    this.initThreeJs(() => {
      if (houseId) {
        // Load specific house info if ID is present
        this.loadHouseInfo(houseId);
      } else {
        // Otherwise load demo scenes for "Feature Experience"
        wx.showToast({ title: 'VR体验模式', icon: 'none' });
        this.createDemoScenes();
        this.setData({ loading: false });
      }
    });
  },

  onUnload() {
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    if (this.scene) {
      this.scene = null;
    }
    if (this.THREE) {
      this.THREE = null;
    }
    // Cancel animation frame
    if (this.requestId) {
      this.canvas.cancelAnimationFrame(this.requestId);
    }
  },

  initThreeJs(callback) {
    wx.createSelectorQuery()
      .select('#webgl')
      .node()
      .exec((res) => {
        if (res[0] && res[0].node) {
          const canvas = res[0].node;
          this.initThree(canvas);
          if (callback) callback();
        } else {
          console.error('Canvas not found');
          this.setData({ error: 'Canvas初始化失败', loading: false });
          wx.showToast({ title: '3D渲染初始化失败', icon: 'none' });
        }
      });
  },

  async loadHouseInfo(houseId) {
    try {
      // 1. 获取房屋基本信息
      const houseRes = await request({
        url: `/api/room-info/${houseId}`,
        method: 'GET'
      });
      if (houseRes && houseRes.success && houseRes.room) {
        wx.setNavigationBarTitle({
          title: `${houseRes.room.communityName} - VR漫游`
        });
        this.roomInfo = houseRes.room;
      }

      // 2. 获取VR场景列表
      await this.loadVrScenes(houseId);

    } catch (error) {
      console.error('Failed to load house info:', error);
      this.setData({ loading: false });
      // Fallback if critical failure
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  },

  // 加载VR场景列表
  async loadVrScenes(houseId) {
    try {
      const res = await request({
        url: `/api/vr-scenes/${houseId}`,
        method: 'GET'
      });

      if (res && res.success && res.data && res.data.length > 0) {
        const scenes = res.data.map(scene => ({
          scene: {
            photo_key: scene.id.toString(),
            title: scene.sceneName,
            sphereSource: {
              url: this.ensureHttps(scene.imageUrl),
              thumb: this.ensureHttps(scene.imageUrl)
            }
          }
        }));

        this.setData({
          naviData: scenes,
          currentSceneIndex: 0, // 默认第一个
          loading: true // loadScene will handle loading state
        });

        // 加载第一个场景
        this.loadScene(scenes[0]);

      } else {
        console.log('No VR scenes found, using demo scenes');
        wx.showToast({ title: '使用演示全景图', icon: 'none' });
        this.createDemoScenes();
      }
    } catch (err) {
      console.error('Load VR scenes failed:', err);
      // Fallback to demo scenes on error
      this.createDemoScenes();
    }
  },

  // 确保URL为HTTPS
  ensureHttps(url) {
    if (!url) return '';
    if (url.startsWith('http')) {
      return url.replace('http://', 'https://');
    }
    // 处理相对路径或不完整路径
    if (url.startsWith('/')) {
      return `https://files.homesee.xyz${url}`;
    }
    return `https://files.homesee.xyz/${url}`;
  },

  initThree(canvas) {
    this.canvas = canvas;
    const THREE = createScopedThreejs(canvas)
    this.THREE = THREE;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    this.scene = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
    camera.position.set(0, 0, 0);
    this.camera = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas,
      preserveDrawingBuffer: true // Restore this to prevent buffer clearing/black screen artifacts
    });

    const info = wx.getSystemInfoSync();
    renderer.setPixelRatio(info.pixelRatio);
    renderer.setSize(canvas.width, canvas.height);
    this.renderer = renderer;

    // Controls state
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.lon = 0;
    this.lat = 0;

    this.createInitialSphere();

    // Animation loop
    const render = () => {
      if (!this.renderer) return;
      this.requestId = canvas.requestAnimationFrame(render);
      this.updateCameraRotation();
      renderer.render(scene, camera);
    };
    render();
  },

  loadScene(sceneData) {
    console.log('loadScene called with:', sceneData);

    if (!this.scene || !this.THREE) {
      console.error('Three.js not initialized');
      return;
    }

    this.setData({
      currentScene: sceneData,
      loading: true
    });
    const THREE = this.THREE;

    // Get texture URL
    let textureUrl = sceneData.scene.sphereSource?.thumb || sceneData.scene.sphereSource?.url;

    if (!textureUrl) {
      const defaultIndex = Math.floor(Math.random() * this.data.defaultTextures.length);
      textureUrl = this.data.defaultTextures[defaultIndex];
    }

    console.log('Starting texture load process for:', textureUrl);

    // Use wx.downloadFile first to ensure local access and avoid CORS/tainting issues on WebGL
    wx.downloadFile({
      url: textureUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          const tempFilePath = res.tempFilePath;
          console.log('Example downloaded to:', tempFilePath);

          const canvas = this.canvas;
          const img = canvas.createImage();

          img.onload = () => {
            console.log('Image object loaded');
            if (this.sphere) {
              this.scene.remove(this.sphere);
            }

            const texture = new THREE.Texture(img);
            texture.minFilter = THREE.LinearFilter;
            texture.needsUpdate = true;
            // Try to set encoding if available in this version of threejs-miniprogram
            // texture.encoding = THREE.sRGBEncoding; 

            const geometry = new THREE.SphereGeometry(500, 60, 40);
            geometry.scale(-1, 1, 1);

            const material = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide // Ensure visibility from both sides
            });

            this.sphere = new THREE.Mesh(geometry, material);
            this.scene.add(this.sphere);

            // Reset view
            this.lon = 0;
            this.lat = 0;
            this.updateCameraRotation();

            this.setData({ loading: false });
            wx.showToast({ title: '加载成功', icon: 'success' });
          };

          img.onerror = (e) => {
            console.error('Image object error:', e);
            this.loadDefaultTexture();
          };

          img.src = tempFilePath;
        } else {
          console.error('Download failed, status:', res.statusCode);
          this.loadDefaultTexture();
        }
      },
      fail: (err) => {
        console.error('Download file API failed:', err);
        // Fallback: try setting src directly (e.g. if it was already a local file or download failed)
        // But usually download failure means network issue
        this.loadDefaultTexture();
      }
    });
  },

  createInitialSphere() {
    // Optional: create a wireframe or loading sphere
  },

  loadDefaultTexture() {
    this.setData({ loading: false });
    wx.showToast({ title: '加载失败', icon: 'none' });
  },

  // 更新相机旋转
  updateCameraRotation() {
    const THREE = this.THREE;
    if (!THREE || !this.camera) return;

    // 限制纬度范围
    this.lat = Math.max(-85, Math.min(85, this.lat));

    // 将经纬度转换为球面坐标
    const phi = THREE.Math.degToRad(90 - this.lat);
    const theta = THREE.Math.degToRad(this.lon);

    // 计算看向的目标点（在球体表面上）
    const target = new THREE.Vector3();
    target.x = Math.sin(phi) * Math.cos(theta);
    target.y = Math.cos(phi);
    target.z = Math.sin(phi) * Math.sin(theta);

    // 相机在球体中心，看向球体表面
    this.camera.lookAt(target);
  },

  createDemoScenes() {
    // 使用默认场景配置
    const { defaultScenes } = this.data;

    this.setData({
      naviData: defaultScenes,
      currentSceneIndex: 0,
      showSceneSelector: true // 确保场景选择器显示
    });

    console.log('Demo scenes created, naviData length:', defaultScenes.length);

    // 加载第一个场景
    if (defaultScenes.length > 0) {
      this.loadScene(defaultScenes[0]);
    }
  },

  setInitialScene() {
    const { naviData } = this.data;
    if (!naviData || naviData.length === 0) {
      this.createDemoScenes();
      return;
    }

    // Find main scene or first scene
    let initialSceneIndex = naviData.findIndex(item => item.scene.is_main === 1);
    if (initialSceneIndex === -1) initialSceneIndex = 0;

    this.setData({ currentSceneIndex: initialSceneIndex });
    this.loadScene(naviData[initialSceneIndex]);
  },

  // Touch Events for rotation
  onTouchStart(e) {
    this.isDragging = true;
    this.previousMousePosition = {
      x: e.touches[0].x,
      y: e.touches[0].y
    };
  },

  onTouchMove(e) {
    if (!this.isDragging) return;

    const deltaX = e.touches[0].x - this.previousMousePosition.x;
    const deltaY = e.touches[0].y - this.previousMousePosition.y;

    this.lon -= deltaX * 0.1;
    this.lat += deltaY * 0.1;

    this.previousMousePosition = {
      x: e.touches[0].x,
      y: e.touches[0].y
    };
  },

  onTouchEnd() {
    this.isDragging = false;
  },

  // Retry button handler
  onRetry() {
    const { houseId } = this.data;
    if (houseId) {
      this.setData({
        loading: true,
        error: null
      });
      this.loadHouseInfo(houseId);
    } else {
      // If no houseId, reload the page
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        currentPage.onLoad(currentPage.options);
      }
    }
  },

  // === 新增UI交互逻辑 ===

  // 1. 切换场景控制面板
  toggleControls() {
    this.setData({
      showControls: !this.data.showControls,
      assistantCollapsed: true // 互斥：打开场景时，收起助手
    });
  },

  // 场景选择
  onSceneSelect(e) {
    const index = e.currentTarget.dataset.index;
    const { naviData, currentSceneIndex } = this.data;

    // Don't reload if same scene
    if (index === currentSceneIndex) return;

    if (naviData && naviData[index]) {
      this.setData({
        currentSceneIndex: index,
        loading: true,
        // showControls: false // 保持展开方便连续切换? 或者收起? 用户体验更好是保持展开直到点击关闭
      });
      this.loadScene(naviData[index]);
    }
  },

  // 2. 智能助手交互
  toggleAssistant() {
    this.setData({
      assistantCollapsed: !this.data.assistantCollapsed,
      showControls: false // 互斥：打开助手时，收起场景
    });
  },

  onInput(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  // 截图当前场景
  captureScreenshot() {
    return new Promise((resolve) => {
      if (!this.canvas) {
        resolve(null);
        return;
      }
      try {
        // 使用 wx.canvasToTempFilePath
        wx.canvasToTempFilePath({
          canvas: this.canvas,
          fileType: 'jpg',    // 使用 jpg 减小体积
          quality: 0.6,       // 压缩质量 0.6
          success: (res) => {
            // 读取文件内容为base64
            wx.getFileSystemManager().readFile({
              filePath: res.tempFilePath,
              encoding: 'base64',
              success: (r) => {
                // jpg base64 header
                resolve('data:image/jpeg;base64,' + r.data);
              },
              fail: (err) => {
                console.error('Read file failed', err);
                resolve(null);
              }
            });
          },
          fail: (err) => {
            console.error('Screenshot failed', err);
            resolve(null);
          }
        });
      } catch (e) {
        console.error('Screenshot exception', e);
        resolve(null);
      }
    });
  },

  async sendMessage() {
    const text = this.data.inputText.trim();
    if (!text || this.data.aiLoading) return;

    // 添加用户消息
    const userMsg = { role: 'user', content: text };
    const newMessages = [...this.data.messages, userMsg];

    this.setData({
      messages: newMessages,
      inputText: '',
      aiLoading: true,
      scrollToMessageId: `msg-${newMessages.length - 1}`
    });

    try {
      // 截图
      console.log('Capturing screenshot for AI...');
      const screenshot = await this.captureScreenshot();

      console.log('Sending to AI API...', { text, hasScreenshot: !!screenshot });

      // 调用后端API
      const response = await request({
        url: '/api/ai/house-tour/chat',
        method: 'POST',
        timeout: 30000, // 增加超时时间到30秒
        data: {
          message: text,
          screenshot: screenshot,
          roomInfo: this.roomInfo || {}, // 传递当前房屋信息
          userId: 1 // TODO: get real user ID
        }
      });

      if (response && response.success) {
        // 后端返回HTML，需要剥离标签以在cover-view显示
        // 简单处理：<br> -> \n, <p> -> \n, 移除其他标签
        let cleanContent = response.message
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '') // 移除剩余标签
          .trim();

        const aiMsg = { role: 'assistant', content: cleanContent };
        const updatedMessages = [...newMessages, aiMsg];
        this.setData({
          messages: updatedMessages,
          scrollToMessageId: `msg-${updatedMessages.length - 1}`
        });
      } else {
        // 模拟回复
        setTimeout(() => {
          const mockReply = { role: 'assistant', content: '收到您的问题：' + text };
          const updatedMessages = [...newMessages, mockReply];
          this.setData({
            messages: updatedMessages,
            scrollToMessageId: `msg-${updatedMessages.length - 1}`
          });
        }, 1000);
      }

    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = { role: 'assistant', content: '抱歉，网络连接似乎有点问题。' };
      const updatedMessages = [...newMessages, errorMsg];
      this.setData({
        messages: updatedMessages,
        scrollToMessageId: `msg-${updatedMessages.length - 1}`
      });
    } finally {
      this.setData({ aiLoading: false });
    }
  }
})
