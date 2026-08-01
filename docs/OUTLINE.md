# Mira — 项目大纲与详细设计

> 2D 圆形吞噬游戏  
> 平台：GitHub Pages 原型 → 安卓平板 APK（横屏）  
> 输入：手柄全程可参与软件内操控

---

## 一、项目愿景

**Mira** 是一款类 Agar.io 的 2D 吞噬游戏，核心差异是**从菜单到对局全程支持手柄**，面向安卓平板横屏使用。

设计习惯可参考 [ElecDog](https://github.com/jk9988610/elecdog) 仓库：

- 单页 Web 应用 + Canvas 渲染
- GitHub Pages 快速预览
- Capacitor 打包 APK
- 文档驱动迭代（`docs/` + `STATUS` 里程碑）

---

## 二、场景与页面设计

### 2.1 场景列表

采用**单页应用内的场景状态机**，而非多个 HTML 文件：

```
Boot → MainMenu ⇄ KeyBindings
         │
         └→ Game → (PauseMenu) → MainMenu
```

| 场景 | 功能 | 手柄操作 |
|------|------|----------|
| **MainMenu** | 开始游戏、按键绑定、设置、退出 | 十字键/摇杆切换焦点，A 确认，B 无/退出 App |
| **KeyBindings** | 为「移动、确认、返回、暂停」等动作绑定键位 | 选中一行 → A 开始监听 → 按下任意键写入 |
| **Game** | 2D 对局 | 左摇杆移动；Start/Menu 键暂停 |
| **PauseMenu** | 继续、返回主菜单 | 同主菜单焦点导航 |

### 2.2 为何不采用多 HTML 页面

早期 APK 项目常见 `pages/menu.html`、`pages/game.html` 跳转。对 Mira 不推荐：

1. **手柄焦点丢失**：`location.href` 跳转后需重新 `gamepadconnected` 与 DOM 焦点初始化
2. **游戏状态难共享**：质量、绑定配置需 `sessionStorage` 或 URL 传递，易出错
3. **Gamepad API 轮询中断**：页面卸载时 `requestAnimationFrame` 停止，重新进入对局有卡顿感

单页 + `SceneManager` 切换时仅替换 `update/render/input` 回调，与 ElecDog、RocketSimulator 的工程路径一致。

---

## 三、游戏玩法

### 3.1 世界

- **空间**：有限矩形区域（世界坐标 `W × H`），边界对实体做硬约束或弹性反弹
- **颗粒**：随机刷新的正多边形小颗粒
  - 类型：正三角形、正方形、正五边形……（边数与尺寸可配置）
  - 每种颗粒有固定**质量** `m_p`（见 §4.2）
- **实体**：圆形
  - **玩家圆**：用户手柄控制
  - **AI 圆**：若干，自主移动并摄取颗粒

### 3.2 摄取规则

#### 颗粒摄取

当圆心距离 `d` 满足 `d < r - r_p`（`r` 为圆半径，`r_p` 为颗粒等效半径）时判定摄取：

1. 颗粒从世界列表移除
2. 圆的**质量**增加：`m ← m + m_p`
3. 根据 §4.1 更新半径（面积变化是质量的表象）

#### 圆吞噬圆

当两圆重叠且 **大圆质量严格大于小圆** 时，大圆可吞噬小圆：

- 条件示例：`m_a > m_b` 且圆心距 `d < r_a - α·r_b`（`α ∈ (0,1)` 为吞噬宽容系数，如 0.6）
- 结果：`m_a ← m_a + m_b`，移除圆 b
- 玩家被 AI 吞噬 → 游戏结束；AI 被玩家吞噬 → 玩家质量增加

### 3.3 AI 行为（M2）

简化状态机：

```
Wander → SeekNearestPellet → FleeStronger / ChaseWeaker
```

- **Wander**：随机方向 + 边界避让
- **SeekNearestPellet**：朝视野内最近颗粒移动
- **FleeStronger**：若视野内有质量更大的圆，远离
- **ChaseWeaker**：若有质量明显更小的圆，追击（可选，调难度）

### 3.4 视野与相机缩放

| 机制 | 说明 |
|------|------|
| **视野半径** | 随玩家质量增大：`R_view = R_0 · (m / m_0)^β`，建议 `β = 0.4~0.5` |
| **HUD** | 右上角显示玩家质量 `m`（可保留 1 位小数） |
| **缩放阈值** | 当 `r > r_threshold` 时，相机不再单纯拉远，改为**缩放整个世界**（玩家视觉半径趋于稳定，地图与远处实体缩小） |

缩放公式示例：

```
若 r ≤ r_threshold:
  camera.zoom = 1
  R_view 按上式增长
若 r > r_threshold:
  camera.zoom = r / r_threshold
  R_view = R_view_at_threshold   // 视野上限锁定
```

世界渲染时对坐标与半径统一乘以 `1 / camera.zoom`。

---

## 四、物理模型

**设计原则：质量是本质，面积（半径）是表象。**

### 4.1 质量与半径

假设圆为**等密度**二维刚体，面密度 `σ`（单位：质量/面积²）：

```
m = σ · π · r²
⟹ r = √( m / (σ·π) )
```

显示用面积：`A = π·r² = m/σ`（与质量线性相关）。

玩家 HUD **只显示质量 `m`**；渲染时用 `r` 画圆。

### 4.2 颗粒质量

正 `n` 边形颗粒，外接圆半径 `a`，面密度与圆相同 `σ`：

```
A_p = (n/2) · a² · sin(2π/n)
m_p = σ · A_p
```

可按边数设倍率，例如三角形 `m_p = m₀`，正方形 `m_p = 1.2·m₀`。

### 4.3 摄取后的质量合并

**守恒**：摄取不改变总质量，仅改变归属。

```
m_new = m_old + Σ m_p   // 颗粒
m_new = m_a + m_b       // 圆吞圆
```

合并后一次计算 `r_new = √(m_new / (σ·π))`，避免逐帧累加半径造成浮点漂移。

### 4.4 运动

- 玩家速度：`v_max` 可随质量略降（大球笨重）：`v_max = v_0 · (m_0 / m)^γ`，`γ ≈ 0.1`
- 加速度：摇杆向量归一化后乘以 `v_max`
- 无惯性或轻惯性，按手感在实现时调参

---

## 五、输入系统

### 5.1 InputManager 职责

```
pollGamepads()     // 每帧调用
getAxis(action)    // MOVE_X, MOVE_Y
wasPressed(action) // CONFIRM, BACK, PAUSE
```

- 抽象 **动作（Action）** 与 **物理键位（Binding）** 分离
- 绑定存 `localStorage`：`mira_bindings_v1`

### 5.2 默认绑定建议

| 动作 | Xbox 手柄 | 键盘 |
|------|-----------|------|
| 移动 | 左摇杆 / 十字键 | WASD / 方向键 |
| 确认 | A | Enter / Space |
| 返回 | B | Escape |
| 暂停 | Start | P |

### 5.3 菜单焦点模型

- 可聚焦项：`data-focusable` 或显式 `FocusList` 数组
- `moveFocus(dx, dy)` 在列表中循环
- 当前项高亮边框 + 缩放动画
- **禁止**仅依赖 `:hover` 或触屏点击才能操作

---

## 六、技术栈与仓库约定

与 [RocketSimulator](https://github.com/jk9988610/RocketSimulator) 对齐：

| 层级 | 选型 |
|------|------|
| 语言 | TypeScript |
| 构建 | Vite |
| 渲染 | Canvas 2D |
| 部署 | GitHub Actions → Pages |
| APK | Capacitor 7.x（参考 ElecDog `cap:sync` / `apk:debug`） |

### 模块划分（`web/src/`）

```
core/          app.ts, scene-manager.ts, game-loop.ts
input/         gamepad.ts, bindings.ts, focus-list.ts
scenes/        menu.ts, bindings-scene.ts, game-scene.ts
game/          world.ts, pellet.ts, circle-entity.ts, collision.ts, ai.ts
render/        camera.ts, renderer.ts, hud.ts
```

---

## 七、里程碑

| 阶段 | 内容 | 验收 |
|------|------|------|
| **M0** | 菜单、按键绑定、进入空对局 | 手柄可完成全流程，无需触屏 |
| **M1** | 玩家移动、颗粒生成与摄取、质量 HUD | 质量随摄取单调增加，半径符合公式 |
| **M2** | AI、圆吞圆、视野与缩放 | 大球视野更大，超阈值后世界缩放 |
| **M3** | Capacitor APK、横屏锁定、Termux 构建文档 | 平板真机手柄可玩 |
| **M4** | Supabase 存档 / 排行榜（可选） | 设置与最高分云同步 |

---

## 八、待决事项

- [ ] 颗粒边数与刷新密度的具体数值
- [ ] AI 数量与难度曲线
- [ ] 玩家死亡后是否复活或返回菜单
- [ ] 是否加入音效与手柄震动（`GamepadHapticActuators`，部分设备支持）

---

## 九、参考链接

- [ElecDog](https://github.com/jk9988610/elecdog) — App 工程、OTA、田野文档习惯
- [RocketSimulator OUTLINE](https://github.com/jk9988610/RocketSimulator/blob/main/docs/OUTLINE.md) — Vite + TS 分工
- [Gamepad API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API)
