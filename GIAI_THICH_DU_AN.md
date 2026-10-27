# Giải thích dự án PaintCode Finder

Tài liệu này giải thích dự án bằng lời đơn giản: nó làm gì, chạy thế nào bên trong, code nằm ở đâu và chạy thử ra sao. Không cần biết lập trình sâu vẫn đọc được phần 1 đến 4.

---

## 1. Dự án này là gì?

Đây là một **trang web bán dịch vụ tra mã màu sơn xe ô tô** cho thị trường Anh.

- Người dùng nhập **biển số xe** (ví dụ `AB12 CDE`) hoặc **số khung VIN** (17 ký tự).
- Hệ thống trả về **mã sơn gốc của hãng** (ví dụ `LY9T`), tên màu (`Mythos Black Metallic`), loại sơn (Metallic/Pearl/Solid), thông tin xe và vị trí dán tem mã sơn trên xe.
- Khách hàng chính là **xưởng sơn, gara, cửa hàng pha sơn**: họ cần biết chính xác mã sơn để pha đúng màu.

Mỗi lần tra tốn **1 credit** (giống như 1 "lượt"). Credit được mua bằng thẻ qua **Stripe** (cổng thanh toán quốc tế).

---

## 2. Người dùng đi qua những màn hình nào?

```
Trang chủ (/)  ──►  Đăng ký / Đăng nhập  ──►  Dashboard (/dashboard)  ──►  Billing (/dashboard/billing)
 giới thiệu,         email + mật khẩu           ô nhập biển số,             mua gói tháng / mua lẻ,
 bảng giá,           hoặc Google                kết quả, lịch sử tra        lịch sử credit, tự động nạp
 ô tra thử
```

1. **Trang chủ:** giới thiệu, 3 bước "cách hoạt động", bảng giá. Có ô tra thử, nhưng bấm tra thì được đưa sang trang đăng ký (biển số đã gõ được giữ lại).
2. **Đăng ký / đăng nhập:** bằng email (phải bấm link xác nhận trong email) hoặc bằng Google. Tài khoản mới có **0 credit**. Có chức năng quên mật khẩu.
3. **Dashboard:**
   - Góc trên có **badge số dư** (`⚡ 14 Credits remaining`), nút `+ Buy Credits` và menu tài khoản.
   - Ô nhập trông giống **biển số xe thật** (nền vàng, chữ in hoa).
   - Bấm `Get Paint Code` sẽ hiện thẻ kết quả: mã sơn chữ to, có nút Copy, kèm hình minh hoạ vị trí tem.
   - Bên dưới là **bảng lịch sử tra cứu**, có ô lọc nhanh và nút "View details".
4. **Billing:**
   - Gói đang dùng và ngày gia hạn.
   - Nút mua gói tháng hoặc mua lẻ.
   - Nút "Manage Subscription / Invoices" mở trang của Stripe để khách đổi thẻ, tải hoá đơn, huỷ gói.
   - Bảng **lịch sử credit**: mọi lần cộng hoặc trừ đều ghi rõ.
   - Ô cài **tự động nạp thêm** khi hết credit.

**Điều hướng thông minh:** người đã đăng nhập mà vào trang chủ sẽ tự được chuyển thẳng vào Dashboard. Người chưa đăng nhập mà vào Dashboard sẽ bị chuyển về trang đăng nhập.

---

## 3. Credit hoạt động thế nào?

Hãy coi credit như **tiền trong ví**.

### Có 2 nguồn credit

| Loại | Mua thế nào | Hết hạn không? |
| --- | --- | --- |
| **Gói tháng** (Starter 15 / Pro 50 / Agency 200 lượt) | Đăng ký trả tiền hàng tháng, tự gia hạn | Mặc định **reset mỗi tháng** (phần thừa mất khi gia hạn hoặc khi huỷ gói). Có thể đổi bằng cấu hình `SUBSCRIPTION_CREDIT_ROLLOVER` |
| **Mua lẻ** (5 / 10 / 25 lượt) | Trả 1 lần | **Không bao giờ hết hạn**, kể cả khi huỷ gói tháng |

Khi tra, hệ thống **dùng credit gói tháng trước**, hết mới dùng tới credit mua lẻ. Giá trong `src/lib/plans.ts` hiện là **giá tạm**, chờ khách chốt.

### Khi nào bị trừ, khi nào được hoàn?

| Tình huống | Kết quả |
| --- | --- |
| Tìm thấy mã sơn | **Trừ 1 credit** |
| Không tìm thấy xe | **Hoàn lại 1 credit** (lý do `API_NO_DATA`) |
| Tìm thấy xe nhưng không có mã sơn | **Hoàn lại 1 credit** (lý do `API_NO_DATA`) |
| Nhà cung cấp dữ liệu bị lỗi hoặc quá 10 giây không trả lời | **Hoàn lại 1 credit** (lý do `API_ERROR`) |
| Tra lại biển số mình đã tra thành công trong 30 ngày | **Miễn phí**, hiện lại kết quả cũ kèm nhãn "đã lưu trong lịch sử" |
| Hết credit | Không tra được, hiện popup mời mua thêm |

### Tự động nạp thêm (dành cho gara dùng nhiều)

Khách chọn sẵn một gói lẻ trong trang Billing. Khi số dư về 0, hệ thống tự trừ tiền gói đó trên thẻ đã lưu, nên công việc không bị gián đoạn. Tối đa 1 lần trừ tiền mỗi 10 phút.

---

## 4. Bên trong hệ thống gồm những "bộ phận" nào?

```
                ┌──────────────────────────────┐
  Trình duyệt   │  Giao diện (Next.js + React) │
  của khách ───►│  trang chủ, dashboard, ...   │
                └──────────────┬───────────────┘
                               │
                ┌──────────────▼───────────────┐
                │  "Người gác cổng" (proxy.ts) │  kiểm tra đăng nhập, chuyển trang,
                │                              │  chặn spam (> 5 lượt/giây)
                └──────────────┬───────────────┘
                               │
                ┌──────────────▼───────────────┐
                │  Máy chủ Next.js (API)        │  xử lý tra cứu, thanh toán
                └───┬─────────────┬─────────┬──┘
                    │             │         │
        ┌───────────▼──┐  ┌───────▼─────┐ ┌─▼────────────────────┐
        │  Supabase    │  │   Stripe    │ │ Nhà cung cấp dữ liệu │
        │  (Database + │  │ (thanh toán)│ │ mã sơn (hiện là bản  │
        │  đăng nhập)  │  │             │ │ giả lập - Mock API)  │
        └──────────────┘  └─────────────┘ └──────────────────────┘
```

| Bộ phận | Vai trò dễ hiểu |
| --- | --- |
| **Next.js** | Khung làm web: vừa vẽ giao diện vừa chạy phần máy chủ |
| **TailwindCSS** | Công cụ tạo kiểu (màu sắc, bố cục) |
| **Supabase** | Kho dữ liệu PostgreSQL + hệ thống đăng nhập (email, Google) |
| **Stripe** | Thu tiền thẻ, quản lý gói tháng, hoá đơn |
| **Upstash Redis** (tuỳ chọn) | Bộ đếm để chặn spam khi chạy nhiều máy chủ. Không có thì hệ thống dùng bộ đếm trong bộ nhớ |
| **Mock API** | Nhà cung cấp mã sơn **giả lập**, để làm và test trước khi khách chốt nhà cung cấp thật |

---

## 5. Một lượt tra cứu diễn ra thế nào? (từng bước)

Ví dụ khách bấm tra `AB12 CDE`:

1. **Chuẩn hoá:** `ab12 cde` trở thành `AB12CDE`. Kiểm tra đúng định dạng biển số Anh hoặc VIN.
2. **Kiểm tra lịch sử:** khách đã tra thành công xe này trong 30 ngày thì trả lại kết quả cũ, **không trừ tiền**, không tốn phí gọi nhà cung cấp.
3. **Chống spam:** mỗi khách chỉ được 1 lượt tra tính tiền mỗi giây. Ngoài ra "người gác cổng" chặn sớm nếu có hơn 5 yêu cầu/giây.
4. **Trừ 1 credit an toàn:** database **khoá tài khoản khách lại** trong tích tắc, kiểm tra còn credit, trừ 1, rồi ghi lượt tra ở trạng thái "đang xử lý" (`PENDING`). Khách bấm 20 lần cùng lúc thì chỉ 1 lần được trừ.
5. **Gọi nhà cung cấp dữ liệu** (tối đa 10 giây). Nhà cung cấp chính lỗi thì tự chuyển sang nhà cung cấp dự phòng (failover).
6. **Kết thúc:**
   - Có mã sơn: lượt tra thành `SUCCESS` và hiện kết quả.
   - Không có mã sơn hoặc lỗi: **tự hoàn 1 credit**, ghi lý do vào sổ.
7. Badge số dư cập nhật ngay. Nếu số dư về 0 và khách bật tự động nạp, hệ thống trừ tiền gói nạp ở chế độ chạy nền.

**Lưới an toàn:** nếu máy chủ sập giữa bước 5, lượt tra kẹt ở `PENDING`. Có một tác vụ tự chạy mỗi 5 phút (`/api/cron/refund-stale`) để hoàn tiền những lượt bị kẹt.

---

## 6. Thanh toán: tại sao chỉ cộng credit qua "webhook"?

**Webhook** là tin nhắn Stripe tự gửi về máy chủ của mình để báo "khách đã trả tiền xong".

- Khách thanh toán xong được đưa về trang `/payment-success`. Trang này **không cộng credit**, vì ai cũng có thể tự gõ địa chỉ đó.
- Credit **chỉ được cộng khi nhận tin nhắn có chữ ký của Stripe** (`/api/webhooks/stripe`). Tin giả mạo hoặc bị sửa nội dung đều bị từ chối.
- Stripe đôi khi gửi **cùng một tin nhắn nhiều lần**. Mỗi tin có mã riêng (`evt_...`) được lưu lại, nên tin trùng bị bỏ qua và **không bao giờ cộng 2 lần**.

| Tin nhắn Stripe | Hệ thống làm gì |
| --- | --- |
| `checkout.session.completed` | Khách mua lẻ xong: cộng credit |
| `invoice.paid` | Gói tháng được thanh toán (lần đầu hoặc gia hạn): cấp credit tháng |
| `invoice.payment_failed` | Thẻ gia hạn bị lỗi: gói chuyển sang "quá hạn", Dashboard nhắc cập nhật thẻ. Credit mua lẻ vẫn dùng được |
| `customer.subscription.*` | Gói được tạo / đổi / huỷ. Huỷ thì credit tháng hết hạn, credit mua lẻ giữ nguyên |
| `payment_intent.succeeded` / `payment_failed` | Kết quả của lần tự động nạp |

---

## 7. Các lớp bảo vệ "không thất thoát credit"

1. **Database cấm số dư âm** (`CHECK credit_balance >= 0`): kể cả code có lỗi, database cũng từ chối.
2. **Khoá dòng khi trừ tiền** (`SELECT ... FOR UPDATE`): các yêu cầu cùng lúc phải xếp hàng, không ai "chen ngang".
3. **Mỗi lượt tra chỉ hoàn tiền tối đa 1 lần.**
4. **Mỗi tin nhắn Stripe chỉ cộng tiền 1 lần.**
5. **Khách chỉ đọc được dữ liệu của chính mình** (Row Level Security). Mọi thao tác cộng/trừ tiền chỉ chạy được bằng khoá bí mật của máy chủ, trình duyệt không thể tự gọi.
6. **Sổ cái (ledger):** mọi biến động đều được ghi lại. Tổng sổ cái luôn bằng số dư (các bài test đều kiểm tra điều này).

---

## 8. Code nằm ở đâu?

```
supabase/
  migrations/                 Cấu trúc database + các hàm trừ/cộng/hoàn credit (phần quan trọng nhất)
  tests/                      Test database thật (bấm đồng thời, số dư âm, hoàn tiền, phân quyền...)
src/
  proxy.ts                    "Người gác cổng": chuyển trang theo đăng nhập + chặn spam
  app/                        Các trang và API
    page.tsx                    Trang chủ
    (auth)/                     Đăng nhập, đăng ký, quên/đặt lại mật khẩu
    dashboard/                  Dashboard + trang Billing
    api/lookup/                 API tra cứu
    api/stripe/                 Mở trang thanh toán / trang quản lý gói của Stripe
    api/webhooks/stripe/        Nhận tin nhắn từ Stripe
    api/cron/refund-stale/      Hoàn tiền lượt tra bị kẹt
  components/                 Các mảnh giao diện (ô biển số, thẻ kết quả, badge, bảng lịch sử...)
  lib/
    lookup/service.ts           Luồng tra cứu 7 bước ở mục 5
    paint-api/                  Kết nối nhà cung cấp mã sơn (Adapter Pattern, xem dưới)
    stripe/                     Xử lý thanh toán, webhook, tự động nạp
    plans.ts                    Bảng giá
    rate-limit.ts               Chống spam
e2e/                          Môi trường giả lập + kịch bản test tự động bằng trình duyệt
```

### "Adapter Pattern" là gì?

Khách **chưa chốt** sẽ mua dữ liệu mã sơn của nhà cung cấp nào. Vì vậy hệ thống làm sẵn một **"ổ cắm chuẩn"**: mọi nhà cung cấp đều phải trả dữ liệu về cùng một dạng.

Khi có nhà cung cấp thật, chỉ cần viết một "phích cắm" mới trong `src/lib/paint-api/providers/`, theo mẫu `http-template.ts`. Không phải sửa giao diện hay phần thanh toán. Cách làm chi tiết có trong `README.md`.

---

## 9. Chạy thử trên máy (không cần tài khoản Supabase/Stripe)

```bash
npm install          # cài thư viện (một lần)
npm run e2e:setup    # tải công cụ giả lập (một lần)
npm run demo         # mở http://localhost:3000
```

- Tài khoản demo: **demo@paintcode.test** / **Demo12345!** (có sẵn 20 credit).
- Email xác nhận đăng ký (giả lập) xem tại `http://127.0.0.1:55400/__test/mail`.
- Bấm **Ctrl+C** để tắt. Dữ liệu demo bị xoá khi tắt.
- Máy nên còn trống RAM: demo chạy cả database, máy chủ và công cụ giả lập Stripe.

**Biển số thử** (với Mock API):

| Biển số bắt đầu bằng | Kết quả |
| --- | --- |
| bất kỳ, ví dụ `AB12CDE` | Có mã sơn, trừ 1 credit |
| `NF` | Không tìm thấy xe, hoàn credit |
| `NP` | Có xe nhưng không có mã sơn, hoàn credit |
| `ER` | Nhà cung cấp lỗi, hoàn credit |
| `SL` | Trả lời chậm hơn 10 giây, hết giờ, hoàn credit |
| `FO` | Nhà cung cấp chính sập, nhà cung cấp dự phòng trả kết quả |

Thẻ test Stripe: `4242 4242 4242 4242`. Bản demo không mở được trang thanh toán thật của Stripe, cần key Stripe thật mới mở được.

---

## 10. Kiểm tra tự động

| Lệnh | Kiểm tra gì |
| --- | --- |
| `npm test` | 31 test nhỏ: đọc biển số, chuyển nhà cung cấp, luồng tra cứu, chữ ký Stripe |
| `npm run test:db` | 17 test trên database thật: bấm đồng thời, số dư âm, hoàn tiền, tin Stripe trùng, phân quyền, tự động nạp |
| `npm run test:e2e` | 133 bước, dùng trình duyệt thật đi qua mọi luồng như một khách hàng |
| `npm run lint` / `npm run build` | Kiểm tra lỗi code và đóng gói bản chạy thật |

Tất cả đang **đạt 100%**.

---

## 11. Đưa lên chạy thật cần gì?

1. Tạo project **Supabase**: bật xác nhận email và đăng nhập Google, chạy migration (`npx supabase db push`).
2. Tạo tài khoản **Stripe**: lấy key và tạo webhook trỏ về `<tên miền>/api/webhooks/stripe` (danh sách sự kiện có trong `README.md`).
3. Điền các key vào file `.env.local` (mẫu: `.env.example`).
4. Deploy (ví dụ lên Vercel; tác vụ hoàn tiền 5 phút/lần đã cấu hình sẵn trong `vercel.json`).

**Còn chờ khách quyết định:**
- Bảng giá chính thức.
- Credit gói tháng có được cộng dồn sang tháng sau không.
- Chọn nhà cung cấp dữ liệu mã sơn thật (Milestone 3).

---

## 12. Từ điển nhanh

| Từ | Nghĩa |
| --- | --- |
| **VRM** | Biển số xe ở Anh |
| **VIN** | Số khung xe (17 ký tự) |
| **Credit** | Lượt tra cứu, 1 credit = 1 lần tra thành công |
| **Top-up** | Mua lẻ thêm credit |
| **Subscription** | Gói thuê bao hàng tháng |
| **Webhook** | Tin nhắn Stripe tự gửi về để báo kết quả thanh toán |
| **Ledger** | Sổ cái ghi mọi lần cộng/trừ credit |
| **Rate limit** | Giới hạn số lần gọi trong một khoảng thời gian (chống spam) |
| **Mock API** | Dịch vụ giả lập để test khi chưa có dịch vụ thật |
| **Migration** | File mô tả cấu trúc database, chạy để tạo bảng |
| **RLS** | Row Level Security, quy tắc "mỗi người chỉ thấy dữ liệu của mình" |
| **Proxy** | Lớp kiểm tra đứng trước mọi trang (trước đây Next.js gọi là middleware) |
