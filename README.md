# HOMESEE - 智能找房微信小程序

## 项目简介

HOMESEE 是一个基于微信小程序的智能找房平台，集成了房源浏览、智能匹配、社区互动、AR看房、在线预约、房屋维护等多种功能，为用户提供全方位的房屋租赁和购买服务体验。

## 功能特性

### 🏠 核心功能
- **智能找房**：根据用户偏好和位置智能推荐房源
- **AR看房**：使用 Three.js 实现 3D 房屋模型展示和 AR 看房体验
- **智能匹配**：基于用户需求和房源特征进行智能匹配
- **在线预约**：支持在线看房预约和房东沟通

### 👥 社交功能
- **社区互动**：用户可以在社区分享租房经验和房源信息
- **朋友圈**：类似社交媒体的功能，分享生活动态
- **即时聊天**：内置聊天区域，方便用户间沟通

### 🛠️ 管理功能
- **房屋维护**：报修和维护管理功能
- **房东管理**：房东专属管理界面
- **预约管理**：查看和管理所有预约记录
- **用户管理**：个人资料和偏好设置

### 🎯 特色功能
- **交互式立方体**：3D 交互体验展示
- **智能推荐**：基于机器学习算法的个性化推荐
- **位置服务**：基于地理位置推荐附近房源
- **多媒体支持**：支持图片、3D 模型等多种媒体格式

## 技术栈

### 前端
- **微信小程序**：原生小程序开发
- **Three.js**：3D 图形渲染和 AR 功能
- **WXML/WXSS**：小程序特有的模板和样式语言
- **JavaScript**：业务逻辑实现

### 主要依赖
- `threejs-miniprogram`：小程序 Three.js 适配版本

### 开发工具
- 微信开发者工具
- Visual Studio Code

## 项目结构

```
miniprogram-1/
├── app.js              # 小程序入口文件
├── app.json            # 小程序全局配置
├── app.wxss            # 全局样式
├── components/         # 自定义组件
│   ├── dino-overlay/   # 恐龙覆盖层组件
│   └── svg-icon/       # SVG图标组件
├── pages/              # 页面目录
│   ├── login/          # 登录页面
│   ├── home/           # 首页
│   ├── house-selection/# 找房页面
│   ├── smart-matching/ # 智能匹配页面
│   ├── community/      # 社区页面
│   ├── house-tour/     # AR看房页面
│   ├── maintenance/    # 维护页面
│   └── ...             # 其他页面
├── utils/              # 工具函数
│   ├── request.js      # 网络请求封装
│   └── util.js         # 通用工具函数
├── images/             # 图片资源
├── models/             # 3D模型资源
└── miniprogram_npm/    # npm包构建目录
```

## 快速开始

### 环境要求
- 微信开发者工具（最新版本）
- 微信小程序账号（已注册并获取 AppID）
- Node.js（用于包管理）

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/wsnjn/My-Homesee.git
   cd My-Homesee
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **构建 npm 包**
   - 在微信开发者工具中点击"工具" -> "构建 npm"
   - 或使用命令行：`npm run build`

4. **配置项目**
   - 在微信开发者工具中导入项目
   - 使用 AppID: `wxb8de339b871e7a90`（或替换为自己的 AppID）
   - 确保项目目录正确指向 `miniprogram-1`

5. **运行项目**
   - 点击微信开发者工具中的"编译"按钮
   - 在模拟器或真机预览

## 页面说明

### 主要页面

1. **首页 (Home)**
   - 功能入口和推荐房源展示
   - 快速搜索和分类浏览

2. **找房 (House Selection)**
   - 房源列表和筛选功能
   - 地图模式查看附近房源

3. **智能匹配 (Smart Matching)**
   - 根据用户偏好智能推荐
   - 匹配度分析和房源对比

4. **AR看房 (House Tour)**
   - 3D房屋模型展示
   - AR实景看房体验

5. **社区 (Community)**
   - 用户交流和经验分享
   - 房源评价和讨论

## 权限说明

小程序需要以下权限：
- **位置权限**：用于推荐附近的房源
- **相机权限**：用于AR看房和图片上传
- **麦克风权限**：用于语音交互

## 开发指南

### 添加新页面
1. 在 `pages` 目录下创建新页面文件夹
2. 在 `app.json` 的 `pages` 数组中添加页面路径
3. 创建对应的 `.js`、`.wxml`、`.wxss`、`.json` 文件

### 自定义组件开发
1. 在 `components` 目录下创建组件文件夹
2. 在组件的 `.json` 文件中设置 `"component": true`
3. 在需要使用的页面的 `.json` 文件中引入组件

### 数据请求
使用 `utils/request.js` 封装的请求方法：
```javascript
const request = require('../../utils/request.js')

// 发起请求
request({
  url: '/api/endpoint',
  method: 'GET',
  success: function(res) {
    console.log(res.data)
  }
})
```

## 部署发布

### 测试环境
1. 在微信开发者工具中上传代码
2. 提交审核前进行充分测试
3. 使用体验版进行小范围测试

### 生产环境
1. 确保所有功能测试通过
2. 提交微信审核
3. 审核通过后发布上线

## 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request


## 更新日志

### v1.0.0 (2025-12-06)
- 初始版本发布
- 包含核心找房功能
- 集成 AR 看房和智能匹配
- 完整的社交和管理功能

---

**温馨提示**：使用小程序前请确保已阅读并同意相关隐私政策和服务条款。
