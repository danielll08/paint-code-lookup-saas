# TÀI LIỆU ĐẶC TẢ YÊU CẦU SẢN PHẨM & KỸ THUẬT (PRD)

* **Tên dự án:** Hệ thống SaaS Tra cứu Mã màu sơn xe (Paint Code Lookup SaaS)
* **Trang web mẫu tham chiếu:** `paintcodebyreg.com`
* **Phiên bản tài liệu:** 2.0 (Detailed Technical & Functional Specification)
* **Trạng thái:** Sẵn sàng thiết kế hệ thống & phát triển khung (Chờ chốt API Provider)

---

## 1. Tổng quan & Bài toán Kinh doanh (Executive Summary)

### 1.1. Mục đích sản phẩm
Xây dựng một ứng dụng web B2B/B2C theo mô hình **SaaS (Software as a Service)** đóng vai trò là cổng giao tiếp (Front-end & Billing Wrapper) cho các API dữ liệu phương tiện giao thông của bên thứ ba. Người dùng (xưởng đồng sơn, gara ô tô, cửa hàng pha sơn, cá nhân) nạp tiền mua **Tín dụng (Credits)** để tra cứu chính xác **Mã màu sơn (OEM Paint Code)** của xe ô tô chỉ bằng cách nhập Biển số xe (Registration Number / VRM) hoặc Số khung (VIN).

### 1.2. Trọng tâm sống còn của dự án (Critical Success Factors)
1. **Bảo toàn doanh thu tuyệt đối (Zero Credit Leakage):** Do mỗi lần gọi API bên thứ ba khách hàng đều phải trả tiền tươi (cost per request), hệ thống quản lý số dư Credit và thanh toán Stripe phải đạt chuẩn an toàn tài chính (ACID compliant), chống triệt để lỗi **Race Condition** (bấm nhanh nhiều lần để xài chùa vượt số dư) hoặc lỗi gọi API thất bại nhưng vẫn trừ tiền.
2. **Trải nghiệm người dùng tối giản (Frictionless UX):** Giao diện không màu mè, tốc độ phản hồi cực nhanh. Người dùng đã đăng nhập khi mở web là vào thẳng màn hình nhập biển số xe ngay lập tức.
3. **Kiến trúc đa nguồn dữ liệu (Multi-Provider API Agnostic):** Khách hàng đang đàm phán với 4 nhà cung cấp API. Hệ thống phải thiết kế theo chuẩn *Adapter Pattern* để có thể cắm (plug-and-play) bất kỳ API nào, hoặc tự động chuyển hướng sang API dự phòng (Failover) nếu API chính bị sập hoặc không có dữ liệu.

---

## 2. Phân tích Đối tượng & Luồng Người dùng (User Personas & Journeys)

### 2.1. Nhóm người dùng mục tiêu
* **Khách hàng lẻ (DIY / Car Owners):** Chỉ cần tra cứu 1-2 xe. Nhóm này thường ưu tiên mua gói lẻ (One-off Top-up) hoặc gói cơ bản thấp nhất.
* **Khách hàng doanh nghiệp (Bodyshops / Garages / Paint Mixers):** Tra cứu liên tục hàng ngày. Nhóm này cần gói thuê bao hàng tháng (Monthly Subscription), tự động gia hạn, lưu lịch sử tra cứu để đối chiếu và tự động mua thêm (Top-up) khi hết hạn mức trong tháng.

### 2.2. Sơ đồ Luồng Điều hướng & Xác thực (Routing & Auth Flow)
```
[Người dùng truy cập domain.com (/)]
       │
       ├──> [Middleware kiểm tra Cookie/JWT Session trên Edge/Server]
       │
       ├─(Chưa đăng nhập)──> Hiển thị Landing Page (Giới thiệu, Bảng giá, Nút Login)
       │                           │
       │                           └──> Click "Login / Sign Up" (Email hoặc Google OAuth)
       │                                       │
       └─(Đã đăng nhập)────────────────────────┴──> Redirect 307 thẳng tới [/dashboard]
```

### 2.3. Sơ đồ Luồng Tra cứu & Bảo vệ Tín dụng (Core Lookup & Atomic Credit Flow)
Đây là luồng quan trọng nhất của toàn bộ hệ thống:
```
[User nhập Biển số "AB12 CDE" & Bấm "Search"]
       │
       ▼
[1. Chuẩn hóa & Kiểm tra Cache/Lịch sử]
  - Xóa khoảng trắng, viết hoa ("AB12CDE").
  - Kiểm tra: User này đã tra biển số này trong 30 ngày qua chưa?
    └──> (Nếu ĐÃ TRA): Trả kết quả cũ ngay lập tức (0 tốn Credit, 0 tốn phí API).
       │
       ▼ (Nếu CHƯA TRA)
[2. Kiểm tra Rate Limit (Chống Spam)]
  - Kiểm tra Redis/Memory: User có đang gửi > 1 request/giây không? -> Nếu có: Chặn (HTTP 429).
       │
       ▼
[3. Khởi tạo Giao dịch Khóa Số dư (Database Transaction & Row Locking)]
  - Mở SQL Transaction: `SELECT credit_balance FROM users WHERE id = X FOR UPDATE`
  - Khoá dòng dữ liệu của User X lại (các cú click chuột thứ 2, 3, 4 cùng lúc sẽ phải xếp hàng đợi).
  - Nếu `credit_balance < 1` -> Mở khóa, báo lỗi "Không đủ Credit", bật Popup mua thêm.
  - Nếu `credit_balance >= 1` -> Trừ `credit_balance = credit_balance - 1`, ghi nhận trạng thái `PENDING` vào bảng Lịch sử.
       │
       ▼
[4. Gọi API Bên thứ 3 (Third-Party API Call)]
  - Gửi biển số "AB12CDE" tới API Provider (Timeout thiết lập: 10 giây).
       │
       ├──> [Trường hợp A: API trả về Thành công & Có Mã Sơn]
       │      - Lưu kết quả JSON + Paint Code vào DB.
       │      - Cập nhật trạng thái giao dịch thành `COMPLETED`.
       │      - Hiển thị Mã màu sơn lên màn hình cho User.
       │
       └──> [Trường hợp B: API lỗi (500/Timeout) HOẶC Không tìm thấy dữ liệu xe (404)]
              - Kích hoạt luồng **Auto-Refund (Hoàn tiền tự động)**:
              - Cộng lại `+1 Credit` vào `credit_balance` của User.
              - Ghi vào sổ cái (Ledger) lý do hoàn tiền: `API_NO_DATA` hoặc `API_ERROR`.
              - Thông báo cho User: "Không tìm thấy mã sơn cho biển số này. Bạn không bị trừ Credit."
```

---

## 3. Đặc tả Chi tiết Các Phân hệ Chức năng (Functional Specifications)

### 3.1. Phân hệ Xác thực & Quản lý Tài khoản (Auth & Session)
* **Phương thức đăng nhập:**
  * **Google OAuth 2.0:** Đăng nhập 1 chạm (One-click login). Nếu tài khoản chưa tồn tại, tự động khởi tạo hồ sơ người dùng với `credit_balance = 0`.
  * **Email & Password:** Đăng ký chuẩn, yêu cầu xác thực email (Email Verification) để tránh tạo tài khoản rác hàng loạt, hỗ trợ luồng Quên mật khẩu (Forgot/Reset Password).
* **Cơ chế Routing thông minh:**
  * Sử dụng Server-side Middleware kiểm tra trạng thái đăng nhập trước khi render HTML. Người dùng đã đăng nhập không bao giờ thấy lại trang Landing Page trừ khi họ chủ động bấm vào link "Về chúng tôi" hoặc "Đăng xuất".

### 3.2. Phân hệ Giao diện & Màn hình (UI/UX Screens)
Giao diện tuân thủ nguyên tắc **Minimalist & Utility-first** (Tương tự `paintcodebyreg.com` nhưng hiện đại, phản hồi nhanh và rõ ràng hơn):

1. **Trang chủ (Landing Page - `/`):**
   * **Hero Section:** Tiêu đề rõ ràng + Ô nhập biển số xe dùng thử (khi bấm tra cứu sẽ yêu cầu đăng nhập/đăng ký để xem kết quả).
   * **How it works:** 3 bước đơn giản (Nhập biển số -> Hệ thống quét dữ liệu gốc -> Nhận mã màu sơn chính xác trong 3 giây).
   * **Pricing Table (Bảng giá):** Chia thành 2 tab hoặc 2 khu vực rõ rệt: **Gói Thuê bao Hàng tháng (Monthly Plans)** và **Gói Mua lẻ (Pay-as-you-go Top-ups)**.
2. **Bảng điều khiển chính (Main Dashboard - `/dashboard`):**
   * **Header Bar:** Logo bên trái; Bên phải là **Badge hiển thị số dư Credit theo thời gian thực** (Ví dụ: `⚡ 14 Credits remaining`), nút `+ Buy Credits` nổi bật, và menu Tài khoản.
   * **Khu vực Tìm kiếm Trung tâm (Search Box):**
     * Thiết kế ô nhập liệu mô phỏng hình dáng **Biển số xe thực tế** (ví dụ: nền vàng/trắng, phông chữ biển số in hoa tự động).
     * Nút `Get Paint Code` lớn, có trạng thái Loading (vòng xoay + vô hiệu hóa nút bấm ngay khi vừa click).
   * **Thẻ Kết quả Tra cứu (Vehicle & Paint Result Card):** Ngay sau khi tra cứu thành công, hiển thị thẻ thông tin ngay bên dưới ô tìm kiếm:
     * **Thông tin xe để đối chiếu:** Hãng xe (Make), Dòng xe (Model), Năm sản xuất (Year), Màu sắc đăng ký (Registered Color), Số khung ẩn một phần (Partial VIN).
     * **Thông tin Sơn (Tâm điểm):**
       * **Paint Code (Mã màu sơn):** Chữ to, in đậm, có nút `Copy` nhanh (VD: `LY9T`).
       * **Paint Name (Tên màu sơn thương mại):** (VD: `Mythos Black Metallic`).
       * **Paint Type / Finish:** (VD: `Metallic / Pearl / Solid`).
       * **Vị trí tem thông số trên xe (Plate Location Diagram):** Hình ảnh/chỉ dẫn vị trí dán tem mã màu trên khung cửa hoặc khoang máy của dòng xe đó (nếu API hỗ trợ).
   * **Bảng Lịch sử Tra cứu Gần đây (Recent Lookups Table):**
     * Nằm ngay nửa dưới màn hình Dashboard để người dùng tiện tra lại mà không cần chuyển trang.
     * Cột: *Thời gian | Biển số | Dòng xe | Mã màu sơn | Nút "Xem chi tiết"*.
     * Có thanh tìm kiếm nhanh để lọc lại các biển số cũ đã từng tra.
3. **Trang Quản lý Thanh toán & Gói cước (`/dashboard/billing`):**
   * Hiển thị gói Subscription hiện tại (Ví dụ: *Pro Plan - 50 Credits/tháng - Gia hạn ngày 15/11*).
   * Các nút mua nhanh gói Top-up lẻ (Ví dụ: Mua thêm 5, 10, 25 Credits).
   * Nút **"Manage Subscription / Invoices"**: Chuyển hướng sang **Stripe Customer Portal** (do Stripe host sẵn) để khách tự đổi thẻ Visa/Mastercard, tải hóa đơn PDF hoặc hủy gói.
   * Bảng **Lịch sử Giao dịch Tín dụng (Credit Ledger):** Minh bạch mọi biến động số dư (+50 từ gói tháng, -1 tra xe AB12CDE, +1 hoàn tiền do lỗi dữ liệu...).

---

### 3.3. Phân hệ Thanh toán Stripe & Quy tắc Kinh doanh Tín dụng (Billing & Credit Engine)

#### A. Cơ chế Gói Thuê bao (Monthly Subscriptions) vs. Mua lẻ (Top-ups)
* **Gói Thuê bao (Recurring):**
  * Đăng ký qua Stripe Checkout (`mode: 'subscription'`).
  * Vào đầu mỗi chu kỳ thanh toán hàng tháng (khi Stripe bắn webhook `invoice.paid`), hệ thống sẽ cấp phát định mức Credit của gói đó.
  * **Chính sách Cộng dồn (Rollover Policy - Cần xác nhận với khách, mặc định hỗ trợ cấu hình):** Tách hoặc gộp số dư nhưng đảm bảo: **Credit mua lẻ (Top-up) không bao giờ bị hết hạn**, ngay cả khi người dùng hủy gói thuê bao hàng tháng.
* **Gói Mua lẻ (One-time Top-up):**
  * Thanh toán qua Stripe Checkout (`mode: 'payment'`).
  * Khi Stripe bắn webhook `checkout.session.completed`, hệ thống cộng thẳng số lượng Credit vừa mua vào tài khoản người dùng.

#### B. Bảo mật Webhook & Chống Cộng tiền Kép (Idempotency)
* Tuyệt đối **KHÔNG** cộng Credit khi người dùng được chuyển hướng về trang `/payment-success` trên trình duyệt.
* Chỉ cộng Credit thông qua **Stripe Webhook Endpoint** (`/api/webhooks/stripe`) có kiểm tra chữ ký bảo mật (`stripe-signature`).
* Vì Stripe có cơ chế gửi lại Webhook nhiều lần nếu mạng chập chờn, mọi sự kiện Webhook đều có một mã `event.id` duy nhất (VD: `evt_1Pxyz...`). Trước khi cộng tiền, hệ thống tra cứu mã `event.id` này trong bảng `credit_transactions`:
  * Nếu đã tồn tại -> Bỏ qua và trả về HTTP 200 OK ngay lập tức.
  * Nếu chưa tồn tại -> Thực hiện cộng Credit và lưu `event.id` với khóa `UNIQUE` vào Database.

---

## 4. Kiến trúc Kỹ thuật Chuyên sâu & Bảo mật Cơ sở dữ liệu (Technical Architecture)

### 4.1. Đề xuất Tech Stack Tối ưu
* **Full-stack Framework:** **Next.js 14/15 (App Router + TypeScript)** – Tích hợp sẵn giao diện React tốc độ cao và hệ thống Backend API Routes bảo mật.
* **Cơ sở dữ liệu (Database):** **PostgreSQL** (khuyên dùng qua nền tảng **Supabase** hoặc **Neon.tech**). Lý do bắt buộc chọn PostgreSQL: Hỗ trợ hoàn hảo cơ chế **ACID Transaction**, **Row-level Locking (`FOR UPDATE`)** và **Check Constraints** để triệt tiêu 100% khả năng âm tiền hoặc hack số dư.
* **Xác thực (Auth):** **Supabase Auth** hoặc **NextAuth.js (Auth.js v5)** kết hợp Google Provider.
* **Chống Spam / Rate Limiting:** **Upstash Redis** (Serverless Redis) dùng để chặn người dùng gửi hàng loạt request trong 1 giây ngay từ tầng cổng mạng (Edge Middleware) trước khi chạm vào Database.
* **Giao diện (Styling):** **Tailwind CSS + shadcn/ui** (Đẹp, chuyên nghiệp, cực kỳ gọn nhẹ).

---

### 4.2. Thiết kế Cơ sở dữ liệu (PostgreSQL Schema & Anti-Exploit Logic)

Dưới đây là cấu trúc bảng và hàm xử lý giao dịch nguyên tử (Atomic Transaction) ở cấp độ Database giúp hệ thống miễn nhiễm với mọi thủ thuật click nhanh (Race Condition):

```sql
-- 1. Bảng Hồ sơ Người dùng & Số dư (Ràng buộc cứng không bao giờ âm)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    stripe_customer_id TEXT UNIQUE,
    -- Ràng buộc CHECK cực kỳ quan trọng: Database sẽ từ chối mọi lệnh làm số dư < 0
    credit_balance INTEGER NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
    subscription_status TEXT DEFAULT 'inactive', -- 'active', 'past_due', 'canceled', 'inactive'
    subscription_tier TEXT,                      -- 'starter', 'pro', 'agency'
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bảng Sổ cái Giao dịch Tín dụng (Audit Trail & Chống trùng lặp Webhook)
CREATE TABLE public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- Số dương (+10) khi nạp/hoàn tiền, Số âm (-1) khi tra cứu
    balance_after INTEGER NOT NULL, -- Số dư ngay sau giao dịch để đối soát
    transaction_type TEXT NOT NULL, -- 'SUBSCRIPTION_CREDIT', 'TOPUP_PURCHASE', 'LOOKUP_DEDUCTION', 'LOOKUP_REFUND', 'ADMIN_ADJUSTMENT'
    stripe_event_id TEXT UNIQUE,    -- Khóa UNIQUE chống Stripe cộng tiền 2 lần
    reference_lookup_id UUID,       -- Liên kết tới lượt tra cứu (nếu là trừ/hoàn tiền)
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Lịch sử Tra cứu Xe (Lookups & Caching)
CREATE TABLE public.vehicle_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vrm_normalized TEXT NOT NULL,   -- Biển số đã chuẩn hóa (VD: "AB12CDE")
    api_provider TEXT NOT NULL,     -- Nhà cung cấp API nào đã trả kết quả (Provider A, B, C, D)
    status TEXT NOT NULL,           -- 'PENDING', 'SUCCESS', 'FAILED_REFUNDED', 'NOT_FOUND_REFUNDED'
    paint_code TEXT,                -- Mã màu sơn (VD: "LY9T")
    paint_name TEXT,                -- Tên màu sơn (VD: "Mythos Black")
    vehicle_make TEXT,
    vehicle_model TEXT,
    vehicle_year INTEGER,
    raw_api_response JSONB,         -- Lưu toàn bộ JSON gốc từ API để tra cứu lại miễn phí
    cost_credits INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tạo Index để tìm kiếm lịch sử cực nhanh
CREATE INDEX idx_lookups_user_vrm ON public.vehicle_lookups(user_id, vrm_normalized);
```

#### Cơ chế Khóa Dòng (Row-Level Locking Function) chống Click nhanh:
Khi người dùng bấm nút "Tra cứu", Backend gọi hàm PostgreSQL RPC dưới đây:
```sql
CREATE OR REPLACE FUNCTION deduct_credit_for_lookup(p_user_id UUID, p_vrm TEXT, p_provider TEXT)
RETURNS UUID AS $$
DECLARE
    v_current_balance INTEGER;
    v_lookup_id UUID;
BEGIN
    -- BƯỚC QUAN TRỌNG NHẤT: Khóa dòng (FOR UPDATE) của user này lại.
    -- Nếu user bấm 10 lần cùng lúc trong 1 mili-giây, 9 request sau sẽ bị bắt đứng đợi
    -- cho đến khi request đầu tiên trừ tiền xong và mở khóa.
    SELECT credit_balance INTO v_current_balance
    FROM public.users
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_current_balance < 1 THEN
        RAISE EXCEPTION 'INSUFFICIENT_CREDITS';
    END IF;

    -- Trừ 1 credit
    UPDATE public.users
    SET credit_balance = credit_balance - 1,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Tạo bản ghi tra cứu ở trạng thái PENDING
    INSERT INTO public.vehicle_lookups (user_id, vrm_normalized, api_provider, status, cost_credits)
    VALUES (p_user_id, p_vrm, p_provider, 'PENDING', 1)
    RETURNING id INTO v_lookup_id;

    -- Ghi vào sổ cái (Ledger)
    INSERT INTO public.credit_transactions (user_id, amount, balance_after, transaction_type, reference_lookup_id, description)
    VALUES (p_user_id, -1, v_current_balance - 1, 'LOOKUP_DEDUCTION', v_lookup_id, 'Lookup VRM: ' || p_vrm);

    RETURN v_lookup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### 4.3. Kiến trúc Adapter Đa Nhà cung cấp API (Multi-Provider API Architecture)

Vì khách hàng đang làm việc với 4 nhà cung cấp API khác nhau (và trong thực tế ngành dữ liệu xe tại Anh/Mỹ như *UK Vehicle Data, Cazana, CarWeb, AutoData*, mỗi bên trả về một cấu trúc JSON khác nhau), hệ thống sẽ xây dựng một lớp trung gian chuẩn hóa gọi là **`PaintApiAdapter`**:

```typescript
// Chuẩn hóa đầu ra duy nhất cho toàn bộ giao diện Web
export interface StandardizedVehiclePaintData {
  found: boolean;
  vrm: string;
  vin?: string;
  make: string;
  model: string;
  year: number;
  registeredColor: string;
  paintCode: string | null;       // Mã sơn OEM (Quan trọng nhất)
  paintDescription: string | null;// Tên màu sơn nhà sản xuất
  paintFinish?: string;           // Metallic / Solid / Pearl
  codeLocationHint?: string;      // Vị trí dán tem trên xe
  providerName: string;           // Ghi nhận lấy từ API nào
}
```
* **Lợi ích cho dự án:**
  1. Bạn có thể code xong **95% trang web** ngay hôm nay bằng một `MockPaintProvider` (API giả lập trả dữ liệu mẫu để khách hàng test thử luồng mua gói, trừ tiền, chống gian lận).
  2. Ngay khi khách hàng chốt được 1 trong 4 nhà cung cấp API (hoặc muốn kết hợp cả 2 nhà cung cấp: gọi API giá rẻ trước, nếu không có mã sơn mới tự động gọi sang API đắt tiền hơn), bạn chỉ mất vài giờ để viết thêm 1 file Adapter mà không phải sửa lại bất kỳ dòng code giao diện hay thanh toán nào.

---

## 5. Xử lý Các Trường hợp Ngoại lệ (Edge Cases & Business Logic)

1. **Biển số xe hợp lệ nhưng API không có dữ liệu Mã màu sơn (Partial Data):**
   * *Tình huống:* API trả về đúng là xe BMW 320i màu Đen, nhưng trường `paint_code` bị trống (`null`).
   * *Cách xử lý:* Vì mục đích duy nhất của khách hàng là tìm **Mã màu sơn**, nếu `paint_code == null`, hệ thống coi như tra cứu không thành công -> **Tự động hoàn lại 1 Credit** và báo cho người dùng biết dữ liệu mã sơn của xe này hiện chưa có trên hệ thống gốc.
2. **Người dùng tra cứu lại cùng 1 biển số (Duplicate Lookup Protection):**
   * *Tình huống:* Người dùng vô tình bấm tra cứu lại biển số họ vừa tìm hôm qua.
   * *Cách xử lý:* Hệ thống kiểm tra trong bảng `vehicle_lookups`, thấy đã có kết quả thành công -> Hiển thị lại kết quả đó ngay lập tức và gắn nhãn *"Đã lưu trong lịch sử của bạn - Không bị trừ Credit"*. (Đồng thời tiết kiệm tiền gọi API bên thứ 3 cho chủ web).
3. **Thanh toán gia hạn hàng tháng bị lỗi thẻ (Failed Subscription Renewal):**
   * *Tình huống:* Tới ngày gia hạn, thẻ của khách hết tiền, Stripe báo sự kiện `invoice.payment_failed`.
   * *Cách xử lý:* Đổi trạng thái gói sang `past_due`, gửi thông báo trên Dashboard nhắc người dùng cập nhật thẻ. Tuy nhiên, nếu trong tài khoản của họ vẫn còn dư Credit mua lẻ (Top-up) từ trước, họ vẫn được phép xài nốt số Credit đó.

---

## 6. Lộ trình Triển khai & Bàn giao (Development Milestones)

Chia dự án thành 3 giai đoạn rõ ràng để bắt đầu làm ngay mà không bị phụ thuộc vào tiến độ đàm phán API của khách:

| Giai đoạn | Hạng mục công việc | Kết quả bàn giao (Deliverables) |
| :--- | :--- | :--- |
| **Milestone 1: Khung hệ thống, Auth & Giao diện** | - Thiết lập Next.js, PostgreSQL, Google & Email Auth.<br>- Xây dựng Middleware tự động nhảy qua Landing Page vào thẳng Dashboard.<br>- Dựng UI Landing Page, Dashboard tìm kiếm và Lịch sử tra cứu. | Khách hàng có thể đăng nhập bằng Google/Email, trải nghiệm luồng điều hướng tự động và giao diện Dashboard mượt mà. |
| **Milestone 2: Hệ thống Stripe, Bảo mật Credit & Mock API** | - Thiết lập Database Transaction Lock & Rate Limiting.<br>- Tích hợp Stripe Subscriptions, Top-ups, Customer Portal & Webhooks.<br>- Lắp đặt **Mock API** (giả lập các kịch bản: tìm thấy mã sơn, không tìm thấy, mạng chậm) để test trừ/hoàn tiền. | Khách hàng test trực tiếp việc mua gói bằng thẻ test Stripe, thử bấm nút liên tục 20 lần/giây để kiểm chứng hệ thống chống gian lận số dư hoạt động hoàn hảo. |
| **Milestone 3: Lắp ghép API Thực tế & Go-Live** | - Nhận tài liệu API từ nhà cung cấp khách hàng đã chốt.<br>- Viết module Adapter kết nối API thật.<br>- Kiểm thử toàn diện (End-to-End), chuyển Stripe sang chế độ Live và đưa web lên tên miền chính thức. | Website hoàn chỉnh, sẵn sàng thu tiền thật và phục vụ người dùng cuối. |

---

## 7. Danh sách Câu hỏi Cần Làm rõ với Khách hàng (Discovery Checklist)

Để chốt các chi tiết nghiệp vụ cuối cùng với khách hàng (bằng ngôn ngữ đơn giản, không dùng từ kỹ thuật khó hiểu), bạn có thể hỏi họ 4 ý sau:

1. **Cấu trúc Bảng giá (Pricing Tiers):** Dự kiến có mấy gói hàng tháng và mấy mức mua lẻ (Top-up)? *(Ví dụ: Gói $19/tháng được 20 lượt tra, hay mua lẻ $5/lượt?)*
2. **Quy tắc Cộng dồn Credit (Credit Rollover):** Khi hết 1 tháng mà khách hàng chưa dùng hết số Credit của gói tháng đó, số Credit thừa sẽ **được cộng dồn sang tháng sau** hay **reset về định mức mới**?
3. **Chính sách khi Không tìm thấy Mã sơn:** Nếu người dùng nhập một biển số xe nhưng nhà cung cấp API không có dữ liệu mã màu sơn cho chiếc xe đó, hệ thống sẽ **tự động hoàn lại (refund) 1 Credit** cho người dùng đúng không? *(Trang `paintcodebyreg.com` hiện cũng áp dụng chính sách "No Paint Code = No Charge" hoặc hoàn credit).*
4. **Thị trường mục tiêu (Target Country):** Biển số xe chủ yếu phục vụ thị trường nước nào (Anh Quốc - UK Reg, Mỹ, hay Úc)? *(Điều này giúp thiết kế giao diện ô nhập biển số và định dạng kiểm tra ký tự chuẩn xác nhất).*