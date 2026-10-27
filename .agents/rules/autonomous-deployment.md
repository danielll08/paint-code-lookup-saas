# Rule: Quy Trình Triển Khai Tự Động Hóa 100% (Autonomous Deployment)

Quy định tự động hóa toàn bộ quy trình đưa dự án lên Vercel và Render từ đầu đến cuối mà không cần người dùng thao tác thủ công.

---

## 1. Cơ Chế Tự Động Hóa

Mỗi khi người dùng yêu cầu:
> *"deploy"*, *"up lên vercel"*, *"up lên render"*, *"triển khai dự án"*

Hệ thống 3 Agent sẽ tự động phối hợp thực hiện khép kín:
1. **Kiểm tra chất lượng (Auditor - Antigravity)**: Chạy `npm test` và `npm run lint` để đảm bảo không có bất kỳ lỗi logic nào.
2. **Đồng bộ mã nguồn (Developer - OpenCode)**: Tự động commit các thay đổi và push lên nhánh `main` của GitHub repo `danielll08/paint-code-lookup-saas`.
3. **Kích hoạt Deploy Vercel (Developer - OpenCode)**:
   - Qua GitHub Push (Vercel tự động nhận diện và build).
   - Hoặc chạy lệnh `npm run deploy:vercel` (sử dụng Vercel CLI tự động không cần can thiệp).
4. **Kích hoạt Deploy Render (Developer - OpenCode)**:
   - Qua `render.yaml` Blueprint hoặc Render Deploy Hook (`npm run deploy:render`).

---

## 2. Lệnh Thực Thi Duy Nhất (Single Autonomous Command)

```bash
npm run deploy
```
Lệnh này sẽ tự động:
- Chạy toàn bộ Vitest test suite.
- Đẩy code mới nhất lên `origin/main`.
- Kích hoạt pipeline Vercel.
- Kích hoạt pipeline Render.
- In kết quả trạng thái deploy trực tiếp lên màn hình.
