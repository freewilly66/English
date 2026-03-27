# 프로젝트 가이드: 영어듣기 트래커 (좋은 하루)

## 📌 앱 개요
- **앱명**: 좋은 하루 (영어듣기 습관 트래커)
- **GitHub**: https://github.com/freewilly66/English
- **배포 URL**: https://freewilly66.github.io/English/
- **파일**: Single HTML (`index.html`) + `sw.js` + `manifest.json`

## 🛠 기술 스택
- **Frontend**: Single HTML (Vanilla JS, CSS-in-HTML)
- **PWA**: iOS Safari 최적화 (sw.js network-first, manifest.json)
- **AI 모델**: `claude-sonnet-4-6`
- **Storage**: `localStorage` (접두어: `eh_`)
- **External API**: YouTube RSS (CORS 프록시), Anthropic API

## 💾 localStorage 키 목록
| 키 | 내용 |
|---|---|
| `eh_state` | 앱 상태 (history, notif, tab, wGoal, rH, rM, dMin) |
| `eh_listened` | 날짜별 청취 완료 URL Set (30일 컷오프) |
| `eh_history` | 시청 기록 최대 500개 |
| `eh_vocab` | 단어장 최대 300개 (VOC_MAX) |
| `eh_analyzed` | AI 분석 캐시 (QuotaExceeded 시 절반 삭제) |
| `eh_watch` | 시청 로그 |
| `eh_today_pick` | 오늘 선택 영상 |
| `eh_vfil` | 단어장 마지막 필터 상태 |
| `eh_ak` | Anthropic API 키 |

## 🎯 주요 기능
1. **피드**: BBC/VOA Learning English YouTube RSS 자동 갱신 (1시간 캐시)
2. **일일 완료 체크**: `markDone()` → `S.history[TD] = true`
3. **스트릭**: 연속 청취 일수 (오늘 미완료면 어제부터 카운트)
4. **단어장**: 추가/수정/삭제, 카테고리 필터, 플래시카드 모드, 30개씩 페이지네이션
5. **AI 분석**: 영상별 어휘·표현 추출 (Claude API, 결과 캐시)
6. **시청 기록**: URL 열 때 자동 저장, 최대 500개
7. **알림(Nag)**: 미완료 시 90분 간격 푸시 알림
8. **데이터 export/import**: JSON 백업/복원

## 📏 개발 규칙
1. **날짜**: `localDate()` 함수 사용 — `toISOString()` UTC 절대 금지
   - 한국(UTC+9) 자정~9시 오차 발생하므로 항상 로컬 기준
2. **용량 관리**: 단어장 300개 상한, 시청 기록 500개 상한, AI 캐시 QuotaExceeded 시 절반 삭제
3. **스크롤 성능**: `renderFR()` (피드 렌더) 는 반드시 `requestAnimationFrame()` 으로 감싸기
   - iOS 스크롤 중 innerHTML 전체 교체 시 크래시 발생 이력 있음
4. **backdrop-filter 금지**: 스크롤 영역 내 요소에 적용 시 GPU 압박으로 크래시
5. **PWA 자동 배포**: sw.js network-first 방식 → git push 후 앱 재시작 시 자동 반영
   - sw.js 버전 번호 수동 bump 불필요

## 🐛 수정된 주요 버그 (참고)
- **연속일자 0 버그** (commit 8304dbc): `lS()` QuotaExceededError 무음 실패 → streak 미저장 → 다음날 0
  - 수정: QuotaExceeded 시 AI 캐시 절반 삭제 후 재시도
- **스크롤 크래시** (commit 8304dbc): 피드 로딩 완료 후 innerHTML 교체가 iOS 스크롤 중 발생
  - 수정: `requestAnimationFrame()` 감싸기, backdrop-filter 제거
- **단어장 성능** (commit 9dbbdfd): 300개+ 시 렌더 지연
  - 수정: 300개 FIFO 상한 + 30개씩 페이지네이션 + `content-visibility: auto`
