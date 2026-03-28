# Zalo Linux 💬

Ứng dụng **Zalo** desktop không chính thức dành cho Linux, được đóng gói bằng [Electron](https://www.electronjs.org/).

## ✨ Tính năng

- 🖥️ Chạy Zalo như một ứng dụng desktop native
- 🔔 Hỗ trợ thông báo hệ thống (desktop notification)
- 📌 Icon trong khay hệ thống (system tray) với badge đếm tin nhắn chưa đọc
- 🔒 Ngăn chặn mở nhiều instance cùng lúc
- ❌ Ẩn cửa sổ khi bấm nút X (không thoát hẳn)
- 📦 Có thể đóng gói thành file `.deb` để cài đặt

## 📋 Yêu cầu

- Node.js >= 18
- npm

## 🚀 Cài đặt & Chạy

```bash
# Clone hoặc tải về thư mục zalo-linux
cd zalo-linux

# Cài dependencies
npm install

# Chạy ứng dụng
npm start
```

## 📦 Build file .deb

```bash
npm run dist
```

File `.deb` sẽ được xuất ra thư mục `dist/`.

## 🗂️ Cấu trúc dự án

```
zalo-linux/
├── build/
│   └── icons/          # Icon các kích thước (16 → 512px)
├── main.js             # Electron main process
├── preload.js          # Preload script (notification, badge)
├── icon.png            # Icon tray
├── favicon.png         # Favicon
├── package.json
└── .gitignore
```

## 📝 Ghi chú

- Dữ liệu đăng nhập được lưu trong Electron session `persist:zalo`, tách biệt hoàn toàn với trình duyệt.
- Dự án này chỉ là wrapper web, không phải client chính thức của VNG/Zalo.
