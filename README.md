# Lazy Warriors Farm Chat

## Tệp trong thư mục

- `script.user.js`: userscript bản chat (cài bản này).
- `script.meta.js`: metadata cập nhật.
- `guild-chat.js`: module Guild Chat được nạp qua `@require`.
- `firebase.database.rules.json`: rules mẫu cho Realtime Database.

## Cài đặt

1. Cài trình quản lý userscript (Tampermonkey trên desktop, hoặc **Userscripts** trên iPhone/Safari).
2. Cài script từ raw URL: [script.user.js (raw)](https://raw.githubusercontent.com/thanhnd-ssv/lazy-warriors-farm-chat/refs/heads/main/script.user.js) (hoặc mở trực tiếp file [script.user.js](./script.user.js) trong repo).
3. Mở `https://at-sp.ssvhue.work/`, tải lại trang và nhấn **icon chat (💬)** để mở Guild Chat.

## Cấu hình Guild Chat (admin hội)

1. Bật **Anonymous Authentication** và tạo **Realtime Database** trên Firebase.
2. Đăng nội dung [`firebase.database.rules.json`](./firebase.database.rules.json) vào **Realtime Database → Rules**.
3. Tạo mã mời 16–64 ký tự (A–Z, 0–9, `-` giữa các cụm) tại `guildInvites/<INVITE_CODE>`:

   ```json
   {
     "guildId": "your-guild",
     "enabled": true
   }
   ```

Đặt `enabled` thành `false` để thu hồi mã mời.

## Sử dụng

- Lần đầu: nhập **Nickname** (2–12 ký tự), **Mã mời hội**, chọn avatar (tùy chọn) rồi vào hội.
- Tin nhắn đồng bộ realtime qua Firebase; nếu luồng realtime gián đoạn, chat tự chuyển sang kiểm tra dự phòng mỗi giây.
- **Di chuyển icon:** giữ và kéo icon 💬 đến vị trí mong muốn (vị trí được lưu).
- **Mở/đóng chat:** nhấn icon để mở (khung chat hiện mặc định ở góc dưới bên phải), nhấn đóng để quay lại và icon trả về vị trí đã đặt.
- Sau khi cập nhật script, người dùng thường vẫn vào lại chat nếu phiên lưu còn hợp lệ.

## Lưu ý

- `script.user.js`/`script.meta.js` hiện tham chiếu `@require`, `@updateURL`, `@downloadURL` tới repo này (`thanhnd-ssv/lazy-warriors-farm-chat`). Khi phát hành bản mới, nhớ đồng bộ `@version` ở cả hai file.
- Không đưa Service Account key hoặc thông tin quản trị vào userscript; quyền truy cập dữ liệu do Firebase Security Rules kiểm soát.
