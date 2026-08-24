# 淞沪血战 · 外滩1937（手机射击游戏）

一款手机端**伪3D第一人称射击游戏**，玩法致敬经典单机《血战上海滩》：
固定视角站在街道阵地中，日军士兵从街道远端冲来，拖动瞄准射击、爆头、拦截敌弹、波次推进，最终迎战坦克 BOSS。
**每个敌人头顶都顶着一个随机名字**（孙弋博、孙海涛、张杨煦、李昭延、杜鹏飞、刘金荣、杨程文……），击杀时会在屏幕上亮出名字。

**纯 Canvas 实现，零外部依赖、零素材文件** —— 所有画面（士兵、坦克、街景、特效）均由代码程序化绘制，音效由 Web Audio 实时合成。

---

## 一、马上开玩

### 桌面浏览器
```bash
cd songhu-bloodbattle
node server.js          # 然后浏览器打开 http://127.0.0.1:8090/
```
鼠标瞄准、左键开火、`R` 换弹、`G` 手雷、`P` 暂停、`M` 静音。

### 手机浏览器（临时体验）
手机与电脑连同一 Wi-Fi，浏览器访问 `http://<电脑IP>:8090/`（本机 IP 可用 `ipconfig` 查看，例如 `192.168.1.4`）。建议横屏。

## 二、安装成手机 App（推荐，可离线玩）

游戏已内置 **PWA 应用支持**（`manifest.webmanifest` + 图标 + 离线缓存 `sw.js`），装好后主屏幕出现图标、全屏运行、无需网络。

> ⚠️ PWA 安装与离线缓存要求 **HTTPS**（或 localhost）。局域网 `http://192.168.1.4:8090` 不是安全上下文，装不了。需要把游戏放到一个免费的 HTTPS 网址上，以下任选其一（都免费）：

| 方案 | 操作 | 适合 |
|---|---|---|
| **GitHub Pages** | 推到 GitHub 仓库，自动部署（已附工作流 `.github/workflows/deploy-pages.yml`） | 有 GitHub 账号 |
| **Netlify Drop** | 打开 app.netlify.com/drop，把 `songhu-bloodbattle` 文件夹拖进去 | 无需注册也能先用 |
| **Cloudflare Pages / Vercel** | 上传或连接仓库 | 无 GitHub 也可 |

> **免装 Git 的 GitHub 上传法**：
> 1. github.com 新建公开仓库（如 `songhu-bloodbattle`，**不要**勾选添加 README）
> 2. 进入仓库页 → 点 **uploading an existing file** → 把整个 `songhu-bloodbattle` 文件夹拖进浏览器（**务必勾选 "including hidden files"**，否则 `.github` 工作流不会上传）
> 3. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions** → Save
> 4. 等 1~2 分钟 Actions 跑完（变绿），网址就是 `https://<你的用户名>.github.io/<仓库名>/`

部署拿到 HTTPS 网址后：

- **安卓 Chrome**：打开网址 → 菜单 ⋮ →「安装应用」/「添加到主屏幕」
- **iPhone Safari**：打开网址 → 分享按钮 →「添加到主屏幕」

## 三、直接下载 APK 安装（仅安卓）

### 方式 A：在线生成（最简单，无需任何工具）
1. 先把游戏部署到 HTTPS（见上，GitHub Pages 最稳）
2. 打开 **https://www.pwabuilder.com** → 粘贴你的网址 → 按提示打包 → 下载生成的 APK
3. 把 APK 传到手机安装（首次需允许"安装未知来源应用"）

### 方式 B：GitHub Actions 自动构建
仓库已附 `.github/workflows/build-apk.yml`：
1. 推送代码并完成 GitHub Pages 部署
2. 在仓库 Actions 页手动运行 **Build Android APK**，填写 manifest 地址和包名
3. 运行完成后在 Artifacts 里下载 `songhu-bloodbattle-apk`（含 `app-release-signed.apk`）

> 说明：本机未安装安卓 SDK/Java，无法直接在这里产出 APK；以上两条路径均免费且无需本地开发环境。

## 玩法

- **拖动瞄准**：手指滑动，准星跟随
- **按住开火**：按住屏幕持续射击（主菜单可切换手动开火按钮）
- **爆头**：命中头部双倍伤害 + 额外加分
- **拦截**：敌人的子弹、手雷、坦克炮弹都可以被击落！
- **手雷**：右下角按钮，投向准星位置
- **战利品**：击杀掉落弹药/医疗包/手雷/武器升级，自动飘向阵地
- **换弹**：耗尽自动换弹；弹药打空自动切回盒子炮

## 关卡

| 关卡 | 场景 | 敌人 |
|---|---|---|
| 第一关 | 外滩防线 | 日军步兵、突击兵（刺刀冲锋） |
| 第二关 | 南京路巷战 | + 机枪手、掷弹兵 |
| 第三关 | 四行仓库 | + 日军军官，最终波：**某某的战车** BOSS（随机车主） |

## 武器

盒子炮（无限弹药）→ 花机关 MP18 → 中正式步枪 → 捷克式轻机枪（逐级通过战利品升级）

## 目录结构

```
songhu-bloodbattle/
├── index.html               # 页面骨架 + 界面样式 + PWA 注册
├── game.js                  # 全部游戏逻辑（伪3D渲染、AI、战斗、音效、关卡）
├── manifest.webmanifest     # PWA 应用清单
├── sw.js                    # 离线缓存 Service Worker
├── icon-192.png / icon-512.png  # 应用图标
├── server.js                # 本地静态服务器（node server.js）
├── .github/workflows/       # GitHub Pages 部署 + APK 自动构建
├── tests/                   # 无头冒烟测试（Node.js）
└── README.md
```

## 技术要点

- **伪3D渲染**：针孔相机投影（`proj(x,y,z)`），街道/天际线/道具按深度排序，士兵精灵按距离缩放，远处自动加雾
- **程序化美术**：5 种日军士兵（4 帧步行动画）、坦克、外滩天际线（海关钟楼剪影）全部代码绘制
- **随机姓名**：7 人姓名池每关随机洗牌轮换，敌人头顶名牌 + 击杀播报
- **音效**：Web Audio 程序化合成，战斗中低鼓点配乐
- **触控**：Pointer Events 统一触屏与鼠标，多指操作，防缩放，振动反馈
- **PWA**：manifest + 图标 + Service Worker 离线缓存

## 测试

```bash
node tests/test-smoke.js     # 冒烟：启动/菜单/战斗/结算无运行时错误
node tests/test-full.js      # 三关完整流程（智能机器人）验证可通关
node tests/test-winrate.js   # 第三关 10 局胜率统计
```

## 声明

本游戏为**原创致敬作品**，仅借鉴《血战上海滩》的"定点射击 + 敌人冲锋"玩法设计，代码、美术、音效均为原创，无任何素材引用。
