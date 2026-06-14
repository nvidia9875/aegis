# Aegis Reactor 3D — three.js (React Three Fiber) 計画

> 目的：中央リアクターを **本物の3D・ボリューム発光（WebGL）** に置き換え、奥行き・被写界深度・ブルーム・パララックスでクオリティを一段上げる。
> 現行のSVG版は **フォールバック兼サンプル** として残す（reduced-motion / WebGL非対応 / SSR時）。

## 1. アーキテクチャ：ハイブリッド（推奨）
- **DOM層（既存をそのまま活用）**：HUDフレーム、ルーラー、インシデントログ、各ウィジェット、Governanceモーダル、コントロール。テキストはDOMのまま＝**クリアで可読・a11y◎**。
- **WebGL層**：中央フレーム内に透明背景の `<Canvas>`（ReactorCanvas）。3DリアクターのみWebGLで描く。
- **データ連携**：`usePlayer` の state（activeStage/litStages/coverage/antibodies/health/severity）を props/refで渡し、シーンのuniforms・発光・パーティクルに反映。

> 代替案：全画面3D（drei `Html` でウィジェット）＝実装量・テキスト品質・負荷の面で不利。**ハイブリッドを推奨**。

## 2. スタック（互換確認済み）
- `three@^0.171`, `@react-three/fiber@^9`（React19対応）, `@react-three/drei@^10`, `@react-three/postprocessing@^3`, 補助 `maath`。
- Next15 App Router：`const ReactorCanvas = dynamic(() => import("@/components/reactor3d/ReactorCanvas"), { ssr:false })`。
- Canvas設定：`dpr={[1,2]}`, `gl={{ powerPreference:"high-performance", antialias:false, stencil:false, alpha:true }}`, 影なし。

## 3. シーングラフ
- **Camera/Rig**：PerspectiveCamera、やや俯瞰。自動ドリフト＋**ポインタ・パララックス**（damped, ±数度）。
- **Core**：Icosphere＋カスタム発光シェーダ（fresnel＋ノイズ流動）or `meshStandardMaterial` emissive＋グローsprite。脈動。色は状態連動（idle=cyan / warn=amber / resolved=green）。
- **Rings**：Torus×2–3を別軸で回転（真の3D傾き）。1本に8ステージノードを配置。
- **Stage nodes**：リング上の発光スフィア×8。activeで増光・スケール。ラベルは drei `<Text>`/`<Billboard>`。
- **Particles**：`instancedMesh`/`Points`（1–3k、加算合成）でオービット＋ドリフト。**immunize時にバースト**。
- **Stacked disk**：下にもう1基（真の奥行き）。
- **Coverage**：発光チューブの円弧がカバレッジ％で充填。
- **Radar sweep**：回転コーン/プレーン。
- **環境**：ホログラフィック・フロアグリッド＋微volumetric haze。
- **Postprocessing**：EffectComposer → **SelectiveBloom**（emissiveのみ, `luminanceThreshold≈0.2`, intensity≈1.2）→ Vignette → 軽DoF →（最後に）ToneMapping。emissiveは `toneMapped={false}`。

## 4. データ → 3D マッピング
| state | 3D表現 |
|---|---|
| activeStage | 該当ノード増光＋スイープがそこを指す |
| litStages | ノード点灯維持 |
| coverage | カバレッジ円弧の充填＋環境光の暖色化 |
| immunize step | **パーティクル・バースト＋リップル**、コア増光 |
| severity/health | コア色＋warnフリッカ、alertで赤リム＋画面端の赤ヴィネット脈動 |
| finished | 穏やかな緑の定常グロー |

## 5. パフォーマンス & フォールバック
- **遅延ロード**：`dynamic(ssr:false)`。canvas読込までSVGリアクターをプレースホルダ表示 → 初回描画は即時。
- **フォールバック**：`prefers-reduced-motion` / WebGL非対応 / 低性能 → 現行SVG `Reactor2D`。
- パーティクル上限・instancing・dprクランプ(≤2)・**非表示タブで frameloop 停止**。bloomは低性能時オフ。
- First Load JS：threeチャンクは初回描画後に分割ロード（appページ予算<300kb内）。

## 6. ファイル構成
```
dashboard/components/reactor3d/
  ReactorCanvas.tsx     # <Canvas> + <Effects> + <Scene>（dynamic, ssr:false）
  Scene.tsx             # ライト/シーン束ね
  Core.tsx Rings.tsx StageNodes.tsx Particles.tsx
  CoverageArc.tsx RadarSweep.tsx HoloGrid.tsx CameraRig.tsx
  Effects.tsx           # SelectiveBloom/Vignette/DoF/ToneMapping
  useReactorInputs.ts   # usePlayer state → scene向け値/refへ変換
components/Reactor.tsx  # → Reactor2D にリネーム（フォールバック）
components/ReactorView.tsx # 3D対応なら3D、無理ならReactor2Dを選択
```

## 7. ビルド順（各段で動く形を維持）
1. 依存追加。ReactorCanvasに発光スフィア1つ＋bloom＋パララックスのみ。中央枠に表示・フォールバック確認。
2. Rings＋StageNodes＋ラベル（activeStage/litStages連動）。
3. Particles（instanced）＋オービット＋immunizeバースト。
4. CoverageArc＋RadarSweep＋2基目ディスク。
5. Postprocessing調整（selective bloom/vignette/DoF）＋状態カラー（idle/alert/resolved）。
6. カメラ・パララックス＋自動ドリフト、reduced-motion/WebGLフォールバック結線。
7. perfパス（dpr・粒子上限・hidden停止）→ Playwrightでスクショ確認 → push。

## 8. リスクと対策
- **バンドル/低性能GPU** → 遅延ロード＋フォールバック＋粒子上限。
- **bloomで文字が滲む** → テキストはDOMのまま（bloom対象外）。
- **動画の決定性** → 固定カメラ＋seed、正本ランを録画。
- **SSR落ち** → `dynamic(ssr:false)`（必須・確認済み）。

## 9. 検証
- `pnpm build`（バンドルレポート）/ ローカル起動＋Playwrightスクショ（idle/active/alert/resolved）/ reduced-motion / 低dpr。

## 参考
- R3F v9 migration / React19: https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide
- Next15 × R3F 互換: https://github.com/vercel/next.js/issues/71836
- Selective Bloom: https://docs.pmnd.rs/react-postprocessing/effects/selective-bloom
- three.js perf tips: https://www.utsubo.com/blog/threejs-best-practices-100-tips
