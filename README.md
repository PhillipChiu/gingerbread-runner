# 雲尾衝刺日記

一款以 React、TypeScript、Canvas 與 Vite 製作的繁體中文單頁跑酷遊戲。小跑者會自動向前奔跑；玩家在十段逐步加速、障礙變密的原創步道上跳躍、滑行並收集能量果實。

## 開始遊玩

需求：Node.js 20 以上、npm。

```bash
npm install
npm run dev
```

開啟終端機顯示的本機網址即可遊玩。遊戲不需要 API、資料庫或後端服務。

### 操作方式

| 動作 | 鍵盤 | 觸控 |
| --- | --- | --- |
| 跳躍 | `Space`、`↑` 或 `W` | 點選「跳躍」 |
| 滑行 | `↓` 或 `S` | 點選「滑行」 |
| 暫停／繼續 | `P` 或 `Esc` | 遊戲畫面的「暫停」按鈕 |

角色會自動前進。跳過樹樁與裂隙、滑過低矮拱門；收集能量果實可補充護盾。撞到障礙會消耗護盾，護盾歸零時失去一格活力。抵達關卡終點即可通關並解鎖下一關，也可以重玩已解鎖的關卡。

## 專案指令

```bash
npm test        # 執行關卡資料、遊戲狀態與進度儲存測試
npm run build   # TypeScript 檢查並產生 production build
npm run preview # 本機預覽 dist
```

分數、已通關關卡、解鎖進度、最佳分數與收集總數以 `localStorage` 儲存在目前瀏覽器，不會傳送到伺服器。

## GitHub Pages 部署

`.github/workflows/deploy-pages.yml` 會在 `main` 分支更新或手動觸發時執行測試、build，並部署到 GitHub Pages。請在 GitHub repository 的 **Settings → Pages → Build and deployment** 選擇 **GitHub Actions**。

部署建置會將 Vite 的 asset base 設為 `/gingerbread-runner/`，適用於 `gingerbread-runner` repository；一般本機開發與預覽仍使用 `/`。角色圖由 Vite 直接從 repo 根目錄匯入、打包，原始 `main_character.png` 會保留不變。

## 素材與實作

- 遊戲主角使用 repo 提供的 `main_character.png`。程式將角色圖格裁切、移除圖片上與角色不相連的淺色格紋背景，並在 Canvas 中循環播放角色姿勢。
- 場景、障礙、果實與介面以原創 Canvas 繪圖及 CSS 製作；沒有使用官方品牌識別、角色素材或音效。
- 十關資料集中在 `src/game/levels.ts`；移動、跳躍、滑行、碰撞、護盾與計分邏輯位於 `src/game/engine.ts`。
