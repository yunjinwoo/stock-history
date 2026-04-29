# 거래 차트 이미지 첨부 기능

## 개요

거래 상세를 펼쳤을 때 차트 캡처 이미지를 붙일 수 있는 기능입니다.  
드래그 앤 드롭, 클릭 업로드, 클립보드 붙여넣기(Ctrl+V) 세 가지 방식을 지원합니다.

---

## 동작 흐름

```
[업로드]
사용자 액션 (드래그 / 클릭 / Ctrl+V)
  → TradeImageZone.tsx에서 File 객체 획득
  → POST /api/uploads?tradeId={id}   (multipart/form-data)
  → 서버: 파일을 ../data/images/{uuid}.png 으로 저장
  → 서버: TradeImage 레코드를 DB에 생성
  → 응답으로 TradeImage 객체 반환
  → 화면에 썸네일 즉시 표시

[조회]
GET /api/trades 응답에 images 배열 포함
  → TradeHistory에서 trade.images를 TradeImageZone에 전달
  → 각 이미지는 /api/images/{filename} 으로 요청해서 표시

[삭제]
썸네일 호버 시 × 버튼 표시
  → DELETE /api/trade-images/{id}
  → 서버: DB 레코드 삭제 + 파일 삭제
  → 화면에서 즉시 제거
```

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `components/TradeImageZone.tsx` | 업로드 UI, 썸네일, 라이트박스 |
| `app/api/uploads/route.ts` | 파일 수신 + DB 등록 |
| `app/api/images/[filename]/route.ts` | 이미지 파일 서빙 |
| `app/api/trade-images/[id]/route.ts` | 이미지 삭제 |
| `components/TradeHistory.tsx` | TradeImageZone 렌더링, 이미지 상태 관리 |

---

## TradeImageZone 컴포넌트 상세

```tsx
<TradeImageZone
  tradeId={trade.id}        // 어느 거래에 붙일지
  images={currentImages}    // 현재 이미지 배열
  onUpdate={imgs => ...}    // 업로드/삭제 후 부모 상태 갱신
/>
```

**업로드 방식 3가지:**

```
드래그 앤 드롭  → onDrop 이벤트 → e.dataTransfer.files[0]
클릭 후 파일선택 → input[type=file] click → onChange
Ctrl+V 붙여넣기 → onPaste 이벤트 → e.clipboardData.items에서 image/* 추출
```

**상태 관리 (TradeHistory):**

```ts
// 거래별 이미지를 별도 상태로 관리
const [imagesMap, setImagesMap] = useState<Record<string, TradeImage[]>>({})

// 우선순위: 로컬 상태 > API 응답값
// 업로드/삭제가 발생한 거래만 imagesMap에 저장됨
images={imagesMap[trade.id] ?? trade.images}
```

이렇게 하면 이미지를 업로드/삭제할 때마다 전체 목록을 다시 불러오지 않아도 됩니다.

---

## 이미지 파일 저장 위치

```
stock-history/
└── ../data/
    └── images/           ← 이미지 파일 저장 디렉터리
        ├── abc123.png
        └── def456.jpg
```

`process.cwd()` 기준 상위 폴더의 `data/images/`에 저장합니다.  
DB 파일(`stock-history.db`)과 같은 `data/` 디렉터리를 사용해 배포 시 한 곳에서 관리합니다.

---

## 보안 고려사항

`GET /api/images/[filename]`에서 경로 탐색 공격을 방지합니다.

```ts
// ../../../etc/passwd 같은 시도 차단
if (filename.includes('/') || filename.includes('..')) {
  return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
}
```

업로드 시 허용 확장자를 `png, jpg, jpeg, gif, webp`로 제한합니다.
