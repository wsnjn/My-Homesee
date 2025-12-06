// pages/house-tour/house-tour.js
import { createScopedThreejs } from 'threejs-miniprogram'
const { request } = require('../../utils/request');

Page({
  data: {
    houseId: '',
    currentScene: null,
    currentSceneIndex: 0,
    naviData: [],
    loading: true,
    error: null,
    showSceneSelector: true, // 控制场景选择器显示
    // 默认场景配置
    defaultScenes: [
      {
        scene: {
          id: 1,
          title: '客厅',
          is_main: 1,
          sphereSource: { url: '/images/models/客厅.jpg' }
        }
      },
      {
        scene: {
          id: 2,
          title: '卧室',
          is_main: 0,
          sphereSource: { url: '/images/models/卧室.jpg' }
        }
      },
      {
        scene: {
          id: 3,
          title: '厨房',
          is_main: 0,
          sphereSource: { url: '/images/models/厨房.jpg' }
        }
      }
    ],
    // 默认纹理路径
    defaultTextures: [
      '/images/models/客厅.jpg',
      '/images/models/卧室.jpg',
      '/images/models/厨房.jpg'
    ]
  },

  onLoad(options) {
    const houseId = options.id || options.houseId;
    if (houseId) {
      this.setData({ houseId, loading: true });

      // Initialize Three.js first
      this.initThreeJs(() => {
        // Then load house info
        this.loadHouseInfo(houseId);
      });
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
    }
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
      // 直接使用默认场景，避免API请求失败
      console.log('Using default demo scenes for house tour');
      this.createDemoScenes();
      
      // 可选：尝试加载房屋信息用于标题（但不阻塞）
      try {
        const houseRes = await request({
          url: `/api/room-info/${houseId}`,
          method: 'GET'
        });
        if (houseRes && houseRes.success && houseRes.room) {
          wx.setNavigationBarTitle({
            title: `${houseRes.room.communityName} - VR漫游`
          });
        }
      } catch (titleError) {
        console.log('Failed to load house title, using default:', titleError);
        wx.setNavigationBarTitle({
          title: 'VR全景看房'
        });
      }
    } catch (error) {
      console.error('Failed to load house info:', error);
      this.setData({ loading: false });
      // Use default demo scenes
      this.createDemoScenes();
    }
  },

  initThree(canvas) {
    this.canvas = canvas;
    const THREE = createScopedThreejs(canvas)
    this.THREE = THREE;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);
    this.scene = scene;

    // Camera - 放置在球体中心，看向正前方
    const camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
    camera.position.set(0, 0, 0); // 在球体中心
    this.camera = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      canvas: canvas // 关键：将canvas传递给renderer
    });
    renderer.setSize(canvas.width, canvas.height);
    // 使用新的API替代已弃用的wx.getSystemInfoSync().pixelRatio
    const windowInfo = wx.getWindowInfo();
    renderer.setPixelRatio(windowInfo.pixelRatio);
    this.renderer = renderer;

    // Controls state
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.lon = 0; // 经度
    this.lat = 0; // 纬度

    // 初始渲染一个简单的球体，等待纹理加载
    this.createInitialSphere();

    // Animation loop
    const render = () => {
      if (!this.renderer) return;
      this.requestId = canvas.requestAnimationFrame(render);

      // 更新相机方向
      this.updateCameraRotation();

      renderer.render(scene, camera);
    };
    render();
  },

  // 创建初始球体（无纹理）
  createInitialSphere() {
    const THREE = this.THREE;
    if (!THREE) return;

    // 创建简单的测试球体
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1); // 翻转X轴，使面朝内

    const material = new THREE.MeshBasicMaterial({
      color: 0x444444,
      side: THREE.DoubleSide,
      wireframe: true // 线框模式，便于调试
    });

    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);
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

  loadScene(sceneData) {
    console.log('loadScene called with:', sceneData);
    
    if (!this.scene || !this.THREE) {
      console.error('Three.js not initialized');
      return;
    }

    this.setData({ 
      currentScene: sceneData,
      loading: true // 确保在加载新场景时显示loading
    });
    const THREE = this.THREE;

    // Get texture URL
    let textureUrl = sceneData.scene.sphereSource?.thumb || sceneData.scene.sphereSource?.url;

    if (!textureUrl) {
      // Use default texture from local images
      const defaultIndex = Math.floor(Math.random() * this.data.defaultTextures.length);
      textureUrl = this.data.defaultTextures[defaultIndex];
    }

    console.log('Loading texture from:', textureUrl);

    // 在小程序中使用 canvas.createImage() 加载图片
    const canvas = this.canvas;
    const img = canvas.createImage();

    img.onload = () => {
      console.log('Image loaded successfully, creating texture...');

      // 清除之前的球体
      if (this.sphere) {
        this.scene.remove(this.sphere);
        this.sphere = null;
      }

      // 使用加载的图片创建纹理
      const texture = new THREE.Texture(img);
      texture.minFilter = THREE.LinearFilter; // Fix for non-power-of-two textures
      texture.needsUpdate = true;

      // 创建球体几何体
      const geometry = new THREE.SphereGeometry(500, 60, 40);
      // 翻转X轴，使所有面朝内（从内部观看）
      geometry.scale(-1, 1, 1);

      // 创建带纹理的材质
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide
      });

      // 创建球体网格
      const sphere = new THREE.Mesh(geometry, material);
      this.sphere = sphere;
      this.scene.add(sphere);

      // 重置相机视角
      this.lon = 0;
      this.lat = 0;
      this.updateCameraRotation();

      // 更新加载状态 - 确保loading为false，但保持场景选择器显示
      this.setData({ 
        loading: false
      });

      console.log('Sphere created and added to scene, loading set to false');
      wx.showToast({ title: '场景加载完成', icon: 'success', duration: 1500 });
    };

    img.onerror = (err) => {
      console.error('Image load failed:', err);
      wx.showToast({ title: '图片加载失败', icon: 'none' });

      // 回退到默认纹理
      this.loadDefaultTexture();
    };

    // 设置图片源 - 本地路径直接使用
    img.src = textureUrl;
  },

  loadDefaultTexture() {
    const THREE = this.THREE;
    if (!THREE) return;

    // 清除之前的球体
    if (this.sphere) {
      this.scene.remove(this.sphere);
      this.sphere = null;
    }

    // 创建简单的彩色球体作为回退
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1); // 翻转X轴

    // 在小程序中，直接使用纯色材质
    const material = new THREE.MeshBasicMaterial({
      color: 0x3498db,
      side: THREE.DoubleSide
    });
    const sphere = new THREE.Mesh(geometry, material);

    this.sphere = sphere;
    this.scene.add(sphere);

    // 更新加载状态
    this.setData({ loading: false });

    console.log('Default texture sphere created');
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

  // Scene selection handler
  onSceneSelect(e) {
    const index = e.currentTarget.dataset.index;
    const { naviData, currentSceneIndex } = this.data;

    // Don't reload if same scene
    if (index === currentSceneIndex) return;

    if (naviData && naviData[index]) {
      this.setData({
        currentSceneIndex: index,
        loading: true
      });
      this.loadScene(naviData[index]);
    }
  }
})
