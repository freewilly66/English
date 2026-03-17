# 영어 듣기 트래커 — 설치 가이드 (iOS 수정판)

## 구성 파일
```
index.html     ← 앱 본체 (iOS 호환 수정됨)
manifest.json  ← PWA 설정
sw.js          ← 오프라인·알림 처리
icon.svg       ← 앱 아이콘 (SVG)
icon-192.png   ← 앱 아이콘 (PNG, iOS용)
```

## 주요 수정사항 (iOS 호환)
1. **거대한 base64 이미지 제거** → 가벼운 그라데이션 히어로 섹션으로 교체
2. **`window.open()` 수정** → iOS standalone 모드에서 링크 열기 가능
3. **Notification API 안전 래핑** → iOS에서 에러 발생 방지
4. **모든 JS를 try-catch로 보호** → 에러 하나로 앱 전체가 멈추지 않음
5. **스크롤 영역 분리** → iOS 웹뷰에서 안정적인 스크롤
6. **Service Worker 개선** → 네트워크 요청 분기 처리
7. **safe-area-inset 적용** → 노치/다이나믹 아일랜드 대응

---

## 폰에 설치하는 방법

### 방법 1: PC에서 로컬 서버 실행 → 폰으로 접속

1. 이 폴더를 PC에 저장
2. 터미널(명령 프롬프트)에서 해당 폴더로 이동
3. 아래 명령어 중 하나 실행:

**Python 있는 경우 (macOS·Linux 기본 설치됨)**
```
python3 -m http.server 8080
```

**Node.js 있는 경우**
```
npx serve .
```

4. PC와 폰이 같은 Wi-Fi에 연결된 상태에서  
   폰 브라우저에서 `http://[PC의 IP주소]:8080` 접속
   - PC IP 확인: macOS → `ifconfig | grep 192`, Windows → `ipconfig`
   - 예: `http://192.168.0.5:8080`

5. **iPhone/iPad**: Safari → 하단 공유(□↑) → "홈 화면에 추가"
   **Android**: Chrome 브라우저 메뉴(⋮) → "홈 화면에 추가"

### 방법 2: GitHub Pages 무료 호스팅 (가장 편함)

1. [github.com](https://github.com) 회원가입 (무료)
2. 새 저장소(repository) 생성
3. 이 5개 파일을 업로드
4. Settings → Pages → Branch: main 선택 → Save
5. 자동 생성된 URL을 폰 브라우저에서 열고 홈 화면에 추가

---

## 기능 요약

- **홈**: 오늘 날짜, 시작일부터 몇 주째, 연속 달성, 이번 주 캘린더
- **콘텐츠**: BBC / VOA 탭, 각 프로그램 바로가기
- **설정**: 알림 on/off, 홈 화면 설치, 기록 초기화
- **알림**: 오늘 완료 안 하면 90분마다 알림 (iOS에서는 제한적)
- **오프라인**: 설치 후 인터넷 없어도 앱 실행 가능
- **다크모드**: 폰 시스템 설정 따라 자동 전환
