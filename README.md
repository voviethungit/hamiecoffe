# HAMIE Coffee & Tea

Website tiếng Việt, kèm trang quản trị tại `/admin/`. Hỗ trợ deploy trên **Netlify** hoặc chạy server Node.js riêng.

## Deploy trên Netlify

Bản Netlify dùng **Netlify Functions + Netlify Blobs** để lưu thực đơn, ảnh, thông tin quán, phiên đăng nhập và tin nhắn. Dữ liệu Blobs gắn với site, được giữ qua các lần deploy; không dùng SQLite hoặc ghi ảnh vào ổ đĩa tạm của Functions.

1. Kết nối site Netlify với repository GitHub và nhánh `main`. Nếu trước đây deploy bằng kéo/thả thư mục, chuyển sang deploy qua Git để Netlify build cả Functions.
2. Cấu hình build (đã có sẵn trong `netlify.toml`):
   - **Base directory:** thư mục gốc repository (để trống).
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
   - **Node.js:** 24 (đã khai báo trong cấu hình).
3. Trong **Project configuration → Environment variables**, thêm:

   | Biến | Giá trị |
   | --- | --- |
   | `ADMIN_USERNAME` | `admin` hoặc tên đăng nhập bạn chọn |
   | `ADMIN_PASSWORD` | Mật khẩu riêng từ 12 đến 300 ký tự |

   Áp dụng cho **Functions** hoặc **All scopes**, với deploy context **Production**. Không đặt mật khẩu trong `netlify.toml`, HTML hoặc JavaScript phía trình duyệt. Netlify tự cấp kết nối Blobs cho Functions; không cần tạo token Blobs thủ công.
4. **Trigger deploy → Deploy site** sau khi lưu biến môi trường. Mở `https://hamiecoffe.netlify.app/admin/` và đăng nhập bằng thông tin vừa cấu hình.
5. Kiểm tra `/api/content` trả JSON; lưu thử một món, tải ảnh, rồi gửi form liên hệ và xem trong Hộp thư admin.

Không dùng `npm start` làm build command và không publish thư mục gốc repository. Thư mục `dist/` chỉ chứa tài nguyên công khai; mã server, cơ sở dữ liệu, `.env` và mật khẩu không được publish.

Tài khoản do lệnh `admin:create` tạo trên máy local **không tự chuyển lên Netlify**. Trên Netlify, tên đăng nhập/mật khẩu lấy từ hai biến môi trường ở trên. Đổi `ADMIN_PASSWORD` rồi deploy lại để đổi mật khẩu và vô hiệu các phiên cũ.

Nếu admin báo “API chưa hoạt động”, kiểm tra Functions `api` có trong deploy, build command/publish directory và quy tắc `/api/*` trong `netlify.toml`. Nếu báo chưa cấu hình `ADMIN_PASSWORD`, kiểm tra scope/context của biến và deploy lại. Lỗi lưu dữ liệu xem tại **Logs & Metrics → Functions → api**.

## Chạy thử đúng môi trường Netlify trên máy

Yêu cầu Node.js 24 trở lên:

```sh
npm ci
npm run build
```

Tạo file `.env` (được gitignore) từ `.env.example`, điền tài khoản/mật khẩu, sau đó:

```sh
npm run dev:netlify
```

Website: http://localhost:8888 — Admin: http://localhost:8888/admin/.
Netlify CLI giả lập Functions, redirects và Blobs. Dữ liệu local nằm trong `.netlify/`, tách biệt dữ liệu của site thật.

## Các chức năng

- Thực đơn: thêm/sửa/xoá, ẩn/hiện món, ảnh, mô tả, danh mục và giá theo size.
- Thư viện ảnh: tải PNG/JPEG/WebP; tối đa **4 MB trên Netlify**, 8 MB trên server Node.js riêng. Chọn ảnh cho món hoặc thay sáu nhóm ảnh gốc; các vị trí dùng cùng ảnh gốc được cập nhật cùng nhau.
- Thông tin quán: địa chỉ, giờ mở cửa, số điện thoại; Facebook, Zalo, TikTok ở footer cả bảy trang.
- Hộp thư: nhận form liên hệ và chuyển trạng thái chưa đọc/đã đọc/đã xử lý. Bấm “Làm mới” để lấy tin mới. **Chưa tích hợp Google Sheets hoặc email**; bổ sung ở giai đoạn sau.

Thông tin mạng xã hội trống hiển thị icon chờ cập nhật. Blog/ưu đãi vẫn là giao diện mẫu, chưa thuộc phần quản trị này. Nội dung HTML tĩnh là dự phòng; khi API hoạt động, dữ liệu admin được dùng cho thực đơn, ảnh thay thế, thông tin liên hệ và mạng xã hội.

## Kiểm tra

```sh
npm test
npm run build
```

Có kiểm tra API Node.js/SQLite và Netlify Functions sử dụng SDK + server Blobs chính thức: đăng nhập, cookie, phân quyền, giới hạn dữ liệu/ảnh, thực đơn, ảnh, mạng xã hội, nhận form, dữ liệu qua các phiên Function độc lập, giới hạn số yêu cầu và retry khi ghi đồng thời.

## Chạy server Node.js riêng (tuỳ chọn, không áp dụng cho Netlify)

```sh
npm ci
npm run admin:create -- admin
npm start
```

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin/

Lệnh tạo tài khoản in mật khẩu ngẫu nhiên; lưu lại để đăng nhập. Muốn tự đặt mật khẩu, cung cấp biến `ADMIN_PASSWORD` (tối thiểu 12 ký tự). Đổi/reset bằng `npm run admin:create -- admin --reset`; phiên cũ bị thu hồi.

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `PORT` | `3000` | Cổng HTTP |
| `DATA_DIR` | `./data` | SQLite và ảnh upload, cần ổ đĩa bền vững và quyền ghi |
| `PUBLIC_ORIGIN` | theo URL/Host của yêu cầu | URL website chính xác, không có `/` cuối; có thể dùng trên Netlify để ràng buộc một domain chính |
| `COOKIE_SECURE` | `false` | Đặt `true` khi chạy server Node.js sau reverse proxy HTTPS; Functions tự dùng cookie Secure trên HTTPS |

Server Node.js riêng cần chạy liên tục và giữ thư mục `data/` qua các lần deploy. Sao lưu toàn bộ `data/` gồm SQLite và `uploads/`; dừng ứng dụng trong lúc copy hoặc dùng công cụ backup SQLite nhất quán. Dữ liệu SQLite local không tự đồng bộ sang Netlify Blobs. Không commit mật khẩu, dữ liệu khách hàng hay ảnh upload lên GitHub.
