# Sleep logo SVG — การตรวจความเหมือน

วันที่ 14 ตุลาคม 2026 · branch `feature/replay-same-user`

Elements รวมทั้งสองเวอร์ชันเป็นรายการ **Logo** (`logo-sleep`) เดียว ใช้ `logo-sleep-display.png` เป็นไฟล์/ภาพตัวอย่าง และแสดงที่ตั้งเวกเตอร์ต้นฉบับ `app/assets/brand/logo-sleep.svg` ในรายละเอียด เก็บ PNG ที่ผู้ใช้ให้ใน `app/assets/brand/logo-sleep.png` ไว้โดยไม่แก้ไข (SHA-256 `a7066c0f890285c23a37dc84f928fd3ef00ecf27ed73948796f833845dd5a4fd`)

หลังผู้ใช้แจ้งว่ากระตุก หน้าพักเปลี่ยนมาแสดง `app/assets/brand/logo-sleep-display.png` ซึ่งคัดลอกตรงจาก `rendered.png` ในรายงานนี้ (SHA-256 `f1619b1d649e72b04c537238e4d7115da5483b9e9dd2318927f33c51f22a4167`, 1,101,340 bytes) จึงคงผล SSIM เดิม แต่ไม่ต้องเรนเดอร์ SVG ล้านเส้นใน browser ระหว่างลอย/เลื่อน เก็บ SVG ไว้เป็นต้นฉบับสำหรับปรับและเรนเดอร์ใหม่ ไม่ได้อ้างว่าตรวจ frame rate แล้ว

SVG ใหม่นี้สร้างด้วยการ trace เส้น contour ระดับสีจากต้นฉบับ แยก RGB เป็น 3 ชั้นแบบ isolated screen blend ขั้นสี 4/255 และลดจุดเส้นด้วย Ramer–Douglas–Peucker ไม่เกิน 0.3px ไม่มี PNG ฝัง, image/feImage, รูปสี่เหลี่ยมแทนพิกเซล, script หรือไฟล์ภายนอก เป็นเส้นเวกเตอร์จริง แต่ไม่ได้วาดด้วยมือทีละรูปทรง

## ผลเทียบที่ขนาดต้นฉบับ

| การวัด | SSIM |
| --- | ---: |
| RGB บนพื้นขาว | 98.13961% |
| RGB บนพื้น navy `#061a38` | 98.37866% |
| RGB บนพื้น blue `#1f75ff` | 98.31009% |
| Alpha | 99.83204% |
| **ค่าต่ำสุดที่ใช้ตัดสิน** | **98.13961% — ผ่าน ≥98%** |

รายละเอียดพร้อม hash ของไฟล์อยู่ใน [comparison.json](./comparison.json)

![PNG ต้นฉบับ, SVG ที่เรนเดอร์ และความต่างขยาย 4 เท่า](D:/CodeVenture/debug-master/docs/logo-svg/comparison.png)

## วิธีวัดและตรวจภาพ

- Render ด้วย Sharp/libvips ที่ **1448×980** เท่ากับ PNG เดิม ไม่มีการเลื่อนภาพหรือปรับแนวเพื่อเพิ่มคะแนน
- SSIM Gaussian window 11×11, sigma 1.5, population covariance, K1 .01 / K2 .03, data range 255 ใช้ฟังก์ชันเดียวกับ QA ชุด Codi
- วัดกรอบ union alpha >12/255 พร้อมขอบ 5px: `[5,95,1448,907]` เพื่อลดผลจากพื้นที่โปร่งใสว่าง เฉลี่ย RGB ทั้ง 3 channel และใช้ค่าต่ำสุดของทั้ง 4 การวัดตัดสิน
- ภาพ comparison ย่อเพื่อจัดหน้าเท่านั้น **ไม่ได้ย่อภาพก่อนคำนวณ SSIM**
- ตรวจภาพที่เรนเดอร์แล้ว: หมวกแดง หน้าจอ/ตา/จมูก ลำตัว รองเท้า บล็อก flower/rock/honey/ice/grass ตัวอักษร DEBUG MASTER และขอบ navy/cyan ยังตรงกับต้นฉบับ มีความต่างเล็กน้อยตามขอบและการไล่สี
- ค่านี้รับรองเฉพาะภาพอ้างอิง ขนาด และ renderer ที่ระบุ ไม่ใช่คำรับรองความถูกต้องของภาพทุกขนาดหรือทุก browser

## ขนาดและข้อจำกัด

ไฟล์ SVG ขนาด **13,005,557 bytes (~13 MB)** มี 196 path elements และประมาณ 1.08 ล้านคำสั่งเส้น เทียบ PNG เดิม 1,018,651 bytes (~1 MB) SVG ใช้เป็นต้นฉบับและในหน้า inventory; หน้าพักใช้ imported PNG ที่เรนเดอร์จาก SVG แทน การ float/slide ทำที่องค์ประกอบภาพด้วย transform/opacity และเอา drop-shadow filter ออก

การลดเส้นถึง 0.6px ทำให้ไฟล์เหลือ ~8 MB แต่ SSIM ต่ำสุดเหลือ 97.71532% จึงไม่ใช้รุ่นนั้น เลือก 0.3px เพื่อผ่านเกณฑ์ที่ผู้ใช้กำหนด **ไม่ได้ตรวจเวลาโหลด การเรนเดอร์ หรือความลื่นใน browser จริง** เพราะงานนี้จำกัดการตรวจเป็น build/source/asset QA ต้นทุนของ SVG จึงยังไม่ได้วัด

## สร้างและตรวจซ้ำ

ไม่เพิ่ม dependency ใน package.json ใช้ Python/Pillow/numpy และ Sharp ที่มีอยู่แล้ว เครื่องมือเหล่านี้เป็น asset QA ไม่ใช่ game test

```powershell
$taskPython = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$taskNode = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
$taskSharp = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'
& $taskPython scripts/vectorize-sleep-logo.py --step 4 --output .cache/logo-svg/raw.svg
& $taskPython scripts/vectorize-sleep-logo.py --compact-source .cache/logo-svg/raw.svg --tolerance 0.3 --output app/assets/brand/logo-sleep.svg
& $taskNode scripts/render-sleep-logo.mjs $taskSharp app/assets/brand/logo-sleep.svg docs/logo-svg/rendered.png
& $taskPython scripts/compare-sleep-logo.py --svg app/assets/brand/logo-sleep.svg --render docs/logo-svg/rendered.png --out docs/logo-svg
Copy-Item -LiteralPath docs/logo-svg/rendered.png -Destination app/assets/brand/logo-sleep-display.png
```

เครื่องมือ compare บันทึกหลักฐานแล้วคืน exit 1 ถ้าไม่ผ่าน .98 รุ่นที่ใช้งานจริงคืน exit 0; `pnpm build` และ `git diff --check` ผ่าน ไม่เขียน/รัน test, ไม่ตรวจเกม/browser/audio, ไม่ git add/commit
