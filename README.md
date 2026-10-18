# HAMIE Coffee & Tea — Trang chủ

Bản HTML/CSS/JavaScript tái tạo thiết kế trang chủ từ **3 ảnh chụp Figma**.

## Xem thử

- Cách nhanh nhất: mở `index.html` trong Chrome hoặc Edge.
- Hoặc chạy web server tại thư mục dự án: `python -m http.server 8000`, mở `http://localhost:8000`.

## Thư mục

- `index.html`: cấu trúc trang chủ, nội dung tiếng Việt, semantic HTML.
- `styles.css`: giao diện desktop + tablet + mobile.
- `script.js`: menu di động, các carousel và cửa sổ thông tin.
- `assets/`: 6 ảnh minh họa được cắt và phóng từ các ảnh Figma người dùng cung cấp.

## Lưu ý

- Những hình minh họa hiện lấy từ ảnh chụp màn hình (không phải ảnh gốc độ phân giải cao). Để sắc nét hơn ở màn hình lớn, thay các ảnh trong `assets/` bằng file export nguyên bản từ Figma.
- Các thiết kế **Thực đơn đầy đủ**, **Liên hệ**, **Góc HAMIE chi tiết** chưa được gửi. Nút bấm đã tương tác được, mở cửa sổ thông tin tạm thay vì dẫn tới trang chưa tồn tại. Không tự tạo địa chỉ, số điện thoại hoặc giá bán.
- Slider 2/3 và các câu chuyện khác được thêm dưới dạng *nội dung demo* để các nút chuyển hoạt động. Khi bạn cung cấp các màn hình còn lại, có thể cập nhật nội dung đúng Figma.
- Google Fonts tải font Be Vietnam Pro khi có internet, trình duyệt sẽ tự dùng Arial khi offline.
- Thiết kế ưu tiên tương đồng ở màn hình desktop **1440 px**, tương ứng tên frame gốc `WEB 01 - Trang chủ [1440]`.
