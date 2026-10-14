# Codi SVG — รายงานตรวจความเหมือน

วันที่ 14 ตุลาคม 2026

**รายงานย้อนหลัง:** หลังการวัดนี้ ผู้ใช้เลือกท่าชนะเส้นคมให้แทนท่า trace เดิมใน `app/assets/sprites/codi-win.svg` ท่าชนะที่มีค่า 98.0018% ด้านล่างถูกเก็บใน `reference/codi-win-traced.svg` แล้ว ค่า/ภาพ/hash เก่าไม่ได้รับรองท่าชนะเส้นคมใหม่ ซึ่งยังไม่ได้วัด SSIM ท่าเดิน/แพ้ทั้ง 5 ท่าคงเดิม ดูภาพเส้นคมใน `docs/practice-summary-visuals/REPORT.md`

พบ SVG วาดด้วยรูปทรงเวกเตอร์ครบ 5 ท่าอยู่แล้วใน repo จาก commit `61be56c` และเกมใช้งานผ่าน `app/utils/playerSprites.ts` อยู่แล้ว งานรอบนี้จึงตรวจยืนยันชุดที่มีอยู่และจัดหลักฐานเปรียบเทียบ ไม่ได้สร้างภาพชุดใหม่หรือวาดทับภาพเดิม

งานต่อ: เพิ่ม **ท่าชนะ** เป็น SVG ใหม่ โดย trace เส้นขอบบริเวณสีจากภาพอ้างอิงที่ผู้ใช้แนบ เก็บ PNG ต้นฉบับไว้ใน `app/assets/sprites/codi-win.png` โดยไม่แก้ไข และใช้ `PLAYER_POSES.win` แทนรูปเดิมใน popup สรุปการฝึกซ้อม ท่าเดินและท่าแพ้ทั้ง 5 ไฟล์คงเดิม

## ผลการเปรียบเทียบ

| ท่า | ไฟล์ SVG | SSIM ต่ำสุด | เกณฑ์ ≥ 98% |
| --- | --- | ---: | --- |
| หันหน้า / เดินลง | [codi-down.svg](D:/CodeVenture/debug-master/app/assets/sprites/codi-down.svg) | 98.95% | ผ่าน |
| หันหลัง / เดินขึ้น | [codi-up.svg](D:/CodeVenture/debug-master/app/assets/sprites/codi-up.svg) | 99.40% | ผ่าน |
| หันซ้าย | [codi-left.svg](D:/CodeVenture/debug-master/app/assets/sprites/codi-left.svg) | 99.48% | ผ่าน |
| หันขวา | [codi-right.svg](D:/CodeVenture/debug-master/app/assets/sprites/codi-right.svg) | 99.42% | ผ่าน |
| ท่าแพ้ | [codi-failed.svg](D:/CodeVenture/debug-master/app/assets/sprites/codi-failed.svg) | 98.88% | ผ่าน |
| ท่าชนะเดิม (ย้อนหลัง) | [codi-win-traced.svg](D:/CodeVenture/debug-master/docs/codi-svg/reference/codi-win-traced.svg) | 98.0018% | ผ่าน |

ค่าต่ำสุดของทั้งชุด 6 ท่าคือ **0.9800183** จึงผ่านเกณฑ์ SSIM ≥ 0.98 ทุกท่า ท่าชนะผ่านใกล้เกณฑ์มาก ค่านี้อ้างอิง renderer และขนาดที่ระบุด้านล่างเท่านั้น

![PNG ต้นฉบับเทียบ SVG และภาพความต่างขยาย 4 เท่า](D:/CodeVenture/debug-master/docs/codi-svg/comparison.png)

## วิธีวัด

- อ้างอิง PNG `app/assets/sprites/codi-{down,up,left,right,failed,win}.png` ขนาด 128 × 128 RGBA โดยไม่แก้ไฟล์ต้นฉบับ
- เรนเดอร์ SVG ด้วย Sharp/libvips ที่ขนาด 128 × 128 เท่ากัน ไม่ขยับภาพหรือปรับแนวเพื่อเพิ่มคะแนน
- ใช้ SSIM Gaussian window 11 × 11, sigma 1.5, population covariance, K1 = 0.01, K2 = 0.03, data range 255 ตามสูตรใน [งานวิจัย SSIM ของ Wang และคณะ](https://ece.uwaterloo.ca/~z70wang/publications/ssim.html)
- วัดเฉพาะกรอบตัวละครจาก union ของ alpha > 12/255 พร้อมขอบ 5px เพื่อลดการเพิ่มคะแนนจากพื้นที่โปร่งใสว่าง
- วัดค่าเฉลี่ย SSIM ของ RGB หลังวางบนพื้นขาว, navy `#061a38`, blue `#1f75ff` และวัด alpha แยก แล้วใช้ **ค่าต่ำสุด** เป็นเกณฑ์ผ่าน
- ผลละเอียด กรอบที่วัด และ SHA-256 ของ PNG ต้นฉบับ / SVG / PNG ที่เรนเดอร์ อยู่ใน [comparison.json](D:/CodeVenture/debug-master/docs/codi-svg/comparison.json)

98% ในรายงานหมายถึงค่าดัชนี SSIM 0.98 ตามเกณฑ์ที่ตกลง ไม่ได้หมายถึงพิกเซลตรงกัน 98% หรือการรับรองความเหมือนจากผู้เล่น ค่าเป็นของภาพที่เรนเดอร์ด้วยเครื่องมือตามวิธีนี้

## ตรวจหน้าตาและรูปแบบไฟล์

- ตรวจภาพเทียบที่ 128px และ SVG ที่เรนเดอร์ 512px: ทิศทางตัว, รูปหมวกแดง, จอหน้าสีน้ำเงิน, ตาขาว/จมูกชมพู, ลำตัวขาวเทา, รองเท้าสีเหลือง และแขนยกในท่าแพ้ตรงกับต้นฉบับ มีความต่างเล็กน้อยตามขอบ/รอยต่อ
- ทั้ง 6 ไฟล์เป็น SVG vector shapes/paths/gradients/clip paths ไม่มี `image`, `feImage`, `foreignObject`, script หรือ href ไปยังภาพฝัง/ภายนอก
- ท่าชนะใช้เส้น contour แยกบริเวณสี 32 สี พร้อม clip silhouette และ Gaussian blur 0.4px เพื่อรักษาขอบนุ่มของต้นฉบับ เป็น path เวกเตอร์จริง ไม่มีภาพ PNG ฝังหรือรูปสี่เหลี่ยมแยกเป็นพิกเซล ตรวจตาขยิบ แขนยก หมวกแดง ลำตัว และรองเท้าเอียงจากภาพที่เรนเดอร์ 128px/512px แล้ว ยังมีความต่างเล็กน้อยที่ขอบและรอยต่อสี
- คง viewBox 128 × 128 และความโปร่งใส การเดิน/ทิศทาง/ท่าแพ้และ asset registry เดิมใช้งานชุด SVG นี้อยู่แล้ว
- Popup สรุปฝึกซ้อมใช้ท่าชนะใหม่ผ่าน registry และคงขนาด/animation เดิม ไม่เปลี่ยนตัวเดิน การเปิดสรุป หรือเงื่อนไขจบเกม
- ไม่ได้ตรวจ runtime ของเกมหรือเรนเดอร์ในเบราว์เซอร์

## ทำซ้ำการตรวจ

เครื่องมือตรวจเป็น asset QA แยกจากเกม ไม่เพิ่ม runtime dependency ใน package.json คำสั่งด้านล่างวัดไฟล์เกม **ปัจจุบัน** รวมท่าชนะเส้นคม ไม่ใช่ชุดย้อนหลังในตาราง จึงใช้ output ชั่วคราวเพื่อไม่เขียนทับหลักฐานเดิม และไม่อ้างว่าท่าชนะใหม่ผ่านเกณฑ์โดยยังไม่ได้วัด

```powershell
& 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' scripts/render-codi-svg.mjs --sharp-module 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp' --out .cache/codi-current/rendered
& 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/compare-codi-svg.py --renders .cache/codi-current/rendered --out .cache/codi-current/qa
```

Renderer รับ `--scale 4` สำหรับดูภาพเวกเตอร์ 512px แต่การวัดต้องใช้ 128px เท่านั้น เครื่องมือ compare บันทึกรายงานก่อนคืน exit 1 หากท่าใดต่ำกว่า 0.98
