# 自由工坊 · 供應端客戶端

<!-- freedom-repository-guide:start -->
## 在自由工坊的位置

[自由工坊](https://freetwai.com) 讓會員先完成定位、選擇公會並領取 Repo 技能書，再以供貨、商店、開源作品、行銷與小隊共同完成成果。

可 Fork 的供應端客戶端，讓供貨者讀取自己的中央商品與供貨申請。 Node 24 CLI 已提供 connect、products／requests／connection 私人 JSON 讀取。

商品新增、改價與供貨決定目前回中央網站操作；沒有客戶端寫入、訂單、付款或公開 feed。

本 repo 的維護者負責「可 Fork 的供應端客戶端，讓供貨者讀取自己的中央商品與供貨申請。」這個模組；公會職稱與自填 GitHub slug 不授予寫入權。

程式／內容入口：[src/index.mjs](src/index.mjs)、[client/](client/)、[scripts/run-client.mjs](scripts/run-client.mjs)、[scripts/verify-client-source.mjs](scripts/verify-client-source.mjs)、[tests/](tests/)。協作先讀 [CONTRIBUTING.md](CONTRIBUTING.md)，讓 Agent 讀 [AGENTS.md](AGENTS.md)；從[本倉 Issues](https://github.com/FreeTWAI/freedom-supplier-client/issues)認領、[查看既有 PR](https://github.com/FreeTWAI/freedom-supplier-client/pulls)避免重工。

supplier:read 僅讀本人的資料；token 保存在 repo 外本人可讀檔案，不進 browser、source 或 Pages。client/ 由中央 helper 產生並由 client-source.lock.json 記來源；改共用 transport 先到中央 repo。 跨 repo 的協定由[中央平台](https://github.com/FreeTWAI/freedom-platform)維護。
<!-- freedom-repository-guide:end -->

[開始刊登商品](https://freetwai.com/#supplier) · [Fork 我的客戶端](https://github.com/FreeTWAI/freedom-supplier-client/fork) · [核准／撤銷讀取連線](https://freetwai.com/#account)

這是供貨者可以 Fork、改造的第一本技能書。現在先在自由工坊網站刊登商品、整理供貨條件與處理合作申請；這個客戶端連回同一個中央平台，讀取**你自己的商品和供貨申請**。不需要重新輸入一份商品資料，也不建立另一套會員、資料庫或收款帳。

## 開始

需要 Node.js 24。沒有第三方 runtime 套件。

```sh
npm ci --ignore-scripts
npm test
npm run connect
```

終端會顯示五分鐘有效的連線代碼和自由工坊網站連結。在**自己的瀏覽器**登入、完成定位，到「我的名片」輸入代碼；確認名稱與 `supplier:read` 範圍後核准。密碼不會交給客戶端。

核准後：

```sh
npm run read
npm run read -- products
npm run read -- requests
npm run read -- connection
```

預設平台是 `https://freetwai.com`。輸出為私人 JSON，可用自己的工具整理；它不是可公開販售的商品 feed。商品上架、改價和供貨決定仍在[供應端工作台](https://freetwai.com/#supplier)完成；這個連線沒有寫入或付款權限。

## 連線保存與撤銷

連線檔存在 repo 外的 `~/.config/freedom-clients/supplier.json`，權限 `0600`。CLI 不列印 token、不接受瀏覽器 session、不跟隨帶憑證請求的重新導向，也不自動重試資料操作。

在[我的名片](https://freetwai.com/#account)撤銷連線後立即失效。重新連線前，先撤銷舊連線，再自行移除舊的本機連線檔；CLI 不覆寫既有檔案。

本機開發可設定 `FREEDOM_PLATFORM_ORIGIN=http://127.0.0.1:4310`。如果使用多個平台或商店，以 `FREEDOM_CREDENTIAL_FILE` 指定不同的私人檔案。`FREEDOM_CLIENT_NAME` 可設定要在核准畫面顯示的名稱。

不要將連線檔、環境變數檔、讀取結果或客戶資料 commit／部署到 GitHub Pages。`.gitignore` 已排除常用憑證與私人輸出目錄；這不取代核對將要發布的檔案。

## 程式接入

```js
import {ScopedReadClient,loadSupplierWorkspace} from './src/index.mjs';

// token 由本機私人連線檔讀取；不可寫進程式或前端 bundle。
const client = new ScopedReadClient({origin: 'https://freetwai.com', token});
const workspace = await loadSupplierWorkspace(client);
```

資料權限由中央平台每次查核。停用帳號、連線到期或撤銷都會拒絕讀取。客戶端不取得其他供貨者的私人商品，也不改寫會員身分、公會或供貨資料。

`client/` 的共用 transport 與 CLI 來自 `freedom-platform/packages/client-connections`；來源 commit、檔案路徑與 SHA-256 記錄在 `client-source.lock.json`。執行 `npm run verify:client-source -- --remote` 可驗證固定版本。修改客戶端介面時，保留原始 transport 或經明確更新來源與測試後再同步。

本 repo 尚未選定額外程式授權，沒有自動授予第三方商用或再授權權利；平台原作者與引用專案的授權各自保留。此模板不包含買家結帳、金流、訂單履約或正式供貨合約。

## Shared supplier workspace

`src/index.mjs` imports both the scoped read transport and supplier workspace reader from the separately pinned central `vendor/freedom-libraries` source. Existing calls to `loadSupplierWorkspace(client)` keep the connection/products/requests order and read-only shape. Wrong scope rejects before reading products; expired or revoked connections propagate the server rejection without retries. No write, publication or payment capability is added.

`consumer-libraries.lock.json` records source bytes separately from the unchanged preview contract and existing CLI source pin. Verify against an independently selected source SHA before publication:

```sh
node scripts/verify-consumer-libraries.mjs FreeTWAI-AI/freedom-supplier-client EXPECTED_PLATFORM_SHA --source-root /path/to/platform
```

The repository argument is the historical provenance identity required by this pinned verifier and `consumer-libraries.lock.json`. Current GitHub and clone URLs use `FreeTWAI`.

Use `--remote` after the exact source is publicly reachable. Source verification does not establish release approval, installed governance or complete runtime coverage.
