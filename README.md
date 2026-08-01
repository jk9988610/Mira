# Mira

2D 圆形吞噬游戏 — 支持手柄全程操控，面向安卓平板横屏。

> **当前阶段：M0 菜单与输入** — 详见 [docs/OUTLINE.md](docs/OUTLINE.md) · [在线预览](https://jk9988610.github.io/Mira/)

## 项目愿景

| 项目 | 说明 |
|------|------|
| **名称** | Mira |
| **目标** | 设计一款可用**手柄外设**全程操控的 App |
| **核心玩法** | 控制圆形在有限 2D 空间中移动、摄取颗粒与其他圆形，质量增长带来视野扩大与世界缩放 |
| **参考项目** | [ElecDog](https://github.com/jk9988610/elecdog)（工程习惯与 App 交付路径） |

## 开发平台

| 角色 | 工具 | 职责 |
|------|------|------|
| 代码开发 | Cursor + 本 GitHub 仓库 | 游戏逻辑、UI、文档、CI |
| 原型预览 | GitHub Pages | 浏览器 / WebView 快速迭代 |
| APK 构建与真机测试 | 安卓平板 + Termux | Gradle 构建、手柄与横屏验证 |
| 云端（后期） | Supabase | 存档、排行榜、设置同步 |

## 功能规划

### 阶段 M0 — 菜单与输入（当前优先）

- [x] **主菜单**：开始游戏、按键绑定、设置、退出
- [x] **手柄全程可操控**：菜单焦点导航、确认、返回，无需触屏
- [x] **按键绑定页**：摇杆 / 方向键移动、A 确认、B 返回、肩键等可自定义并本地保存
- [x] **进入游戏**：从菜单进入对局（含暂停菜单与基础移动）

### 阶段 M1 — 核心对局

- [ ] 玩家控制圆形在 2D 空间移动（有边界）
- [ ] 环境随机刷新正多边形颗粒（三角形、正方形等）
- [ ] 圆形经过颗粒时摄取，颗粒从环境消失
- [ ] 摄取后玩家**质量**增加；屏幕右上角显示质量
- [ ] 质量 ↔ 面积关系式（面积是表象，质量是本质，见 [物理模型](docs/OUTLINE.md#四物理模型)）

### 阶段 M2 — AI 与吞噬

- [ ] AI 控制的圆形同样摄取颗粒
- [ ] 大圆覆盖小圆时吞噬小圆，质量合并给大圆
- [ ] 玩家质量增长 → 视野半径扩大
- [ ] 质量超过阈值 → 缩放环境与其他实体（相机缩放）

## 架构方案（推荐）

### 结论：采用「单页 + 场景状态机」，沿用 ElecDog / RocketSimulator 的 Web → APK 路径

**不建议**使用传统多 HTML 页面（`menu.html`、`game.html` 各自跳转）。原因：

| 考量 | 多页面 HTML | 单页 + 场景状态机（推荐） |
|------|-------------|---------------------------|
| 手柄焦点 | 每页需重新绑定，易丢焦点 | 统一 `InputManager`，场景切换无刷新 |
| 游戏循环 | 页面跳转中断 `requestAnimationFrame` | 菜单 / 绑定 / 对局共享同一画布上下文 |
| APK 封装 | 可行但体验割裂 | 与 [ElecDog](https://github.com/jk9988610/elecdog) Capacitor 方案一致 |
| OTA 热更新 | 多入口难维护 | 单 `index.html` + 资源包，便于后期 OTA |

### 推荐技术栈

```
┌─────────────────────────────────────────────────────────┐
│  场景层    │ MenuScene · BindingsScene · GameScene      │
├─────────────────────────────────────────────────────────┤
│  输入层    │ InputManager（Gamepad API + 键盘 + 触屏）   │
├─────────────────────────────────────────────────────────┤
│  游戏逻辑  │ TypeScript + Canvas 2D                     │
├─────────────────────────────────────────────────────────┤
│  Web 原型  │ Vite + TypeScript → GitHub Pages           │
├─────────────────────────────────────────────────────────┤
│  APK       │ Capacitor 封装 WebView（参考 ElecDog）      │
│            │ Termux 本地 `gradle assembleDebug`          │
└─────────────────────────────────────────────────────────┘
```

### 手柄支持要点

- 使用浏览器 **Gamepad API**（`navigator.getGamepads()`），在 Android WebView / Chrome 中可用
- 菜单采用**焦点列表**（上/下/左/右切换，A 确认，B 返回），不依赖鼠标悬停
- 按键绑定页监听下一个按下的键位并写入 `localStorage`
- 对局内左摇杆 / 十字键映射为移动力；菜单与对局由 `InputManager` 按当前场景分发

## 仓库结构（规划）

```
Mira/
├── README.md
├── docs/
│   └── OUTLINE.md          # 详细设计：物理公式、AI、相机、里程碑
├── web/                    # Vite + TS 原型
│   ├── index.html
│   ├── src/
│   │   ├── core/           # 场景管理、游戏循环
│   │   ├── input/          # 手柄、按键绑定
│   │   ├── scenes/         # menu · bindings · game
│   │   ├── game/           # 实体、颗粒、碰撞、AI
│   │   └── ui/             # HUD（质量显示等）
│   └── package.json
├── android/                # Capacitor 壳（后期）
└── .github/workflows/      # Pages 部署 CI
```

## 本地开发

```bash
cd web
npm install
npm run dev
```

浏览器访问开发服务器；连接手柄后可在「按键绑定」页测试映射。

在线预览：**https://jk9988610.github.io/Mira/**

## APK 构建（后期，参考 ElecDog）

```bash
npm install
npm run cap:sync
npm run apk:debug     # Termux / 本机 Android SDK
```

## 文档

| 文档 | 作用 |
|------|------|
| **[docs/OUTLINE.md](docs/OUTLINE.md)** | 详细设计：玩法、物理公式、AI、相机、里程碑 |
| [ElecDog README](https://github.com/jk9988610/elecdog) | App 交付、OTA、Capacitor 工程参考 |
| [RocketSimulator](https://github.com/jk9988610/RocketSimulator) | Vite + TS + Pages + 平板横屏分工参考 |

## 状态

- [x] 立项与 README / 设计文档
- [x] M0：菜单 + 按键绑定 + 进入游戏
- [ ] M1：玩家移动、颗粒摄取、质量显示
- [ ] M2：AI 圆形、大吃小、视野与缩放
