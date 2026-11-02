# 24/7 — วิธีเริ่ม (สำหรับมินนี่)

ไม่ต้องคุยกับ Claude Code เยอะ ทุกอย่างอยู่ใน `START_HERE.md` แล้ว

## เริ่มครั้งแรก
1. เปิด **Terminal**
2. วางคำสั่งนี้แล้วกด Enter:
   ```bash
   cd ~/Documents/"24 7 project" && claude --permission-mode acceptEdits "อ่าน START_HERE.md แล้วลุยเลย"
   ```
   (`acceptEdits` = ให้มันแก้ไฟล์ได้เองโดยไม่ต้องถามทุกไฟล์)
3. ถ้าถามว่า **trust this folder?** → เลือก Yes
4. มันจะขอให้ login **GitHub / Supabase / Vercel** → กด login ในเบราว์เซอร์ที่เด้งขึ้นมา (ครั้งเดียว)
5. ช่วงแรกมันจะถามสิทธิ์รันคำสั่ง เช่น `npm`, `git`, `supabase` → ถ้าเป็นคำสั่งพวกนี้เลือก **"Yes, and don't ask again"** มันจะจำไว้ ไม่ถามซ้ำ
   - คำสั่งที่ลบของ (`rm -rf`, `reset`, `delete`, `--force`) อ่านก่อนกดทุกครั้ง
6. ปล่อยมันทำไป มันจะส่งข้อความสั้นๆ ทุกครั้งที่จบแต่ละ milestone พร้อมลิงก์ให้ลอง

## กลับมาทำต่อ (ปิดไปแล้ว / เปิดเครื่องใหม่)
```bash
cd ~/Documents/"24 7 project" && claude --continue --permission-mode acceptEdits
```
หรือ `claude "ทำต่อ"`: มันจะอ่าน `docs/PROGRESS.md` แล้วทำต่อจากจุดเดิม

## จุดที่มันจะรอเรา
- **login ครั้งแรกเท่านั้น** ที่เหลือมันแจ้งแล้วทำต่อเลย ไม่ต้องตอบก็ได้
- ถ้าอยากติอะไร พิมพ์บอกตอนไหนก็ได้ มันจะเอาไปแก้เป็นงานแรกของรอบถัดไป

## QA/QC (มันตรวจงานตัวเองก่อนส่งทุกครั้ง)
ทุก milestone ต้องผ่าน 7 ด่านใน `docs/QA_QC.md` ก่อนถึงจะบอกว่าเสร็จ:
1. code ไม่มี error
2. test ทั้งหมดผ่าน รวมของ milestone เก่าด้วย
3. ตรวจความสวยด้วย screenshot ทุกขนาดจอ, light/dark, ไทย/อังกฤษ ให้คะแนนตาม rubric 9 ข้อ ทุกข้อต้องได้ ≥ 4/5 รวมถึงเช็คว่าไม่มีเส้นดำ และไม่ดู AI
4. ใช้ง่าย (check-in ≤ 5 tap, ปุ่มใหญ่พอ)
5. ความปลอดภัยของ data
6. เทสบนเว็บจริงหลัง deploy
7. ให้ reviewer อีกตัวที่ไม่ได้เขียน code มาลองพังแอปและให้คะแนนซ้ำ

ผลตรวจอยู่ใน `docs/qa/M<x>-report.md` และสรุปเป็นบรรทัด QC ในข้อความ ✅ ทุกครั้ง

## ถ้ายังไม่มี Claude Code
```bash
curl -fsSL https://claude.ai/install.sh | bash
```

## ไฟล์ในโฟลเดอร์นี้
- `START_HERE.md` คำสั่งงานแบบ autopilot ให้ Claude Code
- `CLAUDE.md` กฎของโปรเจกต์ (stack, art แบบไม่มีเส้นขอบ, ภาษา)
- `docs/SPEC.md` spec เต็ม
- `docs/BUILD_PLAN.md` แผน M0–M14
- `docs/QA_QC.md` กระบวนการตรวจงาน (gates, test cases, rubric ความสวย)
- `docs/qa/` reviewer prompt, template และรายงาน QC ของแต่ละ milestone
- `design/reference-style-a.svg` ภาพต้นแบบสไตล์ A ที่เราเลือก ทุกชิ้นต้องเข้ากับภาพนี้
- `docs/PROGRESS.md` สถานะล่าสุด (Claude Code สร้างและอัปเดตเอง)
- `docs/DECISIONS.md` เรื่องที่มันตัดสินใจเองระหว่างทาง (เปิดดูได้ว่ามันเลือกอะไรไปบ้าง)
