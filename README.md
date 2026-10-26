# HAMIE Coffee & Tea

Website tiếng Việt, kèm trang quản trị tại `/admin/`.

## Chạy ứng dụng

Yêu cầu **Node.js 24 trở lên**. Không cần cài package bên ngoài.

```sh
npm run admin:create -- admin
npm start
```

Lệnh tạo tài khoản in mật khẩu ngẫu nhiên một lần; lưu lại để đăng nhập. Nếu muốn tự đặt mật khẩu, cung cấp biến môi trường `ADMIN_PASSWORD` (ít nhất 12 ký tự). Đổi/reset mật khẩu bằng `npm run admin:create -- admin --reset`; các phiên đăng nhập cũ sẽ bị thu hồi.

- Website: http://localhost:3000
- Quản trị: http://localhost:3000/admin/
- Kiểm tra: `npm test`

## Các chức năng

- Thực đơn: thêm/sửa/xoá, ẩn/hiện món, ảnh, mô tả, danh mục và giá theo size.
- Thư viện ảnh: tải PNG/JPEG/WebP tối đa 8 MB, chọn ảnh cho món; thay sáu nhóm ảnh gốc đang dùng trên website. Các vị trí dùng cùng ảnh gốc được cập nhật cùng nhau.
- Thông tin quán: địa chỉ, giờ mở cửa, số điện thoại; liên kết Facebook, Zalo, TikTok ở footer cả bảy trang.
- Hộp thư: nhận form liên hệ, xem nội dung và chuyển trạng thái chưa đọc/đã đọc/đã xử lý. Bấm “Làm mới” để lấy tin mới. Hiện chưa tích hợp gửi email thông báo hoặc Google Sheets; Google Sheets được bổ sung ở giai đoạn sau.

Thông tin mạng xã hội trống sẽ hiển thị icon chờ cập nhật. Không có tài khoản/mật khẩu mặc định trong mã nguồn.

## Triển khai

Backend Node.js phải chạy liên tục trên VPS hoặc hosting hỗ trợ Node.js và ổ đĩa bền vững. GitHub Pages chỉ phục vụ bản giao diện tĩnh, không chạy admin, API hoặc nhận tin nhắn.

Biến môi trường:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `3000` | Cổng HTTP |
| `DATA_DIR` | `./data` | Thư mục dữ liệu SQLite và ảnh upload, phải có quyền ghi và được giữ qua các lần triển khai |
| `PUBLIC_ORIGIN` | kiểm tra theo Host | URL website chính xác, ví dụ `https://hamie.example.com`, không có `/` cuối |
| `COOKIE_SECURE` | `false` | Đặt `true` khi triển khai sau reverse proxy HTTPS |

Ví dụ khởi động sau reverse proxy HTTPS:

```sh
PORT=3000 PUBLIC_ORIGIN=https://hamie.example.com COOKIE_SECURE=true npm start
```

Giữ proxy HTTPS cùng origin cho website và `/api/`. Không công khai cổng backend ngoài reverse proxy khi đưa lên production. Chặn truy cập `.env`, mã server và dữ liệu: server hiện chỉ phục vụ danh sách tài nguyên công khai được cho phép. Phiên admin dùng cookie HttpOnly, SameSite=Strict, hết hạn sau 8 giờ; mật khẩu băm scrypt. API kiểm tra quyền và kiểm tra đầu vào ở server.

Sao lưu **toàn bộ thư mục `data/`** gồm SQLite (và WAL/SHM nếu đang mở) và `uploads/`. Dừng ứng dụng trong lúc sao lưu/copy hoặc dùng công cụ backup SQLite nhất quán. Không commit dữ liệu khách hàng, ảnh tải lên hay mật khẩu lên GitHub.

Nội dung blog/ưu đãi hiện vẫn là giao diện mẫu; chưa nằm trong phần quản trị này. Những file HTML tĩnh giữ nội dung dự phòng khi chạy không có backend. Khi chạy bằng `npm start`, dữ liệu admin là nguồn hiển thị cho thực đơn, các ảnh được thay và thông tin liên hệ/mạng xã hội.
